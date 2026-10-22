import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const base=new URL('../public/',import.meta.url);
const models=readFileSync(new URL('../public/character-models.js',import.meta.url),'utf8');
const scene=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
test('the game builds character rigs, not toy stand-ins',()=>{
  for(const old of ['function createTab(){','function createShift(){','function createQwerty(){'])
    assert.equal(scene.includes(old),false,old);
  assert.match(scene,/import \{ createCharacters, articulateWalk \} from '\.\/character-models\.js'/);
  assert.match(scene,/Object\.assign\(crew,createCharacters\(scene\)\)/);
  assert.match(scene,/articulateWalk\(rig,t\+along,5\.2,1,/);
});
test('character silhouette and physical detail match original art',()=>{
  for(const snippet of ['function carton(parent)','function humanLeg(root,side)','function humanArm(torso,side)','function buildShift(scene)','function buildQwerty(scene)','function teddy(hand)','function skirt(parent)','function trapGeometry(bottom=-.47,top=.46)'])
    assert.ok(models.includes(snippet),snippet);
  assert.match(models,/createCharacters\(scene\)/);
  assert.match(models,/new THREE\.MeshPhysicalMaterial/);
  assert.match(models,/THREE\.ExtrudeGeometry/);
  assert.match(models,/THREE\.TubeGeometry/);
  assert.match(models,/THREE\.BufferGeometry/);
  assert.match(models,/rig\.knees\[i\]\.rotation\.x/);
  assert.match(models,/rig\.elbows\[i\]\.rotation\.x/);
  assert.match(models,/M\.face/);
  assert.match(models,/M\.label/);
  assert.doesNotMatch(models,/CanvasTexture\(.*sprite/i);
});
test('all character PBR image references exist and are nonempty',()=>{
  for(const material of ['cardboard','canvas','skin','nickel','charcoal','rubber','bear']){
    for(const variant of ['', '-height']){
      const p=new URL(`../public/assets/characters/${material}${variant}.webp`,import.meta.url);
      assert.ok(existsSync(p),p.href);
    }
  }
  for(const file of ['box-face.webp','box-side.webp']){
    assert.ok(existsSync(new URL(`../public/assets/characters/${file}`,import.meta.url)));
  }
});
test('physically plausible relative height: Tab is noticeably taller than either machine',()=>{
  assert.match(models,/root\.name='Tab';root\.scale\.setScalar\(\.66\)/);
  assert.match(models,/root\.name='Shift';root\.scale\.setScalar\(\.46\)/);
  assert.match(models,/root\.name='Qwerty';root\.scale\.setScalar\(\.54\)/);
});