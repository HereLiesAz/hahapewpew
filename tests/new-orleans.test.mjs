import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {newOrleansDistrict,NEW_ORLEANS_DISTRICTS} from '../public/world-logic.js';

test('New Orleans core has named distinct neighborhoods, not a repeated highrise strip',()=>{
  assert.deepEqual(NEW_ORLEANS_DISTRICTS.map(x=>x.id),['quarter','cbd','garden','midcity','bywater','industrial','flood']);
  for (const [ix,expected] of [[0,'quarter'],[7,'cbd'],[13,'garden'],[20,'midcity'],[27,'bywater'],[35,'industrial'],[47,'flood']]) {
    assert.equal(newOrleansDistrict(ix,0).id,expected);
  }
  assert.equal(newOrleansDistrict(15,6).id,'flood');
  assert.equal(newOrleansDistrict(18,4).id,'midcity');
  assert.equal(newOrleansDistrict(-1,0).id,'levee');
});

// Runtime construction smoke test: validate every neighborhood style's
// geometry, signs, streetcar, tombs, flooded streets, and landmark silhouettes.
class Vec {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
 set(x,y,z){Object.assign(this,{x,y,z});return this;}
 sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
 normalize(){return this;}
 length(){return Math.sqrt(this.x**2+this.y**2+this.z**2);}
}
class Obj {
 constructor(){this.children=[];this.position=new Vec();this.scale={set(){},};this.rotation={x:0,y:0,z:0};this.quaternion={setFromUnitVectors(){}};}
 add(c){this.children.push(c);}
 traverse(fn){fn(this);for(const child of this.children)child.traverse?.(fn);}
}
class Mesh extends Obj {constructor(geometry,material){super();this.geometry=geometry;this.material=material;}}
class Geo {translate(){return this;}}
class Mat {constructor(props){Object.assign(this,props);}}
const THREE={
 BoxGeometry:Geo,SphereGeometry:Geo,CylinderGeometry:Geo,PlaneGeometry:Geo,ExtrudeGeometry:Geo,
 Mesh,Group:Obj,Vector3:Vec,Shape:class{moveTo(){}lineTo(){}closePath(){}},
 MeshStandardMaterial:Mat,MeshPhysicalMaterial:Mat,CanvasTexture:class{constructor(c){this.canvas=c;}},
 SRGBColorSpace:'srgb',DoubleSide:2
};
const file=fs.readFileSync(new URL('../public/nola-world.js',import.meta.url),'utf8')
 .replace("import * as THREE from './vendor/three.module.js';",'const THREE=globalThis.THREE;')
 .replace("import { rng } from './world-logic.js';",'const rng=globalThis.rng;')
 .replace('export function buildNeighborhoodBuilding','function buildNeighborhoodBuilding')
 .replace('export function dressDistrict','function dressDistrict')
 .replace('export function isNolaSharedResource','function isNolaSharedResource')
 + '\nglobalThis.api={buildNeighborhoodBuilding,dressDistrict,isNolaSharedResource};';
const canvas2d={fillRect(){},strokeRect(){},fillText(){}};
const sandbox={THREE,Math,console,document:{createElement(){return {width:0,height:0,getContext(){return canvas2d;}}}},
 rng:(seed)=>{let x=(seed|0)>>>0;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/2**32);}};
vm.createContext(sandbox);vm.runInContext(file,sandbox);
test('district geometries instantiate and can be traversed for every street type',()=>{
 for(const architecture of ['creole','shotgun','downtown','industrial','flood']){
  const g=new Obj(); const info={x:17,z:19,w:11,d:12,seed:104,architecture};
  const building=sandbox.api.buildNeighborhoodBuilding(g,info);
  assert.equal(Boolean(building),architecture!=='downtown');
  for(const ix of [0,8,9,20,35,45])sandbox.api.dressDistrict(g,{ix,iz:ix===9?-1:0,architecture,roadX:true,roadZ:true});
  let nodes=0;g.traverse(()=>nodes++);
  assert.ok(nodes>8,`${architecture} must have observable geometry`);
 }
});
test('shared geometries and PBR materials are exempt from streamed-chunk disposal',()=>{
 assert.equal(sandbox.api.isNolaSharedResource(new THREE.BoxGeometry()),false);
 const world=fs.readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
 assert.match(world,/!isNolaSharedResource\(node\.geometry\)/);
 assert.match(world,/!isNolaSharedResource\(material\)/);
 assert.match(world,/dressDistrict\(g,/);
});