import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Vec {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  set(x,y,z){Object.assign(this,{x,y,z});return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  normalize(){const n=Math.hypot(this.x,this.y,this.z)||1;this.x/=n;this.y/=n;this.z/=n;return this;}
  length(){return Math.hypot(this.x,this.y,this.z);}
}
class Obj {
  constructor(...args){this.position=new Vec();this.rotation=new Vec();this.scale={x:1,y:1,z:1,set:(x,y,z)=>{this.scale.x=x;this.scale.y=y;this.scale.z=z;},setScalar:(n)=>{this.scale.x=this.scale.y=this.scale.z=n}};
    this.quaternion={setFromUnitVectors(){}};this.children=[];this.userData={};}
  add(o){this.children.push(o);}
  traverse(cb){cb(this);this.children.forEach(child=>child.traverse?.(cb));}
}
class Geo {constructor(...args){this.args=args;this.attrs={};}
  setAttribute(name,a){this.attrs[name]=a;}
  setIndex(a){this.indices=a;}
  computeVertexNormals(){}
  translate(){return this;}}
class Scene extends Obj {}
class Material {constructor(props){Object.assign(this,props);}}
class Tex {constructor(){this.wrapS=0;this.wrapT=0;}}
const THREE={
  TextureLoader:class {load(s){assert.match(s,/^\/assets\/characters\/[\w-]+\.webp$/);return new Tex();}},
  MeshPhysicalMaterial:Material,MeshStandardMaterial:Material,
  SphereGeometry:Geo,BoxGeometry:Geo,CylinderGeometry:Geo,ExtrudeGeometry:Geo,TorusGeometry:Geo,TubeGeometry:Geo,BufferGeometry:Geo,
  Mesh:class extends Obj{constructor(g,m){super();this.geometry=g;this.material=m;}},Group:Obj,
  Vector3:Vec, Float32BufferAttribute:class {constructor(data,n){this.array=data;this.itemSize=n;}},
  Shape:class {moveTo(){}lineTo(){}closePath(){}},
  CatmullRomCurve3:class {constructor(x){this.points=x;}},
  SRGBColorSpace:'SRGBColorSpace',NoColorSpace:'NoColorSpace',RepeatWrapping:1,
  FrontSide:0,DoubleSide:2
};
const source=fs.readFileSync(new URL('../public/character-models.js',import.meta.url),'utf8')
  .replace("import * as THREE from './vendor/three.module.js';",'const THREE = globalThis.THREE;')
  .replace('export function createCharacters(scene)','function createCharacters(scene)')
  .replace('export function articulateWalk(rig, t, speed, effort, talking = false)','function articulateWalk(rig, t, speed, effort, talking = false)')+'\nglobalThis.result={createCharacters,articulateWalk};';
const sandbox={THREE,Math,console};vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'character-models.js'});
test('three model graphs construct without throwing',()=>{
  const scene=new Scene();const cast=sandbox.result.createCharacters(scene);
  assert.deepEqual(Object.keys(cast),['Tab','Shift','Qwerty']);
  assert.equal(scene.children.length,3);
  for(const [name,c] of Object.entries(cast)){
    assert.equal(c.name,name);
    assert.equal(c.legs.length,2);assert.equal(c.knees.length,2);
    assert.equal(c.arms.length,2);assert.equal(c.elbows.length,2);
    assert.ok(c.anchor>.8);
    for(let t=0;t<70;t+=.14)sandbox.result.articulateWalk(c,t,5.2,1,name==='Qwerty');
    let n=0;c.root.traverse(()=>n++);
    assert.ok(n>80,`${name}: expected a substantial physically modeled rig, got ${n} nodes`);
  }
  assert.ok(cast.Tab.root.scale.x>cast.Shift.root.scale.x);
  assert.equal(cast.Shift.gun.visible,false);
  assert.ok(cast.Shift.barrel.children.length>=6);
  assert.ok(cast.Qwerty.head.children.length>=10);
});

test('Qwerty head splits physically and upper trapezoid flaps only during speech',()=>{
  const scene=new Scene();
  const q=sandbox.result.createCharacters(scene).Qwerty;
  assert.ok(q.speechLid,'Qwerty must have its own upper-shell hinge');
  assert.equal(q.speechLid.parent,undefined); // mock has no .parent tracking
  assert.equal(q.speechLid.position.y,-.095);
  assert.ok(q.speechLid.children.length >= 2,'upper shell must carry face details');
  const initial=q.speechLid.rotation.x;
  const movement=[];
  for(let time=.0;time<2;time+=.06){
    sandbox.result.articulateWalk(q,time,5.2,1,true);
    movement.push(q.speechLid.rotation.x);
  }
  assert.ok(Math.min(...movement)<-.13,'upper shell opens visibly while speaking');
  assert.ok(Math.max(...movement)-Math.min(...movement)>.13,'mouth must flap rather than stay open');
  for(let time=2;time<5;time+=.05)sandbox.result.articulateWalk(q,time,5.2,1,false);
  assert.ok(Math.abs(q.speechLid.rotation.x)<.001,'head returns fully closed after speech ends');
  assert.equal(initial,0);
});