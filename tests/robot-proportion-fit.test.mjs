import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {fitQwertyProportions, fitShiftProportions} from '../public/robot-proportion-fit.js';

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
  for (let i = 0; i < face.length; i += 3) {
    assert.ok(Math.abs(face[i] - originalFace[i]) < 1e-6);
    assert.ok(Math.abs(face[i+1] - originalFace[i+1] + .17) < 1e-5);
    assert.ok(Math.abs(face[i+2] - originalFace[i+2]) < 1e-6);
  }
});

test('Qwerty leg pivots actually shorten while ankles and soles stay planted', async () => {
  const gltf = await loaded('Qwerty_Q16_Validated.glb');
  const limb = primitive(gltf, 'Qwerty/Limb_Black');
  const original = {foot: span(limb, 'ankle.L'), hip: jointY(gltf, 'hip.L'),
    knee: jointY(gltf, 'knee.L'), ankle: jointY(gltf, 'ankle.L')};
  fitQwertyProportions(gltf);
  assert.ok(jointY(gltf, 'hip.L') < original.hip - .06);
  assert.ok(jointY(gltf, 'knee.L') < original.knee - .03);
  assert.ok(Math.abs(jointY(gltf, 'ankle.L') - original.ankle) < 1e-6);
  assert.deepEqual(span(limb, 'ankle.L'), original.foot);
  assert.ok(Math.abs(span(limb, 'hip.L').high - .42984) < .003);
  assert.ok(Math.abs(span(limb, 'knee.L').low - .08337) < .003);
});

test('Qwerty tangled original fingers are replaced with symmetrical hooked clamps', async () => {
  const gltf = await loaded('Qwerty_Q16_Validated.glb');
  fitQwertyProportions(gltf);
  const limb = primitive(gltf, 'Qwerty/Limb_Black');
  for (const side of ['L', 'R']) {
    const old = span(limb, 'wrist.' + side);
    assert.ok(old.high - old.low < 1e-6, 'old finger triangles must be degenerate');
    const wrist = gltf.scene.getObjectByName('wrist.' + side);
    const clamp = wrist.getObjectByName('Qwerty.ReferenceClamp.' + side);
    assert.ok(clamp);
    assert.equal(clamp.children.length, 6, 'palm and two hooked tines must exist');
    assert.ok(clamp.children.every(mesh => mesh.isMesh && mesh.castShadow));
  }
  fitQwertyProportions(gltf);
  for (const side of ['L', 'R'])
    assert.equal(gltf.scene.getObjectByName('wrist.' + side).children.length, 1,
      'repeated rig creation must not duplicate clamps');
});

test('Shift keeps circular head and grounded feet while neck and leg joints shorten', async () => {
  const gltf = await loaded('Shift_Rigged.glb');
  const shell = primitive(gltf, 'Shift/Dome_Side');
  const limb = primitive(gltf, 'Shift/Limb_Black');
  const before = span(shell, 'head');
  const foot = span(limb, 'ankle.L');
  const hip = jointY(gltf, 'hip.L'), knee = jointY(gltf, 'knee.L'),
    ankle = jointY(gltf, 'ankle.L');
  fitShiftProportions(gltf);
  assert.ok(Math.abs(span(shell, 'head').high - before.high + .055) < 1e-5);
  assert.ok(span(limb, 'neck').high - span(limb, 'neck').low < .02);
  assert.ok(jointY(gltf, 'hip.L') < hip - .035);
  assert.ok(jointY(gltf, 'knee.L') < knee - .015);
  assert.ok(Math.abs(jointY(gltf, 'ankle.L') - ankle) < 1e-6);
  assert.deepEqual(span(limb, 'ankle.L'), foot);
  fitShiftProportions(gltf);
  assert.ok(Math.abs(jointY(gltf, 'hip.L') - (hip - .04)) < 1e-6);
});
