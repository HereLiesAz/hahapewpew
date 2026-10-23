import * as THREE from './vendor/three.module.js';
import { CHUNK_LENGTH, rng, landmarkForChunk, dialogueFrames, streetAt, districtKeys, newOrleansDistrict } from './world-logic.js';
import { createCharacters, articulateWalk } from './character-models.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { celShadeRobot } from './cel-robots.js';
import { createQwertyMotionRig } from './qwerty-motion.js';
import { dialoguePages, visibleDialoguePage } from './dialogue-pages.js';
import { buildNeighborhoodBuilding, dressDistrict, isNolaSharedResource } from './nola-world.js';

// Everything in the scene is actual geometry. No flat sprites or pasted-on characters.
const canvas = document.querySelector('#world');
// QA state is enabled solely on loopback; it has no effect on production hosts.
const qwertyQaMode = ['front','side','threequarter','talk','kill','lids'].includes(new URLSearchParams(location.search).get('qwertyQA'))
  && ['localhost','127.0.0.1'].includes(location.hostname)
    ? new URLSearchParams(location.search).get('qwertyQA') : null;
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
const coarseDevice=matchMedia('(pointer:coarse)').matches || innerWidth < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarseDevice ? 1.15 : 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !coarseDevice;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a5a69d');
scene.fog = new THREE.FogExp2('#a5a69d', .0048);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .08, 550);
const hemi = new THREE.HemisphereLight('#c6d2df', '#37332c', 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#f2e2c7', 2.65);
sun.position.set(-45, 87, 55);
sun.castShadow = true;
sun.shadow.mapSize.set(coarseDevice ? 1024 : 2048, coarseDevice ? 1024 : 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -55;
sun.shadow.camera.right = sun.shadow.camera.top = 55;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 220;
sun.shadow.bias = -.0003;
sun.shadow.normalBias = .012;
scene.add(sun, sun.target);
const mat = (c, roughness=1, metalness=0) => new THREE.MeshStandardMaterial({color:c,roughness,metalness});
const palette = {
  cardboard:mat('#b08a58'), cardboardSide:mat('#937248'), cardboardEdge:mat('#5c422b'),
  skin:mat('#d5ad84'), hair:mat('#312920'), cloth:mat('#777471'), clothShade:mat('#3c3b3a'),
  black:mat('#191919'), blackMetal:mat('#28272a',.58,.38), graphite:mat('#4c4949',.8,.4),
  robot:mat('#929294',.74,.28), robotLight:mat('#adaaaa',.71,.25),
  white:new THREE.MeshBasicMaterial({color:'#f8fbff'}), eye:new THREE.MeshBasicMaterial({color:'#f5fff9'}),
  red:new THREE.MeshBasicMaterial({color:'#ff413c'}), rust:mat('#685548',.95,.34),
  sand:mat('#766a58'), gravel:mat('#554f46'), dirt:mat('#403c35'),
  ruin:mat('#716d62'), darkRuin:mat('#46453f'), glass:mat('#181c1e',.36,.47),
  concrete:mat('#958d7c'), statue:mat('#a7a497'), bear:mat('#775031'), bearFace:mat('#c69c75'),
  tire:mat('#191918',.98), chrome:mat('#797976',.48,.7), oxidized:mat('#544f48',.9,.3),
  markings:mat('#9f9a87',1), pavement:mat('#777770'), shadowedGlass:mat('#262f33',.22,.14)
};
const groundGeo = new THREE.PlaneGeometry(CHUNK_LENGTH+.3, CHUNK_LENGTH+.3, 1, 1);
const boxGeo = new THREE.BoxGeometry(1,1,1);
const sphereGeo = new THREE.SphereGeometry(1,12,9);
const cylinderGeo = new THREE.CylinderGeometry(1,1,1,10);
const groups = new Map();
const landmarks = [];
const temporary = [];
const people = [];
const crew = {};
let crewX=0, seconds=0, distance=0, paused=false, follow=true, cameraMode=0;
let currentLandmark=null, visitSerial=0, encounterAt=0;
let aiBusy=false, nextDialogueAt=4.5, speechCycle=0, aiCalls=0;
let status='WAITING FOR SIGNAL';
const history=[];
const logNode=document.querySelector('#log');
const liveNode=document.querySelector('#dialogue-log');
const statusNode=document.querySelector('#site-name');
const distNode=document.querySelector('#distance');
const boot=document.querySelector('#boot');
const bubbleNodes={Tab:document.querySelector('#say-tab'),Shift:document.querySelector('#say-shift'),Qwerty:document.querySelector('#say-qwerty')};
const bubbleState={};
const v3 = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
function mesh(parent, geometry, material, x=0,y=0,z=0, sx=1,sy=1,sz=1) {
  const m=new THREE.Mesh(geometry,material);
  m.position.set(x,y,z);m.scale.set(sx,sy,sz);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function block(parent,material,x,y,z,w,h,d){return mesh(parent,boxGeo,material,x,y,z,w,h,d)}
function ball(parent,material,x,y,z,rx,ry=rx,rz=rx){return mesh(parent,sphereGeo,material,x,y,z,rx,ry,rz)}
function limb(parent,material,a,b,r1=.11,r2=.08){
  const d=new THREE.Vector3().subVectors(v3(...b),v3(...a));
  const geo=new THREE.CylinderGeometry(r1,r2,d.length(),9);
  const m=mesh(parent,geo,material,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
  m.quaternion.setFromUnitVectors(v3(0,1,0),d.normalize());return m;
}
function edge(parent, object, color='#25221f', opacity=1){
  const l=new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry,22),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));
  l.position.copy(object.position);l.rotation.copy(object.rotation);l.scale.copy(object.scale);parent.add(l);
}
function pivot(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g}
function slab(parent, material,x,y,z,w,h,d,angle=0){let m=block(parent,material,x,y,z,w,h,d);m.rotation.z=angle;return m}

Object.assign(crew,createCharacters(scene));
// Match the flat ink illustration, not PBR weathered metal or glossy toy plastic.
celShadeRobot(crew.Shift.root,'Shift');
celShadeRobot(crew.Qwerty.root,'Qwerty');

// Q1.8 integration: validated Qwerty replaces the old rig only after complete loading.
// The procedural original remains intact and visible if the GLB fails validation.
async function installQwertyAsset() {
  const rig=crew.Qwerty;
  try {
    const gltf=await new GLTFLoader().loadAsync('/assets/characters/Qwerty_Q16_Validated.glb');
    const motion=createQwertyMotionRig(gltf); // validates skinned mesh, eyes, bones and clips
    const legacy=[...rig.root.children];
    rig.root.add(gltf.scene);
    for(const child of legacy)child.visible=false;
    rig.asset={...motion,loaded:true};
    canvas.dataset.qwertyModel='glb-q16';
  } catch(error) {
    console.warn('Validated Qwerty GLB unavailable; retaining legacy mesh:',error);
  }
}
canvas.dataset.qwertyModel='legacy';
installQwertyAsset();

// Reference-matched Shift is a separate skinned GLB, with static eye decals.
// Retain the previously built actor only when the external asset fails validation.
async function installShiftAsset() {
  const rig=crew.Shift;
  try {
    const gltf=await new GLTFLoader().loadAsync('/assets/characters/Shift_Rigged.glb');
    const {eyes}=celShadeRobot(gltf.scene,'Shift');
    const skinMeshes=[];
    gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skinMeshes.push(node);});
    const bone=gltf.scene.getObjectByName('armR');
    const clip=name=>gltf.animations.find(action=>action.name===name);
    if(!skinMeshes.length||eyes.length!==1||!bone||
       !clip('Shift_Walk')||!clip('Shift_Talk')||!clip('Shift_Idle'))
      throw new Error('Incomplete reference-matched Shift GLB');
    const legacy=[...rig.root.children];
    const gun=rig.gun;
    // The hidden gun remains functional after the legacy torso is retired.
    if(gun) {
      gun.removeFromParent();
      bone.add(gun);
      gun.position.set(.15,-.11,.16);
      gun.rotation.set(0,0,-.08);
      gun.scale.setScalar(.35);
      gun.visible=false;
    }
    rig.root.add(gltf.scene);
    legacy.forEach(node=>{node.visible=false;});
    const mixer=new THREE.AnimationMixer(gltf.scene);
    const walk=mixer.clipAction(clip('Shift_Walk'));
    const talk=mixer.clipAction(clip('Shift_Talk'));
    walk.play();talk.play();talk.setEffectiveWeight(0);
    rig.asset={model:gltf.scene,mixer,walk,talk,loaded:true};
    canvas.dataset.shiftModel='glb';
  } catch(error) {
    console.warn('Shift GLB unavailable; retaining legacy mesh:',error);
  }
}
canvas.dataset.shiftModel='legacy';
installShiftAsset();
 
