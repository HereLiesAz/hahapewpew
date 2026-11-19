import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {fitQwertyProportions, fitShiftProportions, copyShiftLimbsToQwerty} from '../public/robot-proportion-fit.js';

async function loaded(name) {
  const bytes = readFileSync(new URL('../public/assets/characters/' + name, import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
}
function primitive(gltf, material) {
  const matches = [];
  gltf.scene.traverse(node => {
    if (node.isSkinnedMesh && node.material?.name === material) matches.push(node);
  });
  assert.equal(matches.length, 1, material);
  return matches[0];
}
function span(mesh, bone) {
  const positions = mesh.geometry.attributes.position;
  const indices = mesh.geometry.attributes.skinIndex;
  let low = Infinity, high = -Infinity, count = 0;
  for (let i = 0; i < positions.count; i++) {
    if (mesh.skeleton.bones[indices.getX(i)]?.name !== bone) continue;
    low = Math.min(low, positions.getY(i));
    high = Math.max(high, positions.getY(i));
    count++;
  }
  assert.ok(count > 0, bone);
  return {low, high, count};
}
function jointY(gltf, name) {
  const bone = gltf.scene.getObjectByName(name);
  assert.ok(bone?.isBone, name);
  gltf.scene.updateMatrixWorld(true);
  return bone.getWorldPosition(new THREE.Vector3()).y;
}

test('Qwerty head rests on the body with negligible visible neck and no change to his head art', async () => {
  const gltf = await loaded('Qwerty_Q16_Validated.glb');
  const plate = primitive(gltf, 'Qwerty/Side_Dark');
  const body = primitive(gltf, 'Qwerty/Body_Graphite');
  const legs = primitive(gltf, 'Qwerty/Limb_Black');
  const originalFace = primitive(gltf, 'Qwerty/Face_Matte').geometry.attributes.position.array.slice();
  fitQwertyProportions(gltf);
  const gap = span(plate, 'base_plate').low - span(body, 'spine').high;
  assert.ok(gap >= 0 && gap < .018, 'plate must nearly touch torso');
  assert.ok(span(legs, 'neck').high - span(legs, 'neck').low < .02);
  const face = primitive(gltf, 'Qwerty/Face_Matte').geometry.attributes.position.array;
  const headDrop = originalFace[1] - face[1];
  assert.ok(headDrop > .19 && headDrop < .35, 'shorter blouse-level torso must bring the head down');
  for (let i = 0; i < face.length; i += 3) {
    assert.ok(Math.abs(face[i] - originalFace[i]) < 1e-6);
    assert.ok(Math.abs(face[i+1] - originalFace[i+1] + headDrop) < 1e-5);
    assert.ok(Math.abs(face[i+2] - originalFace[i+2]) < 1e-6);
  }
});

test('Qwerty visible legs shorten while ankles and original joint pivots remain stable', async () => {
  const gltf = await loaded('Qwerty_Q16_Validated.glb');
  const limb = primitive(gltf, 'Qwerty/Limb_Black');
  const original = {foot: span(limb, 'ankleL'), hip: span(limb, 'hipL'),
    knee: span(limb, 'kneeL'), hipJoint: jointY(gltf, 'hipL'),
    kneeJoint: jointY(gltf, 'kneeL'), ankleJoint: jointY(gltf, 'ankleL')};
  fitQwertyProportions(gltf);
  assert.ok(Math.abs(span(limb, 'hipL').high - original.hip.high + .075) < 1e-5);
  assert.ok(Math.abs(span(limb, 'kneeL').low - original.knee.low + .040) < 1e-5);
  assert.ok(Math.abs(jointY(gltf, 'hipL') - original.hipJoint) < 1e-6);
  assert.ok(Math.abs(jointY(gltf, 'kneeL') - original.kneeJoint) < 1e-6);
  assert.ok(Math.abs(jointY(gltf, 'ankleL') - original.ankleJoint) < 1e-6);
  assert.deepEqual(span(limb, 'ankleL'), original.foot);
});

test('Qwerty tangled original fingers are replaced with symmetrical hooked clamps', async () => {
  const gltf = await loaded('Qwerty_Q16_Validated.glb');
  fitQwertyProportions(gltf);
  const limb = primitive(gltf, 'Qwerty/Limb_Black');
  for (const side of ['L', 'R']) {
    const old = span(limb, 'wrist' + side);
    assert.ok(old.high - old.low < 1e-6, 'old finger triangles must be degenerate');
    const wrist = gltf.scene.getObjectByName('wrist' + side);
    const clamp = wrist.getObjectByName('Qwerty.ReferenceClamp.' + side);
    assert.ok(clamp);
    assert.equal(clamp.children.length, 6, 'palm and two hooked tines must exist');
    assert.equal(clamp.scale.x, 1.75, 'clamps must read as substantial hooks at game camera distance');
    assert.equal(clamp.scale.y, clamp.scale.x);
    assert.equal(clamp.scale.z, clamp.scale.x);
    assert.ok(clamp.children.every(mesh => mesh.isMesh && mesh.castShadow));
  }
  fitQwertyProportions(gltf);
  for (const side of ['L', 'R'])
    assert.equal(gltf.scene.getObjectByName('wrist' + side).children.length, 1,
      'repeated rig creation must not duplicate clamps');
});

test('Shift preserves circular head, ankle and pivots while shortening visible legs', async () => {
  const gltf = await loaded('Shift_Rigged.glb');
  const shell = primitive(gltf, 'Shift/Dome_Side');
  const limb = primitive(gltf, 'Shift/Limb_Black');
  const before = span(shell, 'head');
  const original = {foot: span(limb, 'ankleL'), hip: span(limb, 'hipL'),
    knee: span(limb, 'kneeL'), hipJoint: jointY(gltf, 'hipL'),
    kneeJoint: jointY(gltf, 'kneeL'), ankleJoint: jointY(gltf, 'ankleL')};
  fitShiftProportions(gltf);
  assert.ok(Math.abs(span(shell, 'head').high - before.high + .055) < 1e-5);
  assert.ok(span(limb, 'neck').high - span(limb, 'neck').low < .02);
  assert.ok(Math.abs(span(limb, 'hipL').high - original.hip.high + .04) < 1e-5);
  assert.ok(Math.abs(span(limb, 'kneeL').low - original.knee.low + .018) < 1e-5);
  assert.ok(Math.abs(jointY(gltf, 'hipL') - original.hipJoint) < 1e-6);
  assert.ok(Math.abs(jointY(gltf, 'kneeL') - original.kneeJoint) < 1e-6);
  assert.ok(Math.abs(jointY(gltf, 'ankleL') - original.ankleJoint) < 1e-6);
  assert.deepEqual(span(limb, 'ankleL'), original.foot);
  fitShiftProportions(gltf);
  assert.deepEqual(span(limb, 'ankleL'), original.foot);
});

test('torsos have owner-specified depth-to-width plans and Qwerty torso is shorter', async () => {
  for(const [asset,fit,name,ratio] of [
    ['Qwerty_Q16_Validated.glb',fitQwertyProportions,'Qwerty',1],
    ['Shift_Rigged.glb',fitShiftProportions,'Shift',1.10]
  ]){
    const gltf=await loaded(asset);
    const before=span(primitive(gltf,name+'/Body_Graphite'),'spine');
    fit(gltf);
    const mesh=primitive(gltf,name+'/Body_Graphite');
    const after=span(mesh,'spine');
    if(name==='Qwerty')
      assert.ok((after.high-after.low)/(before.high-before.low)<.84,
        'Qwerty torso should visibly shorten by more than sixteen percent');
    const positions=mesh.geometry.attributes.position,skin=mesh.geometry.attributes.skinIndex;
    let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
    for(let i=0;i<positions.count;i++){
      if(mesh.skeleton.bones[skin.getX(i)]?.name!=='spine')continue;
      x0=Math.min(x0,positions.getX(i));x1=Math.max(x1,positions.getX(i));
      z0=Math.min(z0,positions.getZ(i));z1=Math.max(z1,positions.getZ(i));
    }
    // Both GLBs face +Z before the QA stage rotates their actor roots.
    const actual=(z1-z0)/(x1-x0);
    assert.ok(Math.abs(actual-ratio)<.015,
      name+' torso depth-to-width ratio must match its independent target');
  }
});

test('Shift has thicker arms, enlarged clamps, and Qwerty receives actual Shift limb triangles',async()=>{
  const q=await loaded('Qwerty_Q16_Validated.glb'),s=await loaded('Shift_Rigged.glb');
  fitQwertyProportions(q);fitShiftProportions(s);
  for(const side of ['L','R']){
    const clamp=s.scene.getObjectByName('Shift.ReferenceClamp.'+side);
    assert.ok(clamp,'Shift must have a distinct visible clamp on each wrist');
    assert.equal(clamp.scale.x,1.75);
  }
  copyShiftLimbsToQwerty(s.scene,q.scene);
  assert.equal(primitive(q,'Qwerty/Limb_Black').visible,false,
    'Qwerty old limbs must be retired, not doubled under copied parts');
  for(const name of ['armL','elbowL','wristL','armR','elbowR','wristR',
    'hipL','kneeL','ankleL','hipR','kneeR','ankleR']){
    const original=s.scene.getObjectByName(name);
    const copy=q.scene.getObjectByName('Qwerty.CopiedShift.'+name);
    assert.ok(original?.isBone&&copy?.isMesh,'missing copied Shift limb '+name);
    assert.ok(copy.geometry.attributes.position.count>=3,'empty geometry: '+name);
    assert.equal(copy.parent.name,name,'copy must follow Qwerty animation joint');
  }
  for(const side of ['L','R']){
    for(const section of ['hip','knee']){
      const connector=q.scene.getObjectByName('Qwerty.CopiedShiftConnector.'+section+side);
      assert.ok(connector?.isMesh,'copied legs must bridge the actual Qwerty pivots');
      assert.ok(connector.geometry.parameters.height>.01);
      assert.equal(connector.parent.name,section+side);
    }
    assert.ok(q.scene.getObjectByName('Qwerty.CopiedShiftClamp.'+side));
    assert.equal(q.scene.getObjectByName('Qwerty.ReferenceClamp.'+side),undefined);
  }
  copyShiftLimbsToQwerty(s.scene,q.scene);
  assert.equal(q.scene.userData.shiftLimbsCopied,true);
});
