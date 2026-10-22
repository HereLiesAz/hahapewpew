/* A devastated New Orleans, recognizable in silhouette and street texture.
 * Artistically compressed geography: no claim of exact street placement.
 * Procedural dressing; the crew's simulation and AI remain outside this file.
 */
import * as THREE from './vendor/three.module.js';
import { rng } from './world-logic.js';

const box=new THREE.BoxGeometry(1,1,1);
const sphere=new THREE.SphereGeometry(1,12,8);
const dark=new THREE.MeshStandardMaterial({color:'#242527',metalness:.3,roughness:.86});
const rust=new THREE.MeshStandardMaterial({color:'#534840',metalness:.35,roughness:.95});
const plaster=[0xb8a991,0x9d9991,0x947866,0xa8a391,0x8f9a92,0xa99b77].map(color=>new THREE.MeshStandardMaterial({color,roughness:.94}));
const shutters=new THREE.MeshStandardMaterial({color:'#404a45',roughness:.9});
const wrought=new THREE.MeshStandardMaterial({color:'#212525',metalness:.7,roughness:.84});
const wood=new THREE.MeshStandardMaterial({color:'#685747',roughness:1});
const moss=new THREE.MeshStandardMaterial({color:'#565b42',roughness:1});
const brick=new THREE.MeshStandardMaterial({color:'#754d44',roughness:1});
const water=new THREE.MeshPhysicalMaterial({color:'#364b48',roughness:.16,metalness:.1,transparent:true,opacity:.76,depthWrite:false});
const foliage=new THREE.MeshStandardMaterial({color:'#343e34',roughness:1});
const brass=new THREE.MeshStandardMaterial({color:'#bba36a',metalness:.5,roughness:.68});
function mesh(g,geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;g.add(m);return m;}
function b(g,mat,x,y,z,w,h,d){const m=mesh(g,box,mat,x,y,z);m.scale.set(w,h,d);return m;}
function rod(g,mat,ax,ay,az,bx,by,bz,thickness=.04){
 const a=new THREE.Vector3(ax,ay,az),bb=new THREE.Vector3(bx,by,bz);const delta=bb.sub(a);
 const m=mesh(g,new THREE.CylinderGeometry(thickness,thickness,delta.length(),6),mat,(ax+bx)/2,(ay+by)/2,(az+bz)/2);
 m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function sign(parent,label,x,y,z,w=2,h=.38){
 const c=document.createElement('canvas');c.width=512;c.height=96;const a=c.getContext('2d');
 a.fillStyle='#324b43';a.fillRect(0,0,512,96);a.strokeStyle='#bdad80';a.lineWidth=7;a.strokeRect(7,7,498,82);
 a.fillStyle='#eee3c2';a.font='bold 50px Georgia';a.textAlign='center';a.fillText(label,256,63,474);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 const p=mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.87,side:THREE.DoubleSide}),x,y,z);
 p.castShadow=false;return p;
}
function roof(parent,x,h,z,w,d,pitch,mat){
 const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,pitch);shape.lineTo(w/2,0);shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});geo.translate(0,0,-d/2);
 return mesh(parent,geo,mat,x,h,z);
}
function ironBalcony(parent,x,y,z,w,depth){
 b(parent,wrought,x,y-.11,z,w,.10,depth);
 for(const edge of [-1,1]){
   for(let q=0;q<Math.ceil(w/.48);q++){
     const xx=x-w/2+q*w/Math.ceil(w/.48);
     rod(parent,wrought,xx,y,z+depth/2*edge,xx,y+1.0,z+depth/2*edge,.022);
     if(q%2===0)rod(parent,wrought,xx,y+.25,z+depth/2*edge,xx+.18,y+.76,z+depth/2*edge,.012);
   }
   b(parent,wrought,x,y+1.02,z+depth/2*edge,w,.046,.05);
 }
 b(parent,wrought,x-w/2,y+.42,z,.07,.8,depth);
 b(parent,wrought,x+w/2,y+.42,z,.07,.8,depth);
}
function creole(parent,x,z,w,d,seed,broken=false){
 const r=rng(seed),g=group(parent,x,0,z),h=broken?4.1+r()*4:6.2+r()*4;
 b(g,plaster[Math.floor(r()*plaster.length)],0,h*.5,0,w,h,d);
 b(g,brick,0,.52,d/2+.034,w*.96,1.04,.085);
 for(const floor of [0,1]){
   const n=Math.max(2,Math.floor(w/2.3));
   for(let i=0;i<n;i++){
     if(broken&&floor===1&&i===n-1)continue;
     const xx=-w*.5+(i+.5)*w/n,yy=1.65+floor*3;
     b(g,dark,xx,yy,d/2+.06,.93,1.86,.08);
     b(g,shutters,xx-.56,yy,d/2+.095,.18,1.85,.065);
     b(g,shutters,xx+.56,yy,d/2+.095,.18,1.85,.065);
     if(r()<.29)b(g,wood,xx,yy,d/2+.16,.88,1.7,.08).rotation.z=(r()-.5)*.18;
     b(g,plaster[1],xx,yy-1.04,d/2+.10,1.2,.16,.21);
   }
 }
 if(h>5.6){ironBalcony(g,0,3.9,d/2+.65,w*.92,1.36);
    for(const xx of [-w*.38,w*.38])rod(g,wrought,xx,3.85,d/2+1.22,xx,6.1,d/2+.05,.05);
 }
 if(r()<.38)sign(g,['RUE BOURBON','DAUPHINE','ROYAL ST','ST ANN'][Math.floor(r()*4)],0,2.9,d/2+.16,2.2);
 b(g,wood,0,h+.2,0,w+.6,.35,d+.5);
 if(broken){const ruin=b(g,rust,w*.23,h-.45,d/2+.1,w*.49,.5,.4);ruin.rotation.z=.15;}
 return g;
}
function shotgun(parent,x,z,w,d,seed){
 const r=rng(seed),g=group(parent,x,0,z),height=3.7+r()*.6;
 b(g,plaster[Math.floor(r()*plaster.length)],0,height/2,0,w,height,d);
 for(let j=0;j<3;j++)b(g,wood,-w/2+.4+j*.2,height*.58,0,.045,height*.73,d+0.03);
 roof(g,0,height,0,w+.65,d+.7,1.5+r()*.25,r()<.5?rust:wood);
 const porchDepth=1.55;
 b(g,wood,0,.45,d/2+porchDepth*.52,w+.35,.22,porchDepth);
 for(const s of [-1,1]){
  rod(g,wood,s*(w*.45),.52,d/2+porchDepth,s*(w*.45),height-.15,d/2+porchDepth,.105);
  b(g,shutters,s*w*.24,2.03,d/2+.05,.56,1.36,.075);
 }
 b(g,dark,0,1.64,d/2+.15,.65,2.15,.09);
 b(g,brass,.24,1.6,d/2+.22,.045,.045,.03);
 for(let i=0;i<4;i++)b(g,wood,0,.12+i*.085,d/2+porchDepth+(.31-i*.11),w*.75,.07,.25);
 if(r()<.5){const porch=group(g,0,0,d/2+1.9);b(porch,rust,0,.9,0,.72,.2,.7);}
 return g;
}
function oak(parent,x,z,r){
 const h=6+r()*3;
 rod(parent,wood,x,0,z,x+(r()-.5),h*.8,z,.41);
 const crown=group(parent,x,h*.78,z);
 for(let i=0;i<5;i++){
   const a=i*6.283/5,xx=Math.cos(a)*(1.5+r()*1.4),zz=Math.sin(a)*(1.8+r()*1.2);
   rod(crown,wood,0,-.1,0,xx,.3+ r()*.6,zz,.18);
   const leaf=mesh(crown,sphere,foliage,xx,.5,zz);leaf.scale.set(2.3+r(),.5+r()*.3,1.55+r());
   for(let j=0;j<3;j++)rod(crown,moss,xx+(r()-.5),.5,zz+(r()-.5),xx+(r()-.5),-.3-r()*1.6,zz+(r()-.5),.009);
 }
}
function streetcar(parent,x,z,axis=0){
 const tram=group(parent,x,0,z);tram.rotation.y=axis;
 b(tram,rust,0,1.28,0,2.7,2.65,9.2);b(tram,plaster[2],0,1.45,0,2.73,2.4,8.9);
 b(tram,brass,0,2.65,0,2.75,.1,9.2);
 for(const s of [-1,1])for(let j=0;j<7;j++){
   b(tram,dark,s*1.38,1.78,-3.45+j*1.1,.06,1.08,.78);
   b(tram,wood,s*1.42,1.20,-3.45+j*1.1,.07,.08,.95);
 }
 b(tram,dark,0,1.74,4.6,2.24,1.25,.09);b(tram,brass,0,.48,4.57,2.6,.22,.15);
 for(const s of [-1,1])for(const zz of [-3,3]){
  const wheel=mesh(tram,new THREE.CylinderGeometry(.42,.42,.18,12),dark,s*1.13,.36,zz);wheel.rotation.z=Math.PI/2;
 }
 rod(tram,dark,0,2.7,0,0,4.2,-.5,.04);
}
function raisedTombs(parent,x,z){
 const cemetery=group(parent,x,0,z),r=rng(Math.floor((x+1000)*77));
 for(let k=0;k<11;k++){
  const xx=(k%4-1.5)*2.7+(r()-.5)*.35,zz=(Math.floor(k/4)-1)*3.4;
  b(cemetery,plaster[1],xx,1,zz,1.75,2,2.35);
  roof(cemetery,xx,2,zz,1.8,2.45,.5,plaster[0]);
  b(cemetery,dark,xx,1.30,zz+1.20,.15,.65,.09);
  b(cemetery,dark,xx,1.30,zz+1.26,.48,.09,.09);
 }
}
function waterlogged(parent,ix,iz,r){
 for(let n=0;n<4;n++){
  const x=(r()-.5)*42,z=(r()-.5)*42,y=.07+r()*.015;
  const w=7+r()*9,d=3+r()*10;
  const wet=mesh(parent,new THREE.PlaneGeometry(w,d),water,x,y,z);wet.rotation.x=-Math.PI/2;wet.castShadow=false;
  if(r()<.4)b(parent,wood,x,.14,z,w*.3,.23,d*.12).rotation.y=r()*6.28;
 }
}
export function buildNeighborhoodBuilding(parent,{x,z,w,d,seed,architecture}){
 if(architecture==='creole')return creole(parent,x,z,Math.max(5,w*.73),Math.max(6,d*.83),seed,seed%3===0);
 if(architecture==='shotgun'){
   const pair=group(parent,x,0,z);const count=2;
   for(let i=0;i<count;i++)shotgun(pair,(i-.5)*w*.47,0,w*.42,d*.94,seed+i*719);
   return pair;
 }
 if(architecture==='flood')return shotgun(parent,x,z,w*.47,d*.85,seed);
 if(architecture==='industrial'){
   const g=group(parent,x,0,z);
   b(g,brick,0,3.7,0,w,7.4,d);
   for(let i=-2;i<=2;i++)b(g,dark,i*w/5,3.1,d/2+.05,.78,2.3,.1);
   for(let i=0;i<3;i++)b(g,rust,-w*.2+i*1.5,7.8,0,.4,.8,.4);
   return g;
 }
 return null; // CBD towers are still generated by the base world renderer.
}
export function dressDistrict(parent,{ix,iz,architecture,roadX,roadZ}){
 const r=rng(Math.imul(ix,23993)^Math.imul(iz,3779)^22471);
 if(architecture==='creole'){
   for(let s of [-1,1]){
     if(r()<.55)sign(parent,['BOURBON ST','ROYAL ST','CHARTRES'][Math.floor(r()*3)],s*7.6,3.7,-s*8.4,1.8);
   }
   if(ix===0&&iz===0){
     const cathedral=group(parent,21,0,-22);
     b(cathedral,plaster[0],0,4.2,0,10,8.4,7);
     for(let s of [-1,1]){
       b(cathedral,plaster[1],s*4,8.9,0,2.6,9.3,2.8);
       roof(cathedral,s*4,13.6,0,3.1,3.1,3.6,wood);
     }
     roof(cathedral,0,8.3,0,5.0,4,5,plaster[1]);
     for(let j=-2;j<=2;j++)b(cathedral,dark,j*1.4,3,3.54,.72,4.5,.09);
   }
 }
 if(architecture==='shotgun'){
   for(let s of [-1,1])if(r()<.82)oak(parent,(r()-.5)*27,s*(12+r()*7),r);
   if(ix===20&&iz===0)raisedTombs(parent,20,-21);
 }
 if(architecture==='downtown'){
   if(roadX){
     for(let s of [-1,1]){
       b(parent,brass,0,.012,s*2.15,54,.075,.075);
       b(parent,dark,0,.023,s*2.15+(.08*s),54,.033,.028);
     }
     if(iz===0&&ix===8)streetcar(parent,0,0,Math.PI/2);
   }
   if(ix===9&&iz===-1){
     const stadium=group(parent,0,0,-4);
     const drum=mesh(stadium,new THREE.CylinderGeometry(14.5,16,14,48),plaster[1],0,7,0);
     const canopy=mesh(stadium,new THREE.SphereGeometry(16,32,10,0,Math.PI*2,0,Math.PI/2),plaster[2],0,13.7,0);
     canopy.scale.y=.28;
     for(let i=0;i<16;i++){
       const a=i*Math.PI*2/16;rod(stadium,plaster[3],Math.cos(a)*14,1,Math.sin(a)*14,Math.cos(a)*15,13,Math.sin(a)*15,.21);
     }
   }
 }
 if(architecture==='industrial'){
   for(let n=0;n<4;n++){
     const x=(r()-.5)*33,z=(r()-.5)*30;
     b(parent,rust,x,1.9,z,1.3,3.8,1.2);
     const beam=b(parent,dark,x,3.9,z,5.1,.33,.33);beam.rotation.z=(r()-.5)*.4;
   }
 }
 if(architecture==='flood'){
   waterlogged(parent,ix,iz,r);
   if(ix%4===0&&iz===0){
     b(parent,plaster[3],0,2.7,-21,54,5.4,4.4);
     for(let j=-2;j<=2;j++)rod(parent,rust,j*8,5.5,-21,j*8,10,-21,.14);
   }
 }
}

// Geometry/material singletons survive streamed-chunk disposal.
const sharedResources=new Set([box,sphere,dark,rust,shutters,wrought,wood,moss,brick,water,foliage,brass,...plaster]);
export function isNolaSharedResource(resource){return sharedResources.has(resource);}