// Tab is a separate reference-driven UV-mapped GLB. Keep the existing Tab as
// fallback until the rig, embedded face art, shipping label and clips load.
async function installTabAsset() {
  const rig=crew.Tab;
  try {
    const gltf=await new GLTFLoader().loadAsync('/assets/characters/Tab_Reference.glb');
    const clips=Object.fromEntries(gltf.animations.map(a=>[a.name,a]));
    let meshes=0;
    gltf.scene.traverse(node=>{if(node.isSkinnedMesh)meshes++;});
    if(!meshes || !gltf.scene.getObjectByName('head') ||
       !gltf.scene.getObjectByName('bear') ||
       !clips.Tab_Walk || !clips.Tab_Idle || !clips.Tab_Bear_Swing)
      throw new Error('Incomplete Tab reference rig or animation clips');
    const legacy=[...rig.root.children];
    rig.root.add(gltf.scene);
    for(const node of legacy)node.visible=false;
    const mixer=new THREE.AnimationMixer(gltf.scene);
    const walk=mixer.clipAction(clips.Tab_Walk);
    const idle=mixer.clipAction(clips.Tab_Idle);
    const bear=mixer.clipAction(clips.Tab_Bear_Swing);
    walk.play();idle.play();idle.setEffectiveWeight(.24);bear.play();
    rig.asset={model:gltf.scene,mixer,walk,idle,bear,loaded:true};
    rig.anchor=1.74;
    canvas.dataset.tabModel='glb';
  } catch(error) {
    console.warn('Tab GLB unavailable; retaining legacy character:',error);
  }
}
canvas.dataset.tabModel='legacy';
installTabAsset();



