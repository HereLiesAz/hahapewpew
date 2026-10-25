import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {celShadeRobot} from '../public/cel-robots.js';
import {attachShiftConcealedMinigun} from '../public/shift-weapon.js';

const uri=new URL('../workbench/shift/Shift_S26.glb',import.meta.url);
const raw=readFileSync(uri);
function candidate(){
  assert.equal(raw.toString('ascii',0,4),'glTF');
  const jsonSize=raw.readUInt32LE(12);
  return JSON.parse(raw.toString('utf8',20,20+jsonSize));
}
async function scene(){
  const bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  return new Promise((resolve,reject)=>new GLTFLoader().parse(bytes,'',resolve,reject));
}

test('S2.6 GLB has seven named cel-compatible materials, untouched 16-bone rig and UVs',()=>{
  const g=candidate();
  assert.equal(g.skins[0].joints.length,16);
  assert.equal(g.meshes[0].primitives.length,7);
  assert.deepEqual(g.animations.map(a=>a.name),['Shift_Walk','Shift_Idle','Shift_Talk']);
  assert.ok(g.extensionsUsed.includes('KHR_materials_unlit'));
  assert.equal(g.asset.extras.shiftMaterialsS26.step,'S2.6');
  const mats=new Map(g.materials.map(m=>[m.name,m]));
  const required=['Dome_Graphite','Dome_Side','Ink_Outline','Body_Graphite','Control_Light','Limb_Black','Eyes_2D_Emission'];
  for(const key of required)assert.ok(mats.has('Shift/'+key));
  for(const p of g.meshes[0].primitives){
    for(const key of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])
      assert.ok(key in p.attributes,key);
  }
  assert.deepEqual(mats.get('Shift/Eyes_2D_Emission').extensions.KHR_materials_unlit,{});
  assert.deepEqual(mats.get('Shift/Eyes_2D_Emission').emissiveFactor,[1,1,1]);
});

test('S2.6 r180 loader produces genuinely unlit white eyes',async()=>{
  const gltf=await scene();
  let eyesOriginal,otherCount=0,skinned=0;
  gltf.scene.traverse(o=>{
    if(o.isSkinnedMesh)skinned++;
    if(!o.isMesh)return;
    const m=Array.isArray(o.material)?o.material:[o.material];
    for(const material of m){
      if(material.name==='Shift/Eyes_2D_Emission')eyesOriginal=material;
      else otherCount++;
    }
  });
  assert.ok(skinned>0);
  assert.ok(otherCount>0);
  assert.equal(eyesOriginal?.type,'MeshBasicMaterial');
  assert.equal(eyesOriginal?.color.getHexString(),'ffffff');
  // glTF unlit guarantees lighting independence; the runtime cel adapter
  // explicitly disables tone mapping to preserve unmodified white.
  assert.ok(gltf.scene.getObjectByName('head')?.isBone);
  assert.ok(gltf.scene.getObjectByName('wristR')?.isBone);
  const {eyes,gradientMap}=celShadeRobot(gltf.scene,'Shift');
  assert.equal(eyes.length,1);
  assert.equal(eyes[0].type,'MeshBasicMaterial');
  assert.equal(eyes[0].color.getHexString(),'ffffff');
  assert.equal(eyes[0].toneMapped,false);
  assert.equal(gradientMap.image.width,4);
  assert.equal(gradientMap.image.height,1);
  assert.equal(gradientMap.magFilter,THREE.NearestFilter);
  assert.equal(gradientMap.minFilter,THREE.NearestFilter);
  const intensity=[...gradientMap.image.data].filter((_,i)=>i%4===0);
  assert.deepEqual(intensity,[120,158,211,255]);
  gltf.scene.traverse(obj=>{
    if(!obj.isMesh)return;
    const materials=Array.isArray(obj.material)?obj.material:[obj.material];
    for(const material of materials){
      if(material.name==='Shift/Eyes_2D_Emission')continue;
      assert.equal(material.type,'MeshToonMaterial',material.name);
      assert.equal(material.gradientMap,gradientMap,material.name);
      assert.equal(material.map,null,'cel material must not insert photo texture');
    }
  });
});

test('S2.6 material palette samples agree with source colors and Qwerty ramp stays separate',async()=>{
  const gltf=await scene();
  const expected=new Map([
    ['Shift/Dome_Graphite','85858a'],['Shift/Dome_Side','77777d'],
    ['Shift/Ink_Outline','161618'],['Shift/Body_Graphite','4e4d52'],
    ['Shift/Control_Light','aaa9a6'],['Shift/Limb_Black','18181b']
  ]);
  const {gradientMap}=celShadeRobot(gltf.scene,'Shift');
  for(const [name,hex] of expected){
    let mat;
    gltf.scene.traverse(obj=>{
      if(!obj.isMesh)return;
      const all=Array.isArray(obj.material)?obj.material:[obj.material];
      for(const candidate of all)if(candidate.name===name)mat=candidate;
    });
    assert.ok(mat,'missing material '+name);
    assert.equal(mat.color.getHexString(),hex,name);
    assert.equal(mat.gradientMap,gradientMap);
  }
  const dummy=new THREE.Group();
  const qmesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),
    new THREE.MeshBasicMaterial({name:'Qwerty/Body_Graphite',color:'#333333'}));
  dummy.add(qmesh);
  const {gradientMap:qRamp}=celShadeRobot(dummy,'Qwerty');
  assert.notEqual(qRamp,gradientMap);
  assert.deepEqual([...qRamp.image.data].filter((_,i)=>i%4===0),[55,108,183,255]);
  assert.equal(qmesh.material.gradientMap,qRamp);
});

test('S2.6 loaded rig supports independent S2.5 weapon without changing head or eyes',async()=>{
  const gltf=await scene();
  const wrist=gltf.scene.getObjectByName('wristR');
  const head=gltf.scene.getObjectByName('head');
  const before=head.quaternion.clone();
  const gun=attachShiftConcealedMinigun(wrist);
  assert.equal(gun.root.visible,false);
  assert.equal(gun.barrelCount,6);
  const originalNames=gltf.animations.map(c=>c.name);
  const mixer=new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find(c=>c.name==='Shift_Talk')).play();
  mixer.update(.24);
  assert.ok(head.quaternion.angleTo(before)>.01,'talk rotates the whole head');
  assert.equal(gun.root.visible,false);
  gun.pose(1,.6);
  assert.equal(gun.root.visible,true);
  gun.setFiring(true);
  for(let i=0;i<20;i++)gun.update(1/60);
  assert.ok(gun.barrelSpin>.6);
  assert.deepEqual(gltf.animations.map(c=>c.name),originalNames);
});

test('S2.6 preview is workbench-only and game keeps original production GLB',()=>{
  const viewer=readFileSync(new URL('./visual/shift-s22-preview.js',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
  assert.match(viewer,/Shift_S26\.glb/);
  assert.match(viewer,/attachShiftConcealedMinigun/);
  assert.doesNotMatch(runtime,/Shift_S26\.glb/);
  assert.match(runtime,/loadAsync\('\/assets\/characters\/Shift_Rigged\.glb'\)/);
});
