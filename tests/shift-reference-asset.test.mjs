import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../public/assets/characters/Shift_Rigged.glb',import.meta.url);
function glb(){
 const bytes=readFileSync(path);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const len=bytes.readUInt32LE(12);
 return JSON.parse(bytes.toString('utf8',20,20+len));
}
test('Shift is a skinned GLB with UVs and three clips',()=>{
 const g=glb();
 assert.ok(g.skins[0].joints.length>=14);
 for(const p of g.meshes[0].primitives){
   for(const attr of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])
     assert.ok(attr in p.attributes,attr);
 }
 assert.deepEqual(g.animations.map(a=>a.name),['Shift_Walk','Shift_Idle','Shift_Talk']);
});
test('Shift eyes are static, flat white dome-attached graphics',()=>{
 const g=glb(),eyes=g.materials.filter(m=>m.name==='Shift/Eyes_2D_Emission');
 assert.equal(eyes.length,1);
 assert.deepEqual(eyes[0].emissiveFactor,[1,1,1]);
 assert.ok(g.nodes.some(n=>n.name==='head'));
 assert.ok(!g.nodes.some(n=>/eye|eyelid|pupil|blink|socket/i.test(n.name||'')));
 for(const clip of g.animations)for(const channel of clip.channels)
   assert.ok(!/eye|eyelid/i.test(g.nodes[channel.target.node]?.name||''));
});
test('Shift model loads as cel-shaded actor with usable gun attachment',()=>{
 const source=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
 const cel=readFileSync(new URL('../public/cel-robots.js',import.meta.url),'utf8');
 assert.match(source,/installShiftAsset\(\)/);
 assert.match(source,/getObjectByName\('armR'\)/);
 assert.match(source,/rig\.asset\.mixer\.update\(dt\)/);
 assert.match(cel,/Shift: \{ Dome_Graphite:/);
});