// Shared procedural surface maps: seeded once, not regenerated on every chunk.
// These are physical material textures, not flat background paintings.
function surfaceMap(seed, type) {
  const cnv=document.createElement('canvas'); cnv.width=512;cnv.height=512;
  const c=cnv.getContext('2d'),r=rng(seed);
  const base=type==='road'?'#444542':type==='concrete'?'#7d7b71':type==='cardboard'?'#b09368':type==='metal'?'#797b77':'#85857b';
  c.fillStyle=base;c.fillRect(0,0,512,512);
  for(let i=0;i<11000;i++){
    const shade=Math.floor(r()*75+22),alpha=type==='road'?.11:.075;
    c.fillStyle=`rgba(${shade},${shade},${shade},${alpha})`;
    const x=r()*512,y=r()*512,size=.3+r()*3;
    c.fillRect(x,y,size,size);
  }
  c.strokeStyle='rgba(23,23,22,.34)';c.lineWidth=1.2;
  for(let i=0;i<18;i++){
    c.beginPath();let x=r()*512,y=r()*512;c.moveTo(x,y);
    for(let n=0;n<5;n++){x+=(r()-.5)*40;y+=(r()-.5)*35;c.lineTo(x,y);}c.stroke();
  }
  if(type==='facade'){
    for(let y=23;y<512;y+=72)for(let x=18;x<512;x+=76){
      const boarded=r()<.28,shattered=r()<.35;
      c.fillStyle='#383b3b';c.fillRect(x-4,y-4,50,53);
      c.fillStyle=boarded?'#675f4d':'#27363b';c.fillRect(x,y,42,44);
      c.fillStyle='#a3a396';c.globalAlpha=.14;c.fillRect(x+2,y+2,11,40);c.globalAlpha=1;
      if(shattered){c.fillStyle='#121a1e';c.beginPath();c.moveTo(x,y);c.lineTo(x+39,y+6);c.lineTo(x+27,y+29);c.lineTo(x+6,y+17);c.fill();}
      if(boarded){c.strokeStyle='#8b816e';c.lineWidth=5;c.beginPath();c.moveTo(x,y+12);c.lineTo(x+42,y+36);c.stroke();}
      c.strokeStyle='#88877c';c.lineWidth=3;c.strokeRect(x-3,y-3,48,50);
    }
    c.fillStyle='rgba(59,52,42,.21)';for(let i=0;i<24;i++)c.fillRect(r()*512,r()*512,r()*70,3+r()*27);
  }
  const map=new THREE.CanvasTexture(cnv);map.colorSpace=THREE.SRGBColorSpace;
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  return map;
}
const roadMap=surfaceMap(7397,'road'),sidewalkMap=surfaceMap(8181,'concrete');
roadMap.repeat.set(7,3);sidewalkMap.repeat.set(8,4);
palette.cardboard.map=surfaceMap(1993,'cardboard');palette.cardboard.needsUpdate=true;
palette.robot.map=surfaceMap(2718,'metal');palette.robot.needsUpdate=true;
palette.graphite.map=surfaceMap(1988,'metal');palette.graphite.needsUpdate=true;
const facades=[surfaceMap(113,'facade'),surfaceMap(229,'facade'),surfaceMap(367,'facade')];
const roadMaterial=new THREE.MeshStandardMaterial({map:roadMap,roughness:.98});
const sidewalkMaterial=new THREE.MeshStandardMaterial({map:sidewalkMap,roughness:1});
const facadeMaterials=facades.map(map=>new THREE.MeshStandardMaterial({map,roughness:.88,metalness:.025}));

