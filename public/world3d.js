import * as THREE from './vendor/three.module.js';
import { CHUNK_LENGTH, rng, landmarkForChunk, dialogueFrames } from './world-logic.js';

// Everything in the scene is actual geometry. No flat sprites or pasted-on characters.
const canvas = document.querySelector('#world');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
const coarseDevice=matchMedia('(pointer:coarse)').matches || innerWidth < 700;
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarseDevice ? 1.15 : 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !coarseDevice;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.37;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b1a287');
scene.fog = new THREE.FogExp2('#b1a287', .0067);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, .08, 550);
const hemi = new THREE.HemisphereLight('#ffe0af', '#252b28', 2.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff2c6', 3.15);
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
  concrete:mat('#958d7c'), statue:mat('#a7a497'), bear:mat('#775031'), bearFace:mat('#c69c75')
};
const groundGeo = new THREE.PlaneGeometry(CHUNK_LENGTH+.3, 154, 11, 16);
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

function createTab(){
  const root=new THREE.Group();root.name='Tab';scene.add(root);
  const torso=pivot(root,0,1.07,0);
  const dress=mesh(torso,new THREE.CylinderGeometry(.22,.54,1.0,7,1),palette.cloth,0,.05,0,1,1,.84);
  edge(torso,dress,'#2e2b28');
  block(torso,palette.clothShade,0,.46,.02,.46,.1,.31);
  const neck=block(torso,palette.skin,0,.54,0,.18,.27,.19);
  const head=pivot(torso,0,1.01,0);
  const box=block(head,palette.cardboard,0,.02,0,.83,.83,.82);edge(head,box,'#4e3727');
  block(head,palette.cardboardSide,-.44,.09,0,.018,.75,.82);
  block(head,palette.cardboardEdge,-.005,.43,.01,.85,.025,.84);
  // Cardboard flaps give the box actual depth, rather than a flat mask.
  const flapL=block(head,palette.cardboard,.0,-.39,.42,.98,.10,.28);flapL.rotation.x=-.36;
  const flapR=block(head,palette.cardboard,0,-.39,-.42,.98,.08,.24);flapR.rotation.x=.23;
  for(const x of [-.19,.19]){
    ball(head,palette.black,x,.14,.424,.083,.085,.015);
    ball(head,palette.white,x-.026,.17,.445,.019,.021,.007);
  }
  for(const s of [-1,1]){
    const brow=slab(head,palette.black,s*.19,.29,.444,.29,.034,.033,s*.32);
  }
  block(head,palette.white,0,-.17,.44,.49,.19,.023);
  for(let i=-2;i<=2;i++)block(head,palette.black,i*.086,-.17,.459,.018,.19,.014);
  block(head,palette.black,0,-.17,.468,.5,.012,.013);
  // Printed arrow on the left face.
  const arrow=block(head,palette.cardboardEdge,-.455,.06,-.03,.009,.28,.035);
  block(head,palette.cardboardEdge,-.457,-.09,-.03,.012,.09,.2);
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const arm=pivot(torso,s*.31,.42,0);
    limb(arm,palette.skin,[0,0,0],[s*.12,-.49,.045],.115,.083);
    ball(arm,palette.skin,s*.12,-.52,.045,.102,.10,.09);arms.push(arm);
    const leg=pivot(root,s*.21,.78,0);
    limb(leg,palette.skin,[0,0,0],[s*.017,-.64,0],.115,.085);
    const shoe=ball(leg,palette.black,s*.025,-.69,.12,.17,.065,.27);legs.push(leg);
  }
  const teddy=pivot(arms[1],.2,-.58,.16);
  ball(teddy,palette.bear,0,-.17,0,.18,.22,.13);
  ball(teddy,palette.bear,0,.10,0,.17,.18,.15);
  for(const s of [-1,1])ball(teddy,palette.bear,s*.13,.23,0,.079,.08,.077);
  ball(teddy,palette.bearFace,0,.07,.145,.10,.064,.025);
  ball(teddy,palette.black,0,.075,.169,.029,.021,.016);
  return {root,head,torso,arms,legs,teddy,anchor:2.85};
}
function createShift(){
  const root=new THREE.Group();root.name='Shift';scene.add(root);
  const torso=pivot(root,0,.46,0);
  let body=block(torso,palette.robot,0,0,0,.52,.7,.38);edge(torso,body,'#252526');
  block(torso,palette.graphite,0,.01,.201,.31,.35,.026);
  block(torso,palette.robotLight,0,.01,.218,.18,.25,.02);
  const neck=block(torso,palette.black,0,.39,0,.25,.25,.25);
  const head=pivot(torso,0,.57,0);
  const dome=mesh(head,new THREE.SphereGeometry(.73,32,16,0,Math.PI*2,0,Math.PI/2),palette.robot,0,0,0,1,1,.94);
  const ring=mesh(head,new THREE.CylinderGeometry(.73,.73,.11,32),palette.black,0,-.045,0,1,1,.94);
  const brow=block(head,palette.graphite,0,.20,.617,1.06,.29,.12);
  for(const s of [-1,1]){
    const eye=block(head,palette.white,s*.32,.205,.69,.38,.14,.031);
    eye.rotation.z=s*.10;
  }
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const arm=pivot(torso,s*.36,.26,0);
    limb(arm,palette.black,[0,0,0],[s*.14,-.45,.01],.075,.065);
    ball(arm,palette.black,s*.14,-.49,.015,.11,.11,.1);arms.push(arm);
    const leg=pivot(root,s*.16,.25,0);
    limb(leg,palette.black,[0,0,0],[s*.03,-.23,0],.065,.06);
    ball(leg,palette.black,s*.05,-.24,.11,.14,.055,.20);legs.push(leg);
  }
  const gun=pivot(torso,.34,.30,.1);
  block(gun,palette.blackMetal,.37,0,0,.68,.23,.27);
  block(gun,palette.rust,.70,0,0,.28,.32,.32);
  const barrel=pivot(gun,.78,0,0);
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    const c=mesh(barrel,new THREE.CylinderGeometry(.042,.042,.96,7),palette.graphite,.44,Math.sin(a)*.10,Math.cos(a)*.10);
    c.rotation.z=-Math.PI/2;
  }
  gun.visible=false;
  return {root,head,torso,arms,legs,gun,barrel,anchor:1.89};
}
function trapezoidGeometry(){
  const shape=new THREE.Shape();
  shape.moveTo(-.94,-.50);shape.lineTo(.94,-.50);shape.lineTo(1.11,.54);shape.lineTo(-1.11,.54);shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.70,bevelEnabled:true,bevelThickness:.05,bevelSize:.06,bevelSegments:2,steps:1});
  geo.translate(0,0,-.35);return geo;
}
function createQwerty(){
  const root=new THREE.Group();root.name='Qwerty';scene.add(root);
  const torso=pivot(root,0,.43,0);
  const body=block(torso,palette.graphite,0,.02,0,.43,.65,.36);edge(torso,body,'#151515');
  block(torso,palette.black,0,0,.193,.20,.27,.022);
  const neck=block(torso,palette.black,0,.42,0,.21,.31,.2);
  const head=pivot(torso,0,.95,0);
  const huge=mesh(head,trapezoidGeometry(),palette.graphite);
  edge(head,huge,'#080808');
  for(const s of [-1,1]){
    const rim=ball(head,palette.black,s*.40,-.10,.42,.23,.25,.042);
    const eye=ball(head,palette.white,s*.40,-.10,.468,.173,.19,.021);
  }
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const arm=pivot(torso,s*.30,.23,0);
    limb(arm,palette.black,[0,0,0],[s*.25,-.40,.02],.075,.06);
    ball(arm,palette.black,s*.25,-.44,.02,.095,.10,.10);arms.push(arm);
    const leg=pivot(root,s*.15,.27,0);
    limb(leg,palette.black,[0,0,0],[s*.045,-.26,.02],.070,.06);
    ball(leg,palette.black,s*.06,-.26,.14,.13,.05,.19);legs.push(leg);
  }
  return {root,head,torso,arms,legs,anchor:2.17};
}
crew.Tab=createTab();crew.Shift=createShift();crew.Qwerty=createQwerty();
for(const [name,c] of Object.entries(crew))c.name=name;

