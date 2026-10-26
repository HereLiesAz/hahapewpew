import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {createCharacters} from '../public/character-models.js';

const oldShift=readFileSync(new URL('../workbench/shift/Shift_S27.glb',import.meta.url));
const newShift=readFileSync(new URL('../workbench/shift/Shift_S28.glb',import.meta.url));
const liveShift=readFileSync(new URL('../public/assets/characters/Shift_Rigged.glb',import.meta.url));
const qwerty=readFileSync(new URL('../public/assets/characters/Qwerty_Q16_Validated.glb',import.meta.url));

function open(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  const jlen=bytes.readUInt32LE(12);
  return {g:JSON.parse(bytes.toString('utf8',20,20+jlen)),buffer:bytes.subarray(jlen+28)};
}
function accessor(o,p,key){
  const a=o.g.accessors[p.attributes[key]];
  const v=o.g.bufferViews[a.bufferView];
  return {a,offset:(v.byteOffset||0)+(a.byteOffset||0)};
}
function prim(o,name){
  return o.g.meshes[0].primitives.find(p=>o.g.materials[p.material].name===name);
}
function xyz(o,p,i){
  const pos=accessor(o,p,'POSITION');
  const offset=pos.offset+i*12;
  return [o.buffer.readFloatLE(offset),o.buffer.readFloatLE(offset+4),o.buffer.readFloatLE(offset+8)];
}
function joint(o,p,i){
  const a=accessor(o,p,'JOINTS_0');
  return o.buffer.readUInt16LE(a.offset+8*i);
}
async function parsed(bytes){
  const array=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
  return new Promise((resolve,reject)=>new GLTFLoader().parse(array,'',resolve,reject));
}

test('Owner scale correction: Qwerty GLB untouched, only uniform displayed scale halved',()=>{
  const crew=createCharacters(new THREE.Scene());
  const Q=crew.Qwerty.root,S=crew.Shift.root;
  assert.equal(Q.scale.x,.27);
  assert.equal(Q.scale.y,.27);
  assert.equal(Q.scale.z,.27);
  assert.equal(crew.Qwerty.groundScale,.27);
  assert.equal(S.scale.x,.46);
  assert.equal(S.scale.y,.46);
  assert.equal(S.scale.z,.46);
  assert.equal(crew.Shift.groundScale,.46);
  const source=readFileSync(new URL('../public/character-models.js',import.meta.url),'utf8');
  assert.match(source,/root\.name='Qwerty';root\.scale\.setScalar\(\.27\)/);
  assert.doesNotMatch(source,/root\.name='Qwerty';root\.scale\.setScalar\(\.54\)/);
  // GLB remains the previously validated original; no geometry changes.
  assert.equal(open(qwerty).g.asset.version,'2.0');
  assert.equal(qwerty.length,274656);
});

test('Shift corrected GLB is truly circular from ABOVE at every shell ring',()=>{
  const shift=open(newShift);
  const p=prim(shift,'Shift/Dome_Side');
  const rings=new Map();
  for(let i=0;i<accessor(shift,p,'POSITION').a.count;i++){
    const [x,y,z]=xyz(shift,p,i);
    const key=y.toFixed(5);
    const r=rings.get(key)||[];
    r.push(Math.hypot(x,z));
    rings.set(key,r);
  }
  assert.equal(rings.size,11);
  for(const [height,radii] of rings){
    assert.ok(Math.max(...radii)-Math.min(...radii)<2e-6,
      'Top-view ring at '+height+' is elliptical rather than circular');
  }
  assert.equal(shift.g.asset.extras.shiftDomeS28.ringCount,11);
  assert.ok(shift.g.asset.extras.shiftDomeS28.circularMaxRadiusError<2e-6);
  assert.deepEqual(liveShift,newShift,'the corrected model must be the actual LIVE Shift asset');
});