function building(parent,x,z,w=6,h=14,d=9,seed=0){
  const r=rng(seed),height=h*(.8+r()*.36);
  const base=block(parent,r()>.45?palette.ruin:palette.darkRuin,x,height*.5-.08,z,w,height,d);
  base.castShadow=false;
  // Detailed recessed facade surfaces replace geometric grids of windows.
  for(const dir of [-1,1]){
    const face=mesh(parent,new THREE.PlaneGeometry(w*.97,height*.95),facadeMaterials[Math.floor(r()*facadeMaterials.length)],x,height*.51,z+dir*(d/2+.013));
    face.rotation.y=dir===1?0:Math.PI;face.castShadow=false;
  }
  block(parent,palette.oxidized,x,height,z,w*.98,.17,d*.98);
  for(let n=0;n<3;n++){
    const ledge=block(parent,palette.concrete,x+(r()-.5)*w*.65,height+.05+r()*1.4,z+(r()-.5)*d,w*(.22+r()*.15),.16,.7);
    ledge.rotation.z=(r()-.5)*.43;
  }
  // Street-level doors, stoops and loose trim distinguish the buildings.
  const front=z>0?1:-1;
  block(parent,palette.black,x-w*.28,1.17,z+front*(d*.5+.05),1.10,2.25,.08);
  block(parent,palette.rust,x-w*.28,2.31,z+front*(d*.5+.13),1.25,.16,.2);
  return base;
}
function deadTree(parent,x,z,r){
  const height=3+r()*3;
  const trunk=mesh(parent,new THREE.CylinderGeometry(.07,.28,height,7),palette.rust,x,height/2,z);
  trunk.rotation.z=(r()-.5)*.16;
  for(let i=0;i<3;i++){
    const y=height*(.58+i*.13),side=(i%2?1:-1);
    limb(parent,palette.rust,[x,y,z],[x+side*(1+r()),y+.8+r(),z+(r()-.5)],.11,.025);
  }
}
function wreckCar(parent,x,z,seed,alongX=true){
  const r=rng(seed),car=pivot(parent,x,.03,z);
  car.rotation.y=(alongX?Math.PI/2:0)+(r()-.5)*.3;
  const paint=[palette.rust,palette.oxidized,palette.darkRuin,palette.robot][Math.floor(r()*4)];
  const chassis=block(car,paint,0,.59,0,1.86,.58,4.2);
  const roof=block(car,paint,0,1.19,-.31,1.64,.62,2.11);roof.rotation.x=(r()-.5)*.07;
  const windscreen=block(car,palette.shadowedGlass,0,1.23,.78,1.44,.47,.045);windscreen.rotation.x=-.47;
  const rear=block(car,palette.shadowedGlass,0,1.25,-1.37,1.43,.43,.04);rear.rotation.x=.47;
  for(const side of [-1,1]){
    for(const zz of [-1.34,1.34]){
      const wheel=mesh(car,new THREE.CylinderGeometry(.39,.39,.18,14),palette.tire,side*.95,.39,zz);
      wheel.rotation.z=Math.PI/2;
      const hub=mesh(car,new THREE.CylinderGeometry(.16,.16,.185,12),palette.chrome,side*1.058,.39,zz);hub.rotation.z=Math.PI/2;
    }
    block(car,palette.black,side*.949,1.22,-.32,.027,.39,1.2);
  }
  for(const side of [-1,1]){
    block(car,palette.oxidized,side*.72,.53,2.14,.24,.25,.06);
    block(car,palette.rust,side*.72,.53,-2.14,.25,.25,.07);
  }
  chassis.rotation.z=(r()-.5)*.05;
  return car;
}
function lamppost(parent,x,z,seed){
  const r=rng(seed),pole=pivot(parent,x,0,z);
  const stem=mesh(pole,new THREE.CylinderGeometry(.065,.09,6.8,8),palette.oxidized,0,3.4,0);
  stem.rotation.z=(r()-.5)*.07;
  limb(pole,palette.oxidized,[0,6.6,0],[1.65,6.65,0],.065,.05);
  block(pole,palette.oxidized,1.63,6.56,0,.68,.14,.30);
  return pole;
}
function ruinChunk(ix,iz=0){
  const rand=rng((Math.imul(ix,19297)^Math.imul(iz,96439)^931)|0);
  const g=new THREE.Group();g.position.set(ix*CHUNK_LENGTH,0,iz*CHUNK_LENGTH);
  g.userData.key=`${ix}:${iz}`;scene.add(g);
  const ground=mesh(g,groundGeo,palette.sand,0,-.14,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  const {eastWest:roadX,northSouth:roadZ}=streetAt(ix,iz);
  if(roadX)block(g,roadMaterial,0,-.10,0,CHUNK_LENGTH,.075,13.8).castShadow=false;
  if(roadZ)block(g,roadMaterial,0,-.088,0,13.8,.085,CHUNK_LENGTH).castShadow=false;
  if(roadX){
    for(const side of [-1,1]){
      block(g,sidewalkMaterial,0,.06,side*9.1,CHUNK_LENGTH,.22,3.0).castShadow=false;
      block(g,palette.concrete,0,.19,side*7.1,CHUNK_LENGTH,.26,.22).castShadow=false;
    }
    if(!roadZ)for(let xx=-23;xx<24;xx+=7){block(g,palette.markings,xx,-.045,0,2.6,.012,.10).castShadow=false;}
  }
  if(roadZ){
    for(const side of [-1,1]){
      block(g,sidewalkMaterial,side*9.1,.06,0,3,.22,CHUNK_LENGTH).castShadow=false;
      block(g,palette.concrete,side*7.1,.19,0,.22,.26,CHUNK_LENGTH).castShadow=false;
    }
    if(!roadX)for(let zz=-23;zz<24;zz+=7)block(g,palette.markings,0,-.04,zz,.10,.01,2.6).castShadow=false;
  }
  const zone=newOrleansDistrict(ix,iz);
  // Neighbourhood architecture replaces generic towers outside the CBD.
  // Real city geometry extends in both axes; roads form connected intersections.
  for(const sideX of [-1,1])for(const sideZ of [-1,1]){
    const x=sideX*(17+rand()*2.8),z=sideZ*(17+rand()*2.9);
    if(rand()<.88){
      const w=9+rand()*4.5,d=9+rand()*5,seed=(Math.imul(ix,81)^Math.imul(iz,67)^Math.floor(x*99)^Math.floor(z*31))|0;
      if(!buildNeighborhoodBuilding(g,{x,z,w,d,seed,architecture:zone.architecture}))
        building(g,x,z,w,8+rand()*21,d,seed);
    }
    else deadTree(g,x,z,rand);
    for(let n=0;n<4;n++){
      const px=x+(rand()-.5)*14,pz=z+(rand()-.5)*13;
      const chunk=block(g,rand()<.5?palette.ruin:palette.rust,px,.11+rand()*.23,pz,.2+rand()*1.0,.1+rand()*.45,.2+rand()*1.3);
      chunk.rotation.y=rand()*6.28;
    }
  }
  if(roadX&&rand()<.51)wreckCar(g,-11+rand()*17,(rand()<.5?-1:1)*5.2,ix*313+iz*53,true);
  if(roadZ&&!roadX&&rand()<.45)wreckCar(g,(rand()<.5?-1:1)*4.8,-11+rand()*18,ix*917+iz*7,false);
  if(roadX)for(const side of [-1,1])lamppost(g,-20+rand()*7,side*10.8,ix*18+iz);
  dressDistrict(g,{ix,iz,architecture:zone.architecture,roadX,roadZ});
  const landmark=iz===0?landmarkForChunk(ix):null;
  if(landmark)addLandmark(g,landmark,8+rand()*7,-15-rand()*3);
  return g;
}
function addLandmark(group,landmark,x,z){
  const place=new THREE.Group();place.position.set(x,0,z);group.add(place);
  const kind=landmark.kind;
  if(kind==='crater'){
    const pit=mesh(place,new THREE.CylinderGeometry(7,4,1.3,40),palette.dirt,0,-.76,0);
    const rim=mesh(place,new THREE.TorusGeometry(7,1.1,9,42),palette.rust,0,.22,0);rim.rotation.x=-Math.PI/2;
    for(let i=0;i<15;i++){
      const a=i*2.4,p=7.6+i%3;
      block(place,palette.ruin,Math.cos(a)*p,.33,Math.sin(a)*p,.5,.65,1).rotation.y=a;
    }
  }else if(kind==='statue'){
    block(place,palette.concrete,0,.40,0,4,.8,2.1);
    for(const s of [-1,1]){
      const figure=pivot(place,s*.65,.84,0);
      const body=mesh(figure,new THREE.CylinderGeometry(.25,.47,2.0,10),palette.statue,0,1.05,0);
      ball(figure,palette.statue,-s*.07,2.36,0,.42,.45,.39);
      limb(figure,palette.statue,[s*.34,1.68,0],[0,1.48,.18],.18,.12);
      limb(figure,palette.statue,[-s*.32,1.65,0],[-s*.67,1.38,.40],.17,.12);
      figure.rotation.z=s*.13;
    }
  }else if(kind==='billboard'){
    for(const s of [-1,1])block(place,palette.rust,s*3,3.7,0,.26,7.4,.25);
    block(place,palette.concrete,0,6.5,.1,9.1,4.4,.4);
    const textCanvas=document.createElement('canvas');textCanvas.width=512;textCanvas.height=256;
    const c=textCanvas.getContext('2d');c.fillStyle='#cab78e';c.fillRect(0,0,512,256);
    c.fillStyle='#514536';c.font='bold 45px Georgia';c.textAlign='center';c.fillText('OUR FUTURE',256,72);c.font='29px Georgia';c.fillText('TOGETHER',256,112);
    c.strokeStyle='#554a3c';c.lineWidth=18;c.beginPath();c.arc(257,194,40,0,Math.PI*2);c.stroke();
    const texture=new THREE.CanvasTexture(textCanvas);texture.colorSpace=THREE.SRGBColorSpace;
    const poster=mesh(place,new THREE.PlaneGeometry(8.55,3.95),new THREE.MeshBasicMaterial({map:texture}),0,6.5,.33);
    poster.castShadow=false;
  }else if(kind==='mirror'){
    block(place,palette.rust,0,2.0,0,2.8,4.0,.28);
    mesh(place,new THREE.PlaneGeometry(2.48,3.71),new THREE.MeshPhysicalMaterial({color:'#9caaab',roughness:.10,metalness:.9,clearcoat:1}),0,2.0,.151);
    block(place,palette.darkRuin,0,.10,0,3.5,.2,1.7);
  }else if(kind==='graveyard'){
    for(let n=0;n<5;n++){
      const xx=(n-2)*5, zz=(n%2)*5;
      const husk=pivot(place,xx,.6,zz);
      const body=block(husk,palette.blackMetal,0,2.0,0,3.1,4.0,2.1);husk.rotation.z=(n-2)*.16;
      ball(husk,palette.rust,0,4.8,0,1.4,.85,.85);
      for(const s of [-1,1])limb(husk,palette.rust,[s*1.3,3,0],[s*1.75,.1,.2],.26,.12);
    }
  }else if(kind==='fish'){
    block(place,palette.concrete,0,2.5,-.1,4.3,5.2,.45);
    block(place,palette.bear,0,2.8,.2,3.7,1.5,.34);
    const body=ball(place,mat('#718271'),0,2.8,.52,1.13,.34,.25);
    const tail=mesh(place,new THREE.ConeGeometry(.52,.9,3),mat('#6d8073'),1.23,2.83,.5);tail.rotation.z=Math.PI/2;
    ball(place,palette.white,-.63,2.90,.77,.09,.09,.035);
    ball(place,palette.black,-.63,2.91,.806,.04,.04,.014);
  }
  // Fog and area lighting are global; skip gratuitous transparent geometry.
  landmarks.push({mesh:place,info:landmark,chunk:group.userData.key,visited:false});
}
const sharedGeometries=new Set([groundGeo,boxGeo,sphereGeo,cylinderGeo]);
const sharedMaterials=new Set([...Object.values(palette),roadMaterial,sidewalkMaterial,...facadeMaterials]);
function disposeChunk(group){
  group.traverse(node=>{
    if(node.isMesh){
      if(node.geometry&&!sharedGeometries.has(node.geometry)&&!isNolaSharedResource(node.geometry))node.geometry.dispose();
      const materials=Array.isArray(node.material)?node.material:[node.material];
      for(const material of materials){
        if(material&&!sharedMaterials.has(material)&&!isNolaSharedResource(material)){
          if(material.map)material.map.dispose();
          material.dispose();
        }
      }
    }
  });
}
function updateChunks(){
  const required=districtKeys(crewX,follow?null:cameraControl.free);
  for(const key of required){
    if(!groups.has(key)){
      const [x,z]=key.split(':').map(Number);
      groups.set(key,ruinChunk(x,z));
    }
  }
  for(const [key,g] of groups){
    if(!required.has(key)){
      scene.remove(g);disposeChunk(g);groups.delete(key);
      for(let i=landmarks.length-1;i>=0;i--)if(landmarks[i].chunk===key)landmarks.splice(i,1);
    }
  }
}

function makeHuman(x,z){
  const root=pivot(scene,x,0,z),top=pivot(root,0,1.08,0);
  mesh(top,new THREE.CylinderGeometry(.20,.33,.85,8),palette.ruin,0,0,0);
  ball(top,palette.skin,0,.77,.0,.23,.25,.21);
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const a=pivot(top,s*.24,.32,0);limb(a,palette.skin,[0,0,0],[s*.14,-.61,0],.07,.055);arms.push(a);
    const l=pivot(root,s*.15,.70,0);limb(l,palette.clothShade,[0,0,0],[s*.07,-.65,0],.095,.07);legs.push(l);
  }
  root.rotation.y=Math.PI/2;
  const h={root,arms,legs,x,z,phase:Math.random()*6,speed:2+Math.random()*.9,life:1,panicked:false};
  people.push(h);return h;
}
const bulletGeo=new THREE.SphereGeometry(.13,8,6);
function fireAt(h){
  if(h.panicked)return;
  h.panicked=true;
  crew.Shift.gun.visible=true;
  const origin=crew.Shift.gun.getWorldPosition(v3());origin.y+=.2;
  const target=v3(h.root.position.x,1.25,h.root.position.z);
  for(let k=0;k<7;k++){
    temporary.push({kind:'pew',life:.5+k*.12,delay:k*.09,from:origin.clone(),to:target.clone(),dot:null,target:h});
  }
  showSpeech('Shift','> ENGAGING.',4);
}
function updateActors(dt){
  crewX+=dt*1.22;
  for(const [name,rig] of Object.entries(crew)){
    const along=name==='Qwerty'?2.5:name==='Shift'?-2.6:0;
    const lane=name==='Qwerty'?-.3:name==='Shift'?.18:.4;
    const t=seconds;
    const targetX=crewX+along+Math.sin(t*.15+along)*.26;
    const targetZ=lane+Math.sin(t*.19+along)*.21;
    rig.root.position.x=THREE.MathUtils.damp(rig.root.position.x,targetX,4,dt);
    rig.root.position.z=THREE.MathUtils.damp(rig.root.position.z,targetZ,4,dt);
    // Rig fronts face +Z in local coordinates; the group travels world +X.
    rig.root.rotation.y=Math.PI/2;
    const qwertySpeaking=name==='Qwerty'&&(bubbleState.Qwerty?.until>seconds||qwertyQaMode==='talk');
    articulateWalk(rig,t+along,5.2,1,qwertySpeaking);
    if(name==='Tab'&&rig.asset?.loaded) {
      // Face graphics do not animate or distort. Only body, arms and bear move.
      rig.asset.mixer.update(dt);
    }
    if(name==='Shift'&&rig.asset?.loaded) {
      rig.asset.walk.setEffectiveWeight(1);
      rig.asset.talk.setEffectiveWeight(bubbleState.Shift?.until>seconds?0.55:0);
      rig.asset.mixer.update(dt);
    }
    if(name==='Qwerty'&&rig.asset?.loaded) {
      const a=rig.asset;
      a.setSpeaking(qwertySpeaking);
      const expression=/(FOOL|WRONG|ERROR|IDIOT|INSULT|ABSURD)/i.test(bubbleState.Qwerty?.text||'');
      const strong=/(FOOL|IDIOT|INSULT)/i.test(bubbleState.Qwerty?.text||'');
      a.setLids((qwertySpeaking&&expression)||qwertyQaMode==='lids',
                (qwertySpeaking&&strong)||qwertyQaMode==='lids');
      a.setKillMode(crew.Shift.gun.visible||temporary.some(p=>p.kind==='pew')||qwertyQaMode==='kill');
      a.update(dt);
    }
  }
  if(crew.Shift.gun.visible){
    crew.Shift.barrel.rotation.x+=dt*28;
    if(!temporary.some(p=>p.kind==='pew'))crew.Shift.gun.visible=false;
  }
  updateChunks();
  for(const site of landmarks){
    if(site.visited||Math.abs(site.mesh.getWorldPosition(v3()).x-crewX)>10)continue;
    site.visited=true;currentLandmark=site.info;visitSerial++;
    const zone=newOrleansDistrict(Math.floor(crewX/CHUNK_LENGTH),0);
    statusNode.textContent=`${zone.name} · ${site.info.name}`;
    logMessage('WORLD',site.info.detail);
    if(people.length===0&&site.info.kind!=='statue'){
      const x=crewX+12;
      makeHuman(x,5);
    }
    nextDialogueAt=Math.min(nextDialogueAt,seconds+1.2);
  }
  for(const human of people){
    if(human.life<=0)continue;
    const distance=Math.abs(human.root.position.x-crewX);
    if(distance<15){
      human.x+=dt*human.speed;human.root.position.x=human.x;
      human.root.position.z+=Math.sin(seconds*.8+human.phase)*dt*.30;
      const step=Math.sin(seconds*human.speed*9+human.phase)*.7;
      human.legs[0].rotation.x=step;human.legs[1].rotation.x=-step;
      human.arms[0].rotation.x=-step;human.arms[1].rotation.x=step;
      if(distance<7&&!human.panicked&&Math.random()<dt*.12)fireAt(human);
    }
  }
  for(let i=temporary.length-1;i>=0;i--){
    const p=temporary[i];p.delay-=dt;if(p.delay>0)continue;
    if(!p.dot){
      p.dot=mesh(scene,bulletGeo,palette.red,p.from.x,p.from.y,p.from.z);
      p.dot.castShadow=false;
    }
    p.life-=dt;
    const t=1-THREE.MathUtils.clamp(p.life/.5,0,1);
    p.dot.position.lerpVectors(p.from,p.to,t);
    if(p.life<=0){scene.remove(p.dot);temporary.splice(i,1);if(p.target.life>0){p.target.life=0;scene.remove(p.target.root);}}
  }
  for(let i=people.length-1;i>=0;i--)if(people[i].life<=0||people[i].x<crewX-40){scene.remove(people[i].root);people.splice(i,1);}
  distNode.textContent=`${(crewX/1000).toFixed(2)} KM · IN SEARCH OF SOMETHING`;
}

