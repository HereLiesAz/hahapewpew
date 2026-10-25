import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {celShadeRobot} from '../public/cel-robots.js';
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

test('Shift rear dome has continuous gray geometry, not a black shell',()=>{
 const g=glb();
 const materialIndex=g.materials.findIndex(m=>m.name==='Shift/Dome_Side');
 assert.ok(materialIndex>=0,'back and sides require a gray dome material');
 const rear=g.meshes[0].primitives.find(p=>p.material===materialIndex);
 assert.ok(rear,'the gray dome must exist as exported geometry, not only a material');
 assert.ok(g.accessors[rear.attributes.POSITION].count>1000,'the gray material must cover the complete shell');
});


// Unlike a raw JSON assertion, this exercises the actual bundled r180 loader.
// glTF preserves "arm.R"; GLTFLoader sanitizes it to "armR" to support animation.
const shiftCandidatePath=new URL('../workbench/shift/Shift_S22.glb',import.meta.url);
function parsedModel(sourcePath){
  const bytes=readFileSync(sourcePath);
  const data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  return new Promise((resolve,reject)=>new GLTFLoader().parse(data,'',resolve,reject));
}

test('actual r180 GLTFLoader resolves Shift gun bone in both original and S2.2 candidate',async()=>{
  for(const modelPath of [path,shiftCandidatePath]){
    const json=readFileSync(modelPath);
    const jsonLength=json.readUInt32LE(12);
    const sceneMetadata=JSON.parse(json.toString('utf8',20,20+jsonLength));
    // Known canonical source name: do not derive the expected loader name from
    // the same sanitization routine being exercised.
    assert.ok(sceneMetadata.nodes.some(node=>node.name==='arm.R'));
    assert.equal(sceneMetadata.skins[0].joints.length,16);
    const gltf=await parsedModel(modelPath);
    assert.ok(gltf.scene.getObjectByName('armR')?.isBone,'r180 must sanitize the arm.R node');
    assert.equal(gltf.scene.getObjectByName('arm.R'),undefined);
    let skinned=0;
    gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skinned++;});
    assert.ok(skinned>0,'Shift must remain a skinned actor');
    const {eyes}=celShadeRobot(gltf.scene,'Shift');
    assert.equal(eyes.length,1,'two flat white graphics share one material');
    assert.equal(eyes[0].type,'MeshBasicMaterial');
    assert.equal(eyes[0].color.getHexString(),'ffffff');
    const clips=Object.fromEntries(gltf.animations.map(clip=>[clip.name,clip]));
    assert.ok(clips.Shift_Walk&&clips.Shift_Idle&&clips.Shift_Talk);
    const mixer=new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(clips.Shift_Walk).play();
    mixer.clipAction(clips.Shift_Talk).play();
    mixer.update(.2);
    assert.ok(gltf.scene.getObjectByName('armR')?.isBone);
    assert.equal(eyes[0].color.getHexString(),'ffffff');
  }
});

test('S2.2 isolated browser acceptance targets the candidate, not production',()=>{
  const html=readFileSync(new URL('./visual/shift-s22.html',import.meta.url),'utf8');
  const preview=readFileSync(new URL('./visual/shift-s22-preview.js',import.meta.url),'utf8');
  assert.match(html,/type="module" src="\.\/shift-s22-preview\.js"/);
  assert.match(preview,/\.\.\/\.\.\/workbench\/shift\/Shift_S22\.glb/);
  assert.match(preview,/getObjectByName\('armR'\)/);
  assert.match(preview,/OrthographicCamera/);
  assert.match(preview,/document\.body\.dataset\.shiftReady='true'/);
  const production=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
  assert.match(production,/loadAsync\('\/assets\/characters\/Shift_Rigged\.glb'\)/);
  // S2.2 was merged with a loopback-only QA loader. Its mere presence
  // is not production installation; the non-QA URL is the real invariant.
  assert.match(production,/shiftQaMode\s*\?/);
  assert.match(production,/loadAsync\('\/assets\/characters\/Shift_Rigged\.glb'\)/);
  assert.doesNotMatch(production,/Shift_S23\\.glb/);
});

test('S2.2 in-game candidate is accessible only from loopback',()=>{
  const source=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
  const selector=source.match(/const shiftQaMode = [\s\S]*? : null;/)?.[0];
  assert.ok(selector,'localhost-only Shift QA selector must exist');
  const evaluate=(search,hostname)=>new Function('location','URLSearchParams',selector+'return shiftQaMode;')({search,hostname},URLSearchParams);
  assert.equal(evaluate('?shiftQA=front','localhost'),'front');
  assert.equal(evaluate('?shiftQA=side','127.0.0.1'),'side');
  assert.equal(evaluate('?shiftQA=talk','localhost'),'talk');
  assert.equal(evaluate('?shiftQA=back','localhost'),'back');
  assert.equal(evaluate('?shiftQA=front','www.hahapewpew.com'),null);
  assert.equal(evaluate('?shiftQA=front','hahapewpew.com'),null);
  assert.equal(evaluate('?shiftQA=front','localhost.example'),null);
  assert.equal(evaluate('?shiftQA=invalid','localhost'),null);
  assert.equal(evaluate('','localhost'),null);
  assert.match(source,/shiftQaMode\s*\?\s*await new GLTFLoader\(\)\.loadAsync\('\/workbench\/shift\/Shift_S22\.glb'\)/);
  assert.match(source,/: await new GLTFLoader\(\)\.loadAsync\('\/assets\/characters\/Shift_Rigged\.glb'\)/);
  assert.match(source,/canvas\.dataset\.shiftModel=shiftQaMode\?'glb-s22':'glb'/);
  assert.match(source,/if\(shiftQaMode\)window\.__shiftQA=/);
});

