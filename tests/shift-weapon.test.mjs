import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {celShadeRobot} from '../public/cel-robots.js';
import {attachShiftConcealedMinigun} from '../public/shift-weapon.js';

function makeWeapon(){
  const frame=new THREE.Group();
  const wrist=new THREE.Bone();
  wrist.name='wristR';
  frame.add(wrist);
  return {frame,wrist,weapon:attachShiftConcealedMinigun(wrist)};
}
const renderedMeshes=object=>{
  let count=0;
  object.traverseVisible(node=>{if(node.isMesh)count++;});
  return count;
};

test('S2.5 stows every part: identical visible idle silhouette',()=>{
  const {frame,wrist,weapon}=makeWeapon();
  assert.equal(weapon.root.parent,wrist);
  assert.equal(weapon.deployment,0);
  assert.equal(weapon.firing,false);
  assert.equal(weapon.root.visible,false);
  assert.equal(renderedMeshes(frame),0);
  assert.equal(weapon.barrelCount,6);
  assert.deepEqual(weapon.rotor.children.filter(c=>c.name.startsWith('Shift.Weapon.Barrel.')).map(c=>c.name),[
    'Shift.Weapon.Barrel.1','Shift.Weapon.Barrel.2','Shift.Weapon.Barrel.3',
    'Shift.Weapon.Barrel.4','Shift.Weapon.Barrel.5','Shift.Weapon.Barrel.6'
  ]);
  assert.equal(weapon.root.getObjectByName('Shift.Weapon.FrontCollar').isMesh,true);
  weapon.pose(0,1.75);
  assert.equal(renderedMeshes(frame),0,'spin cannot expose a stowed gun');
  assert.equal(weapon.root.visible,false);
});

test('S2.5 independently actuates telescoping slide, hinge and barrel spin',()=>{
  const {frame,weapon}=makeWeapon();
  weapon.pose(.45,.6);
  assert.equal(weapon.root.visible,true);
  assert.equal(weapon.deployment,.45);
  assert.ok(weapon.extend.position.x<0);
  assert.ok(weapon.hinge.rotation.z<0);
  assert.equal(weapon.barrelSpin,.6);
  weapon.pose(1,.6);
  assert.equal(weapon.extend.position.x,0);
  assert.equal(weapon.hinge.rotation.z,0);
  assert.ok(renderedMeshes(frame)>12);
  weapon.setDeployed(true);
  for(let i=0;i<35;i++)weapon.update(1/60);
  assert.equal(weapon.barrelSpin,.6,'deploy without firing may not spin rotor');
  weapon.setFiring(true);
  for(let i=0;i<50;i++)weapon.update(1/60);
  assert.ok(weapon.barrelSpin>.6+1,'spindle rotates independently of hinge');
  assert.equal(weapon.hinge.rotation.z,0);
  const spinning=weapon.barrelSpin;
  weapon.setFiring(false);
  for(let i=0;i<15;i++)weapon.update(1/60);
  assert.equal(weapon.barrelSpin,spinning,'barrels stop when firing ends');
  assert.equal(weapon.root.visible,true,'spin stops separately from retraction');
  weapon.setDeployed(false);
  for(let i=0;i<140;i++)weapon.update(1/60);
  assert.equal(weapon.deployment,0);
  assert.equal(weapon.root.visible,false);
  assert.equal(renderedMeshes(frame),0);
  assert.equal(weapon.barrelSpin,0,'rest state canonical');
});

test('S2.5 muzzle moves with wrist but not with independent rotor spin axis',()=>{
  const {frame,wrist,weapon}=makeWeapon();
  weapon.pose(1,0);
  const p0=weapon.muzzleWorldPosition();
  assert.ok(p0.isVector3);
  wrist.rotation.z=.3;
  const p1=weapon.muzzleWorldPosition();
  assert.ok(p1.distanceTo(p0)>.005);
  weapon.pose(1,Math.PI/2);
  const p2=weapon.muzzleWorldPosition();
  assert.ok(p2.distanceTo(p1)<1e-6,'muzzle axis stays fixed when the barrel pack spins');
  assert.throws(()=>weapon.pose(Number.NaN,0),RangeError);
  assert.throws(()=>weapon.update(-.2),RangeError);
});

test('S2.5 four-band robot shader applies without modifying white eyes',()=>{
  const {weapon}=makeWeapon();
  const shaded=celShadeRobot(weapon.root,'Shift');
  assert.equal(shaded.eyes.length,0,'gun must not masquerade as eyes');
  const materials=new Set();
  weapon.root.traverse(node=>{if(node.isMesh)materials.add(node.material);});
  assert.ok(materials.size>=2);
  for(const material of materials){
    assert.equal(material.type,'MeshToonMaterial');
    assert.ok(material.name.startsWith('Shift/'));
  }
});

test('S2.5 viewer runs solely against the workbench actor; live gun remains untouched',()=>{
  const viewer=readFileSync(new URL('./visual/shift-s22-preview.js',import.meta.url),'utf8');
  const runtime=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
  const model=readFileSync(new URL('../workbench/shift/Shift_S24.glb',import.meta.url));
  assert.ok(model.length>600_000);
  assert.match(viewer,/attachShiftConcealedMinigun\(wrist\)/);
  assert.match(viewer,/celShadeRobot\(weapon\.root,'Shift'\)/);
  assert.match(viewer,/weaponMode===\x27stowed\x27\?0:1/);
  assert.match(viewer,/weapon\?\.update\(dt\)/);
  assert.match(runtime,/loadAsync\('\/assets\/characters\/Shift_Rigged\.glb'\)/);
  assert.doesNotMatch(runtime,/shift-weapon\.js|Shift_S25\.glb/);
});