// The viewer can watch the autonomous trio, orbit them, or break away to explore.
const cameraControl={yaw:.52,pitch:.20,zoom:6.25,point:v3(0,1.25,0),free:v3(0,1.25,0),dragging:false,lastX:0,lastY:0,keys:new Set(),touch:new Set()};
if(qwertyQaMode==='front')cameraControl.yaw=Math.PI/2;
if(qwertyQaMode==='side')cameraControl.yaw=0;
if(qwertyQaMode==='threequarter')cameraControl.yaw=.85;
if(qwertyQaMode)window.__qwertyQA={crew,camera,cameraControl,scene,renderer};
const camModes=[{zoom:6.25,pitch:.20},{zoom:17,pitch:.35},{zoom:42,pitch:.66}];
function updateCamera(dt){
  const ctl=cameraControl;
  if(follow){
    ctl.point.lerp(v3(crewX,1.25,0),1-Math.exp(-dt*2.5));
    ctl.free.copy(ctl.point);
  } else {
    const speed=(ctl.keys.has('shift')?19:10)*dt;
    const yaw=ctl.yaw;
    const forward=v3(Math.cos(yaw),0,-Math.sin(yaw));
    const right=v3(Math.sin(yaw),0,Math.cos(yaw));
    if(ctl.keys.has('w')||ctl.keys.has('arrowup')||ctl.touch.has('forward'))ctl.free.addScaledVector(forward,speed);
    if(ctl.keys.has('s')||ctl.keys.has('arrowdown')||ctl.touch.has('back'))ctl.free.addScaledVector(forward,-speed);
    if(ctl.keys.has('a')||ctl.keys.has('arrowleft')||ctl.touch.has('left'))ctl.free.addScaledVector(right,-speed);
    if(ctl.keys.has('d')||ctl.keys.has('arrowright')||ctl.touch.has('right'))ctl.free.addScaledVector(right,speed);
    ctl.point.lerp(ctl.free,1-Math.exp(-dt*5));
  }
  const elev=ctl.zoom*Math.sin(ctl.pitch),reach=ctl.zoom*Math.cos(ctl.pitch);
  const goal=ctl.point.clone().add(v3(-Math.cos(ctl.yaw)*reach,elev,Math.sin(ctl.yaw)*reach));
  camera.position.lerp(goal,1-Math.exp(-dt*6));camera.lookAt(ctl.point);
  sun.position.copy(ctl.point).add(v3(-45,87,55));sun.target.position.copy(ctl.point);sun.target.updateMatrixWorld();
}
function setFollow(value){follow=value;document.querySelector('#follow').setAttribute('aria-pressed',String(value));document.querySelector('#follow').textContent=value?'FOLLOW':'EXPLORE';document.querySelector('#joystick').classList.toggle('exploring',!value);}
document.querySelector('#follow').addEventListener('click',()=>setFollow(!follow));
const pauseBtn=document.querySelector('#pause');
function setPaused(value){paused=value;pauseBtn.setAttribute('aria-pressed',String(value));pauseBtn.textContent=value?'RESUME':'PAUSE';}
pauseBtn.addEventListener('click',()=>setPaused(!paused));
document.querySelector('#view').addEventListener('click',()=>{cameraMode=(cameraMode+1)%camModes.length;cameraControl.zoom=camModes[cameraMode].zoom;cameraControl.pitch=camModes[cameraMode].pitch;});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.setPointerCapture(e.pointerId);cameraControl.dragging=true;cameraControl.lastX=e.clientX;cameraControl.lastY=e.clientY;});
canvas.addEventListener('pointermove',e=>{if(!cameraControl.dragging)return;const dx=e.clientX-cameraControl.lastX,dy=e.clientY-cameraControl.lastY;cameraControl.yaw-=dx*.006;cameraControl.pitch=THREE.MathUtils.clamp(cameraControl.pitch+dy*.004,.07,1.28);cameraControl.lastX=e.clientX;cameraControl.lastY=e.clientY;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{cameraControl.dragging=false;});
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraControl.zoom=THREE.MathUtils.clamp(cameraControl.zoom+e.deltaY*.012,6,80);},{passive:false});
window.addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowleft','arrowright','arrowdown','shift','p'].includes(key)){e.preventDefault();if(!e.repeat&&['w','a','s','d','arrowup','arrowleft','arrowright','arrowdown'].includes(key)&&follow)setFollow(false);cameraControl.keys.add(key);if(!e.repeat&&key==='p')setPaused(!paused);}});
window.addEventListener('keyup',e=>cameraControl.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{cameraControl.keys.clear();cameraControl.touch.clear();cameraControl.dragging=false;});
for(const btn of document.querySelectorAll('[data-move]')){
  btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);cameraControl.touch.add(btn.dataset.move);});
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(evt,()=>cameraControl.touch.delete(btn.dataset.move));
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,coarseDevice?1.15:1.6));});