function building(parent,x,z,w=6,h=14,d=9,seed=0){
  const r=rng(seed),gr=palette.ruin, dark=palette.darkRuin;
  const height=h*(.73+r()*.46);
  const base=block(parent,r()>.5?gr:dark,x,height*.5-.06,z,w,height,d);
  base.castShadow=false;
  block(parent,palette.rust,x,height,z,w*.98,.16,d*.98);
  const floors=Math.max(2,Math.floor(height/2.6));
  for(let f=1;f<floors;f++){
    if(r()<.2)continue;
    const yy=f*2.45;
    for(const s of [z<0?1:-1]){
      for(let j of [-1,1]){
        if(r()<.24)continue;
        block(parent,palette.glass,x+j*w*.25,yy,z+s*(d*.5+.012),w*.12,1.07,.05);
      }
    }
  }
  // Jagged remnants of floors and broken support beams.
  for(let n=0;n<3;n++){
    const slabX=x+(r()-.5)*w*.7;
    const slabY=height+r()*2.0;
    slab(parent,palette.concrete,slabX,slabY,z+(r()-.5)*d,w*(.16+r()*.15),.12,.8,(r()-.5)*1.2);
  }
  return base;
}
function deadTree(parent,x,z,r){
  const height=3+r()*3;
  const trunk=mesh(parent,new THREE.CylinderGeometry(.07,.28,height,6),palette.rust,x,height/2,z);
  trunk.rotation.z=(r()-.5)*.16;
  for(let i=0;i<3;i++){
    const y=height*(.58+i*.13),side=(i%2?1:-1);
    limb(parent,palette.rust,[x,y,z],[x+side*(1+r()),y+.8+r(),z+(r()-.5)],.11,.025);
  }
}
function ruinChunk(index){
  const rand=rng(index*19297+931),g=new THREE.Group();g.position.x=index*CHUNK_LENGTH;
  g.userData.index=index;scene.add(g);
  const ground=mesh(g,groundGeo,palette.sand,0,-.12,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  block(g,palette.dirt,0,-.09,0,CHUNK_LENGTH,.1,13.2).receiveShadow=true;
  for(const edgeZ of [-7.6,7.6]){
    block(g,palette.gravel,0,-.02,edgeZ,CHUNK_LENGTH,.10,1.4);
  }
  // Dashed lane marks are physical concrete chips.
  for(let xx=-CHUNK_LENGTH/2+3;xx<CHUNK_LENGTH/2;xx+=8){
    block(g,palette.concrete,xx,-.023,0,2.1,.018,.10);
  }
  for(const s of [-1,1]){
    for(let n=0;n<3;n++){
      const x=-19+n*18+rand()*6,z=s*(22+rand()*17);
      if(rand()<.73)building(g,x,z,5+rand()*5,5+rand()*20,5+rand()*8,index*99+n*12+s*334);
      else deadTree(g,x,z,rand);
      for(let j=0;j<4;j++){
        const xx=x+(rand()-.5)*20,zz=z+(rand()-.5)*18;
        const rubble=block(g,rand()>.5?palette.ruin:palette.rust,xx,.08+rand()*.22,zz,.25+rand()*1.2,.13+rand()*.48,.2+rand()*1.4);
        rubble.rotation.y=rand()*Math.PI;
      }
    }
  }
  const landmark=landmarkForChunk(index);
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
  landmarks.push({mesh:place,info:landmark,chunk:group.userData.index,visited:false});
}
const sharedGeometries=new Set([groundGeo,boxGeo,sphereGeo,cylinderGeo]);
const sharedMaterials=new Set(Object.values(palette));
function disposeChunk(group){
  group.traverse(node=>{
    if(node.isMesh){
      if(node.geometry&&!sharedGeometries.has(node.geometry))node.geometry.dispose();
      const materials=Array.isArray(node.material)?node.material:[node.material];
      for(const material of materials){
        if(material&&!sharedMaterials.has(material)){
          if(material.map)material.map.dispose();
          material.dispose();
        }
      }
    }
  });
}
function updateChunks(){
  const center=Math.floor(crewX/CHUNK_LENGTH);
  for(let n=center-2;n<=center+4;n++)if(!groups.has(n))groups.set(n,ruinChunk(n));
  for(const [n,g] of groups){
    if(n<center-2||n>center+4){scene.remove(g);disposeChunk(g);groups.delete(n);
      for(let i=landmarks.length-1;i>=0;i--)if(landmarks[i].chunk===n)landmarks.splice(i,1);
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
function actorWalk(rig,phase,speed,effort=1){
  const stride=Math.sin(phase*speed)*.60*effort;
  rig.legs[0].rotation.x=stride;rig.legs[1].rotation.x=-stride;
  rig.arms[0].rotation.x=-stride*.6;rig.arms[1].rotation.x=stride*.6;
  rig.torso.rotation.z=Math.sin(phase*speed*.5)*.022*effort;
  rig.head.rotation.z=Math.sin(phase*.54+rig.anchor)*.052;
  rig.head.rotation.y=Math.sin(phase*.43+rig.anchor)*.15;
  rig.root.position.y=.045+Math.abs(Math.sin(phase*speed))* .058*effort;
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
    actorWalk(rig,t+along,.95,1);
    if(name==='Qwerty'&&bubbleState.Qwerty?.until>seconds){
      rig.arms[0].rotation.z=-.6+Math.sin(t*13)*.33;
      rig.arms[1].rotation.z=.8+Math.cos(t*12)*.3;
      rig.head.rotation.z=Math.sin(t*10)*.12;
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
    statusNode.textContent=site.info.name;
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
const cameraControl={yaw:1.15,pitch:.31,zoom:18,point:v3(0,1.3,0),free:v3(0,1.3,0),dragging:false,lastX:0,lastY:0,keys:new Set(),touch:new Set()};
const camModes=[{zoom:18,pitch:.31},{zoom:10,pitch:.10},{zoom:35,pitch:.49}];
function updateCamera(dt){
  const ctl=cameraControl;
  if(follow){
    ctl.point.lerp(v3(crewX,1.3,0),1-Math.exp(-dt*2.5));
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
  bubbleState[name]={text:clean,until:seconds+Math.max(minimum,frames/60),started:seconds};
  bubbleNodes[name].textContent=name==='Qwerty'?clean.toUpperCase():clean;
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
    for(const old of rects){if(Math.abs(old.x-x)<(old.w+bubbleWidth)*.48&&y>old.y-old.h-14&&y-bh<old.y+14)y=Math.max(bh+14,old.y-old.h-17);}
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
camera.position.set(-12,8.5,16);camera.lookAt(0,1.2,0);
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
