import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {createQwertyMotionRig,shortStrideClip} from '../public/qwerty-motion.js';
const bytes=readFileSync(new URL('../workbench/qwerty/Qwerty_Q16_validated.glb',import.meta.url));
function gltf(){
 return new Promise((resolve,reject)=>new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
}
test('Q1.7 short-stride hip and knee angles preserve loop closure',async()=>{
 const g=await gltf();
 const source=g.animations.find(a=>a.name==='Qwerty_Walk');
 const tuned=shortStrideClip(source,.62);
 assert.equal(tuned.name,'Qwerty_Walk_ShortStride');
 assert.equal(source.duration,tuned.duration);
 const src=source.tracks.find(t=>/hipL\.quaternion$/.test(t.name));
 const dst=tuned.tracks.find(t=>/hipL\.quaternion$/.test(t.name));
 assert.ok(src&&dst);
 const maximum=t=>Math.max(...Array.from(t.values).filter((_,i)=>i%4===0).map(Math.abs));
 assert.ok(maximum(dst)<maximum(src));
 assert.deepEqual(Array.from(dst.values.slice(0,4)),Array.from(dst.values.slice(-4)));
 assert.notDeepEqual(Array.from(dst.values),Array.from(src.values));
});
test('Q1.7 talk lifts entire shell, leaves plate fixed, and closes cleanly',async()=>{
 const rig=createQwertyMotionRig(await gltf());
 const rest=rig.skull.position.y,base=rig.fixedPlate.position.y;
 rig.setSpeaking(true);rig.update(.20);
 assert.ok(rig.skull.position.y>rest+.35);
 assert.equal(rig.fixedPlate.position.y,base);
 rig.setSpeaking(false);rig.update(0);
 assert.ok(Math.abs(rig.skull.position.y-rest)<1e-5);
 assert.equal(rig.fixedPlate.position.y,base);
 assert.equal(rig.eyes[0].type,'MeshBasicMaterial');
});
test('Q1.7 four-band cel shell and unshaded white/red eye discs',async()=>{
 const g=await gltf(),rig=createQwertyMotionRig(g),materials=[];
 g.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.push(m)});
 const toon=materials.filter(m=>m.type==='MeshToonMaterial');
 assert.ok(toon.length>=6);
 for(const m of toon){
  assert.equal(m.gradientMap.image.width,4);
  assert.equal(m.gradientMap.magFilter,THREE.NearestFilter);
 }
 rig.setKillMode(true);assert.equal(rig.eyes[0].color.getHexString(),'ff1616');
 rig.setKillMode(false);assert.equal(rig.eyes[0].color.getHexString(),'ffffff');
});
test('Q1.7 separate eyelids and animation clips return to first frame',async()=>{
 const g=await gltf(),rig=createQwertyMotionRig(g);
 const a=rig.lidL.getClip().tracks.map(x=>x.name).join(' ');
 const b=rig.lidR.getClip().tracks.map(x=>x.name).join(' ');
 assert.match(a,/eyelidL/);assert.doesNotMatch(a,/eyelidR/);
 assert.match(b,/eyelidR/);assert.doesNotMatch(b,/eyelidL/);
 for(const clip of g.animations)for(const track of clip.tracks){
  const size=track.getValueSize(),values=track.values;
  for(let i=0;i<size;i++)
    assert.ok(Math.abs(values[i]-values[values.length-size+i])<1e-4,clip.name+' '+track.name);
 }
});