test('Shared torso size and exact 92% standing height — do not scale Shift body down',()=>{
  const Q=open(qwerty),S=open(newShift);
  const qBody=accessor(Q,prim(Q,'Qwerty/Body_Graphite'),'POSITION').a;
  const sBody=accessor(S,prim(S,'Shift/Body_Graphite'),'POSITION').a;
  const qHeight=(qBody.max[1]-qBody.min[1])*.27;
  const sHeight=(sBody.max[1]-sBody.min[1])*.46;
  assert.ok(Math.abs(qHeight-sHeight)/qHeight<.02,'torso heights must match within 2%');
  const qTop=Math.max(...Q.g.meshes[0].primitives.map(p=>Q.g.accessors[p.attributes.POSITION].max[1]));
  const stage=S.g.nodes.find(n=>n.name==='Shift.S24.GroundAlign');
  const sTop=Math.max(...S.g.meshes[0].primitives.map(p=>S.g.accessors[p.attributes.POSITION].max[1]));
  const qStanding=qTop*.27;
  const sStanding=(sTop+stage.translation[1])*.46;
  assert.ok(sStanding<qStanding,'Shift must be shorter');
  assert.ok(Math.abs(sStanding/qStanding-.92)<1e-5,'Shift is 92% of Qwerty height');
});

test('Shift model correction touches head only, all 16 joints, 5 clips and UVs survive',()=>{
  const old=open(oldShift),fresh=open(newShift);
  for(const key of ['nodes','skins','animations','materials','scenes','bufferViews'])
    assert.deepEqual(old.g[key],fresh.g[key],key);
  const before=old.g.meshes[0].primitives,after=fresh.g.meshes[0].primitives;
  assert.equal(before.length,after.length);
  let changed=0,unchanged=0;
  for(let k=0;k<before.length;k++){
    const name=old.g.materials[before[k].material].name;
    for(const attr of ['TEXCOORD_0','JOINTS_0','WEIGHTS_0']){
      const a=accessor(old,before[k],attr),b=accessor(fresh,after[k],attr);
      assert.deepEqual(old.buffer.subarray(a.offset,a.offset+a.a.count*(attr==='TEXCOORD_0'?8:attr==='JOINTS_0'?8:16)),
                      fresh.buffer.subarray(b.offset,b.offset+b.a.count*(attr==='TEXCOORD_0'?8:attr==='JOINTS_0'?8:16)));
    }
    for(let i=0;i<accessor(old,before[k],'POSITION').a.count;i++){
      const a=xyz(old,before[k],i),b=xyz(fresh,after[k],i);
      assert.equal(a[0],b[0],name+' frontal X must not change');
      if(joint(old,before[k],i)===3){
        changed++;
        assert.ok(b[1]>=a[1]-1e-6,'head height must not shrink');
      } else {
        unchanged++;
        assert.deepEqual(a,b,'non-head body/feet must stay intact');
      }
    }
  }
  assert.equal(changed,9504);
  assert.equal(unchanged,1740);
  assert.equal(fresh.g.skins[0].joints.length,16);
  assert.deepEqual(fresh.g.animations.map(a=>a.name),[
    'Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon'
  ]);
});

test('Corrected production Shift loads through the actual r180 GLTFLoader',async()=>{
  const gltf=await parsed(liveShift);
  let skinned=0;
  gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skinned++;});
  assert.ok(skinned>0);
  assert.ok(gltf.scene.getObjectByName('head')?.isBone);
  assert.ok(gltf.scene.getObjectByName('wristR')?.isBone);
  const eyes=[];
  gltf.scene.traverse(node=>{
    if(!node.isMesh)return;
    const mats=Array.isArray(node.material)?node.material:[node.material];
    eyes.push(...mats.filter(m=>m.name==='Shift/Eyes_2D_Emission'));
  });
  assert.equal(eyes.length,1);
  assert.equal(eyes[0].type,'MeshBasicMaterial');
  assert.equal(eyes[0].color.getHexString(),'ffffff');
});

test('Procedural fallback also has a circular dome and the corrected relative size',()=>{
  const crew=createCharacters(new THREE.Scene());
  const fallback=crew.Shift;
  const dome=fallback.head.children.find(x=>x.geometry?.type==='SphereGeometry');
  assert.ok(dome,'missing Shift fallback dome');
  assert.equal(dome.geometry.parameters.radius,.62);
  assert.equal(dome.scale.x,dome.scale.z);
  const fallbackTop=(.54+.26+.62)*.46;
  const qStanding=2.640000104904175*.27;
  assert.ok(Math.abs(fallbackTop/qStanding-.92)<.02);
});