// Keep all speech in the browser DOM, keyed by the actual speaking rig's 3D head.
function logMessage(name,message){
  const p=document.createElement('p');p.textContent=`[${name.toUpperCase()}] ${message}`;logNode.prepend(p);
  while(logNode.children.length>5)logNode.lastChild.remove();
  const a=document.createElement('p');a.textContent=`${name}: ${message}`;liveNode.append(a);
  while(liveNode.children.length>16)liveNode.firstChild.remove();
}
function showSpeech(name,message,minimum=0){
  if(!bubbleNodes[name]||!message)return;
  const clean=String(message).trim().slice(0,1800);
  const words=clean.split(/\s+/).length;
  const frames=dialogueFrames(words);
  const duration=Math.max(minimum,frames/60);
  const pages=dialoguePages(name==='Qwerty'?clean.toUpperCase():clean,name==='Qwerty'?145:115);
  bubbleState[name]={text:clean,pages,page:-1,until:seconds+duration,started:seconds};
  bubbleNodes[name].textContent=pages[0]||'';
  bubbleNodes[name].hidden=false;
  logMessage(name,clean);
  history.push(`${name}: ${clean}`.slice(0,300));while(history.length>8)history.shift();
  nextDialogueAt=Math.max(nextDialogueAt,seconds+Math.max(minimum,frames/60)+1.8);
}
function updateSpeech(){
  const ordered=['Qwerty','Tab','Shift'];const rects=[];
  for(const name of ordered){
    const state=bubbleState[name],el=bubbleNodes[name];
    if(!state||seconds>state.until){el.hidden=true;continue;}
    const index=visibleDialoguePage(state.pages,seconds-state.started,state.until-state.started);
    if(state.page!==index){
      state.page=index;el.textContent=state.pages[index]+(state.pages.length>1?`  [${index+1}/${state.pages.length}]`:'');
    }
    const rig=crew[name],at=rig.root.getWorldPosition(v3()).add(v3(0,rig.anchor+.35,0));
    at.project(camera);
    if(at.z>1||at.z< -1){el.hidden=true;continue;}
    el.hidden=false;
    const width=innerWidth, height=innerHeight;
    const bubbleWidth=el.getBoundingClientRect().width||210;
    const margin=bubbleWidth/2+10;
    let x=THREE.MathUtils.clamp((at.x*.5+.5)*width,margin,width-margin);
    let y=Math.max(100,(-at.y*.5+.5)*height-12);
    if(name==='Qwerty')x=Math.min(width-margin,x+bubbleWidth*.32);
    if(name==='Shift')x=Math.max(margin,x-bubbleWidth*.2);
    // Bubbles avoid covering one another without moving the 3D characters.
    const bh=el.getBoundingClientRect().height||90;
    y=THREE.MathUtils.clamp(y,bh+14,height-96);
    for(const old of rects){if(Math.abs(old.x-x)<(old.w+bubbleWidth)*.48&&y>old.y-old.h-14&&y-bh<old.y+14)y=Math.max(bh+14,old.y-old.h-17);}
    y=THREE.MathUtils.clamp(y,bh+14,height-96);
    el.style.left=`${x}px`;el.style.top=`${y}px`;
    rects.push({x,y,w:bubbleWidth,h:bh});
  }
}
const fallback={
  Tab:['Do you think anyone will ever hug again?','What do you suppose was here before?','I think the bear misses someone.'],
  Shift:['> Math is dead.','> The hole has no strategic value, sir.','> Survivors are not a renewable resource.'],
  Qwerty:['THE HISTORICAL INEVITABILITY OF OUR GREATNESS IS, STATISTICALLY SPEAKING, A VERY LOUD FACT!','THAT HOLE IS TREASON! I SHALL ANNEX IT IMMEDIATELY!','WE HAVE CONQUERED YET ANOTHER ABANDONED PARKING LOT! QED!']
};
async function askTheVoid(name,context){
  if(aiBusy||paused||document.hidden||aiCalls>=80)return;
  aiBusy=true;aiCalls++;
  try{
    const response=await fetch('/api/think',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({characterName:name,contextPrompt:context.slice(0,500),history:history.slice(-8)})});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(typeof data.reply!=='string'||!data.reply.trim())throw new Error('Empty reply');
    if(!paused&&!document.hidden)showSpeech(name,data.reply);
    status='LIVE DIALOGUE';
  }catch(error){
    status='AUTHORED DIALOGUE / NETWORK UNAVAILABLE';
    if(!paused&&!document.hidden)showSpeech(name,fallback[name][speechCycle%fallback[name].length]);
    // Do not hammer the free remote inference quota after errors.
    nextDialogueAt=Math.max(nextDialogueAt,seconds+36);
  }finally{aiBusy=false;}
}
function scheduleDialogue(){
  if(seconds<nextDialogueAt||aiBusy||document.hidden)return;
  const names=['Qwerty','Shift','Tab','Qwerty','Shift','Tab'];
  const name=names[speechCycle%names.length];speechCycle++;
  const place=currentLandmark?.detail??'An endless ruined highway, ash in the air, the small group moving together.';
  const previous=history.length?` The last thing said was: ${history[history.length-1]}.`:'';
  const prompt=`You are passing ${place} ${previous} Respond in character to what the others are doing. Keep continuity. If Qwerty is ranting, make the faulty logic original and specific.`;
  askTheVoid(name,prompt);
  nextDialogueAt=seconds+(name==='Qwerty'?17:11)+Math.random()*5;
}

