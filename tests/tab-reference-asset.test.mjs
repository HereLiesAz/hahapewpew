import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const bytes=readFileSync(new URL('../public/assets/characters/Tab_Reference.glb',import.meta.url));
function asset() {
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const n=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 return JSON.parse(bytes.subarray(20,20+n).toString('utf8'));
}
test('Tab is UV-mapped, rigged, and has separate walk, idle and bear clips',()=>{
 const g=asset();
 assert.equal(g.skins.length,1);assert.ok(g.skins[0].joints.length>=20);
 assert.equal(g.meshes.length,1);assert.ok(g.meshes[0].primitives.length>=12);
 assert.deepEqual(g.animations.map(a=>a.name),['Tab_Walk','Tab_Idle','Tab_Bear_Swing']);
 const names=new Set(g.nodes.map(n=>n.name));
 for(const name of ['head','spine','shoulder.L','elbow.L','wrist.L','hand.L','shoulder.R','hand.R','bear','hip.L','knee.L','ankle.R'])assert.ok(names.has(name),name);
 for(const p of g.meshes[0].primitives)
   for(const attr of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])
     assert.ok(Number.isInteger(p.attributes[attr]),attr);
});
test('Tab cardboard face and reversed shipping text are embedded images, separate from body',()=>{
 const g=asset(), mats=g.materials.map(x=>x.name);
 for(const key of ['Tab/Box_Face','Tab/Box_Side','Tab/Cardboard_Light','Tab/Dress_Main','Tab/Dress_Light','Tab/Skin','Tab/Bear','Tab/Shoe'])assert.ok(mats.includes(key),key);
 assert.equal(g.images.length,2);assert.equal(g.textures.length,2);
 assert.ok(g.images.every(x=>x.mimeType==='image/png'&&Number.isInteger(x.bufferView)));
 assert.ok(g.materials.find(x=>x.name==='Tab/Box_Face').pbrMetallicRoughness.baseColorTexture);
 assert.ok(g.materials.find(x=>x.name==='Tab/Box_Side').pbrMetallicRoughness.baseColorTexture);
});
test('world loads Tab asynchronously with legacy fallback and attached skeletal movement',()=>{
 const source=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
 for(const token of ['function installTabAsset()',"/assets/characters/Tab_Reference.glb","canvas.dataset.tabModel='legacy'","canvas.dataset.tabModel='glb'","rig.asset.mixer.update(dt)"])assert.ok(source.includes(token),token);
});
