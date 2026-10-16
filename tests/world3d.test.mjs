import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCENES,CHUNK_LENGTH,landmarkForChunk,dialogueFrames,rng,passageName,streetAt,districtKeys} from '../public/world-logic.js';
const source=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/world3d.css',import.meta.url),'utf8');
test('world streams in 3D and exposes its original cast',()=>{
  for(const s of ['function createTab()', 'function createShift()', 'function createQwerty()', 'SphereGeometry','ExtrudeGeometry','THREE.WebGLRenderer','THREE.PerspectiveCamera','function updateChunks()', 'disposeChunk(', 'function updateActors(dt)'])assert.ok(source.includes(s),s);
  assert.match(source,/\bscene\.add\(root\)/);
  assert.match(source,/\bmesh\(head,trapezoidGeometry\(\)/);
  assert.match(html,/type="module" src="\/boot3d\.js"/);
  assert.doesNotMatch(html,/<script src="\/visual\.js"/);
});
test('world starts with the hugging statue and changes at each chunk',()=>{
  assert.equal(CHUNK_LENGTH,54);
  assert.deepEqual(landmarkForChunk(0),SCENES[0]);
  assert.equal(landmarkForChunk(1).kind,'crater');
  assert.equal(landmarkForChunk(2).kind,'billboard');
  assert.equal(landmarkForChunk(5).kind,'fish');
  assert.equal(landmarkForChunk(6).kind,'statue');
  assert.equal(landmarkForChunk(-1),null);
  assert.equal(passageName(54),'THE DEPLETED MINE');
});
test('deterministic procedural placement independent of render frame rate',()=>{
  const a=rng(104),b=rng(104),c=rng(105);
  assert.deepEqual([a(),a(),a()],[b(),b(),b()]);
  assert.notEqual(a(),c());
});
test('dialogue budgets accommodate long Qwerty monologues',()=>{
  assert.equal(dialogueFrames(1),330);
  assert.equal(dialogueFrames(20),540);
  assert.equal(dialogueFrames(200),3600);
  assert.ok(source.includes("fetch('/api/think'"));
  assert.ok(!source.includes('speechSynthesis'));
  assert.match(css,/\.bubble\.qwerty[^{]*\{[^}]*background:#030304/);
  assert.match(css,/\.bubble\.shift[^{]*\{[^}]*color:#65ff5f/);
  assert.match(css,/\.bubble\.tab[^{]*\{[^}]*font:italic/);
});
test('a spectator can follow or explore by touch and keyboard',()=>{
  assert.ok(html.includes('id="follow"'));
  assert.ok(html.includes('data-move="forward"'));
  assert.ok(source.includes('canvas.addEventListener(\'pointermove\''));
  assert.ok(source.includes('canvas.addEventListener(\'wheel\''));
  assert.match(source,/if\(!e\.repeat.*&&follow\)setFollow\(false\)/);
  assert.ok(source.includes('renderer.render(scene,camera)'));
});

test('grid roads remain connected, including negative coordinates',()=>{
  assert.deepEqual(streetAt(0,0),{eastWest:true,northSouth:true});
  assert.deepEqual(streetAt(1,0),{eastWest:true,northSouth:false});
  assert.deepEqual(streetAt(0,-1),{eastWest:false,northSouth:true});
  assert.deepEqual(streetAt(2,2),{eastWest:false,northSouth:false});
  assert.deepEqual(streetAt(-3,3),{eastWest:true,northSouth:true});
});
test('free exploration streams an independent district without unloading the crew',()=>{
  const following=districtKeys(0);
  assert.equal(following.size,15);
  for(const key of ['-2:0','-1:1','0:0','1:-1','2:1'])assert.ok(following.has(key),key);
  assert.equal(following.has('0:3'),false);
  const exploring=districtKeys(0,{x:216,z:216});
  assert.equal(exploring.size,24);
  for(const key of ['0:0','2:1','3:3','5:5','4:4'])assert.ok(exploring.has(key),key);
  assert.equal(exploring.has('10:10'),false);
  // At chunk boundaries, negative world coordinates must floor instead of truncating.
  assert.ok(districtKeys(-.01).has('-3:0'));
});
test('street pass retains physical wheels, weathered surfaces, and third-person camera',()=>{
  for(const feature of ['function wreckCar(', 'function lamppost(', 'function surfaceMap(', 'function building(', 'streetAt(ix,iz)', 'districtKeys(crewX', 'rig.root.rotation.y=Math.PI/2']) {
    assert.ok(source.includes(feature),feature);
  }
  assert.doesNotMatch(source,/new THREE\.Sprite/);
});