test('S2.3 candidate eye graphics remain fixed on head during Shift_Talk',async()=>{
  const s23Path=new URL('../workbench/shift/Shift_S23.glb',import.meta.url);
  const bytes=readFileSync(s23Path);
  const jsonLength=bytes.readUInt32LE(12);
  const meta=JSON.parse(bytes.toString('utf8',20,20+jsonLength));
  const headNode=meta.nodes.findIndex(n=>n.name==='head');
  const headJoint=meta.skins[0].joints.indexOf(headNode);
  assert.equal(headJoint,3);
  assert.ok(!meta.nodes.some(n=>/eyelid|eye|pupil|blink|socket/i.test(n.name||'')));
  assert.deepEqual(meta.animations.map(a=>a.name),['Shift_Walk','Shift_Idle','Shift_Talk']);
  assert.equal(meta.asset.extras.shiftEyesS23.modifiedVertices,3456);
  const gltf=await parsedModel(s23Path);
  const head=gltf.scene.getObjectByName('head');
  assert.ok(head?.isBone);
  let skin;
  gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skin=node;});
  assert.ok(skin,'Shift head graphics need the actual skinned mesh');
  const original=Array.from(skin.geometry.attributes.position.array);
  const {eyes}=celShadeRobot(gltf.scene,'Shift');
  assert.equal(eyes.length,1);
  assert.equal(eyes[0].type,'MeshBasicMaterial');
  assert.equal(eyes[0].color.getHexString(),'ffffff');
  const before=head.quaternion.clone();
  const mixer=new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find(c=>c.name==='Shift_Talk')).play();
  mixer.update(.24);
  assert.ok(head.quaternion.angleTo(before)>.01,'whole head moves when talking');
  assert.deepEqual(Array.from(skin.geometry.attributes.position.array),original,
    'eye vertices must not be deformed or independently animated');
  assert.equal(eyes[0].color.getHexString(),'ffffff');
});

test('S2.3 visual QA can select new candidate without replacing S2.2',()=>{
  const viewer=readFileSync(new URL('./visual/shift-s22-preview.js',import.meta.url),'utf8');
  assert.match(viewer,/params\.get\('model'\)==='s23'/);
  assert.match(viewer,/Shift_S23\.glb/);
  assert.match(viewer,/Shift_S22\.glb/);
  assert.match(viewer,/sourceAsset,skinned/);
  const live=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
  assert.doesNotMatch(live,/Shift_S23\.glb/);
});


test('S2.4 candidate loads with compact torso, articulated knees and both grounded wedge feet',async()=>{
  const target=new URL('../workbench/shift/Shift_S24.glb',import.meta.url);
  const raw=readFileSync(target);
  const jsonLength=raw.readUInt32LE(12);
  const meta=JSON.parse(raw.toString('utf8',20,20+jsonLength));
  const extra=meta.asset.extras.shiftLowerS24;
  assert.equal(extra.step,'S2.4');
  assert.deepEqual(extra.modifiedVertexCounts,
    {body:144,arms:936,legs:504,untouched:9660});
  const stage=meta.nodes[17];
  assert.equal(stage.name,'Shift.S24.GroundAlign');
  assert.deepEqual(stage.children,[0,1]);
  assert.ok(stage.translation[1]<-.36&&stage.translation[1]>-.4);
  assert.equal(meta.skins[0].joints.length,16);
  assert.deepEqual(meta.animations.map(c=>c.name),['Shift_Walk','Shift_Idle','Shift_Talk']);
  const gltf=await parsedModel(target);
  const arm=gltf.scene.getObjectByName('armR');
  const legJoints=['hipL','kneeL','ankleL','hipR','kneeR','ankleR'];
  assert.ok(arm?.isBone);
  for(const name of legJoints)
    assert.ok(gltf.scene.getObjectByName(name)?.isBone,'S2.4 has leg joint '+name);
  let skinned=0;
  gltf.scene.traverse(obj=>{if(obj.isSkinnedMesh)skinned++});
  assert.ok(skinned>0);
  const {eyes}=celShadeRobot(gltf.scene,'Shift');
  assert.equal(eyes.length,1);
  assert.equal(eyes[0].type,'MeshBasicMaterial');
  const action=new THREE.AnimationMixer(gltf.scene);
  action.clipAction(gltf.animations.find(c=>c.name==='Shift_Walk')).play();
  action.update(.24);
  assert.equal(eyes[0].color.getHexString(),'ffffff');
});

test('S2.4 remains a private viewer candidate; public character and fallback unchanged',()=>{
  const viewer=readFileSync(new URL('./visual/shift-s22-preview.js',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
  assert.match(viewer,/model'\)==='s24'/);
  assert.match(viewer,/Shift_S24\.glb/);
  assert.match(viewer,/Shift_S23\.glb/);
  assert.match(viewer,/Shift_S22\.glb/);
  assert.doesNotMatch(runtime,/Shift_S24/);
  assert.match(runtime,/loadAsync\('\/assets\/characters\/Shift_Rigged\.glb'\)/);
});