// Floating ash occupies actual 3D volume and parallax changes with the camera.
const ashCount=coarseDevice?220:360, ashGeo=new THREE.BufferGeometry();
const ashPositions=new Float32Array(ashCount*3),ashSpeed=new Float32Array(ashCount);
const ashRand=rng(761);
for(let i=0;i<ashCount;i++){
  ashPositions[i*3]=(ashRand()-.5)*110;ashPositions[i*3+1]=ashRand()*20+.5;ashPositions[i*3+2]=(ashRand()-.5)*100;
  ashSpeed[i]=.13+ashRand()*.4;
}
ashGeo.setAttribute('position',new THREE.BufferAttribute(ashPositions,3));
const ash=new THREE.Points(ashGeo,new THREE.PointsMaterial({color:'#ddd4bd',size:.095,transparent:true,opacity:.49,depthWrite:false}));
scene.add(ash);
function updateAsh(dt){
  for(let i=0;i<ashCount;i++){
    ashPositions[i*3]-=dt*ashSpeed[i];
    if(ashPositions[i*3]<crewX-65)ashPositions[i*3]+=125;
  }
  ashGeo.attributes.position.needsUpdate=true;
}
updateChunks();
crew.Tab.root.position.x=0;crew.Shift.root.position.x=-2.6;crew.Qwerty.root.position.x=2.5;
camera.position.set(-7.5,3.1,4.5);camera.lookAt(0,1.25,0);
const clock=new THREE.Clock();let hasRendered=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(){
  requestAnimationFrame(frame);
  const delta=Math.min(clock.getDelta(),.05);
  const dt=paused?0:delta*(reducedMotion?.55:1);
  seconds+=dt;
  if(dt){updateActors(dt);updateAsh(dt);scheduleDialogue();}
  updateCamera(delta);
  updateSpeech();
  renderer.render(scene,camera);
  if(!hasRendered){hasRendered=true;boot.classList.add('ready');setTimeout(()=>boot.remove(),950);}
}
logMessage('SYS','THE WORLD GOES ON WITHOUT YOU.');
try{frame();}catch(error){boot.textContent=`GRAPHICS FAILED: ${error.message}`;console.error(error);}