import * as THREE from './vendor/three.module.js';

// Physical, material-driven character models. Dimensions are metres before the
// per-character scale; the child, mechanisms, joints and surface wear are real
// meshes, not billboards. Their faces follow the owner's reference drawings.
const shared = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  rounded: new THREE.BoxGeometry(1, 1, 1, 3, 3, 3),
};
const texLoader = new THREE.TextureLoader();
const TEXTURES = '/assets/characters/';
function loadTexture(name, height = false) {
  const tex = texLoader.load(`${TEXTURES}${name}${height ? '-height' : ''}.webp`);
  tex.colorSpace = height ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
function material(name, color, roughness, metalness, bumpScale = 0.012) {
  return new THREE.MeshPhysicalMaterial({
    name, color, map: loadTexture(name), bumpMap: loadTexture(name, true), bumpScale,
    metalness, roughness, clearcoat: metalness > 0.2 ? 0.19 : 0,
    clearcoatRoughness: 0.83, side: THREE.FrontSide,
  });
}
const M = {
  cardboard: material('cardboard', '#ffffff', 0.98, 0, .018),
  dress: material('canvas', '#ffffff', 0.99, 0, .011),
  skin: material('skin', '#ffffff', .91, 0, .003),
  steel: material('nickel', '#ffffff', .67, .72, .017),
  iron: material('charcoal', '#ffffff', .87, .63, .013),
  rubber: material('rubber', '#ffffff', .98, 0, .012),
  bear: material('bear', '#ffffff', 1, 0, .018),
  face: new THREE.MeshStandardMaterial({map:loadTexture('box-face'),roughness:1}),
  label: new THREE.MeshStandardMaterial({map:loadTexture('box-side'),roughness:1}),
  seam: new THREE.MeshStandardMaterial({color:'#493929',roughness:.98}),
  oxide: new THREE.MeshStandardMaterial({color:'#634638',metalness:.46,roughness:.91}),
  dark: new THREE.MeshStandardMaterial({color:'#15191b',metalness:.36,roughness:.79}),
  eye: new THREE.MeshPhysicalMaterial({color:'#ebeee5',emissive:'#c9d1c6',emissiveIntensity:.62,roughness:.24,clearcoat:.7,metalness:.05}),
  glass: new THREE.MeshPhysicalMaterial({color:'#181b1c',metalness:.32,roughness:.18,clearcoat:1,clearcoatRoughness:.13}),
  dust: new THREE.MeshStandardMaterial({color:'#78675b',transparent:true,opacity:.5,roughness:1,depthWrite:false}),
  cotton: new THREE.MeshStandardMaterial({color:'#6b615c',roughness:.99,side:THREE.DoubleSide}),
};
function add(parent, geo, mat, x=0, y=0, z=0) {
  const out = new THREE.Mesh(geo, mat); out.position.set(x,y,z);
  out.castShadow=true;out.receiveShadow=true;parent.add(out);return out;
}
function group(parent,x=0,y=0,z=0) {
  const o = new THREE.Group();o.position.set(x,y,z);parent.add(o);return o;
}
function cube(parent,mat,x,y,z,w,h,d) {
  const out=add(parent,shared.rounded,mat,x,y,z);out.scale.set(w,h,d);return out;
}
function orb(parent,mat,x,y,z,w,h=w,d=w) {
  const o=add(parent,shared.sphere,mat,x,y,z);o.scale.set(w,h,d);return o;
}
function tube(parent,mat,a,b,r1,r2=r1,segments=16) {
  const dir=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const o=add(parent,new THREE.CylinderGeometry(r2,r1,dir.length(),segments,1),mat,
    (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return o;
}
function ring(parent,material,x,y,z,rx,ry,rz=.02){
  return orb(parent,material,x,y,z,rx,ry,rz);
}
function bolt(parent,x,y,z,rot=0){
  const head=add(parent,new THREE.CylinderGeometry(.027,.027,.011,12),M.oxide,x,y,z);
  head.rotation.x=Math.PI/2;head.rotation.z=rot;
  const slot=cube(parent,M.dark,x,y,z+.008,.027,.003,.003);slot.rotation.z=rot;
}
function wire(parent,a,b,r=.018,material=M.rubber){
  const c=new THREE.CatmullRomCurve3([new THREE.Vector3(...a),new THREE.Vector3(...b)]);
  return add(parent,new THREE.TubeGeometry(c,10,r,6,false),material);
}
function strap(parent,mat,x,y,z,w,h,d,rot=0){
  const o=cube(parent,mat,x,y,z,w,h,d);o.rotation.z=rot;return o;
}
// Irregular ring-loft mesh: an anatomical or draped silhouette, never a stack of cylinders.
function sculpt(parent,material,rings,radial=32,offset=[0,0,0],distress=.0){
  const vertices=[],uvs=[],indices=[];
  const twopi=Math.PI*2;
  for(let j=0;j<rings.length;j++){
    const [height,rx,rz,ox=0,oz=0]=rings[j];
    for(let i=0;i<=radial;i++){
      const t=i/radial,angle=t*twopi;
      const fold=1+distress*(.54*Math.cos(7*angle+j*.55)+.29*Math.sin(11*angle-j*.35));
      vertices.push(Math.cos(angle)*rx*fold+ox,height,Math.sin(angle)*rz*fold+oz);
      uvs.push(t,j/(rings.length-1));
    }
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<radial;i++){
    const a=j*(radial+1)+i,b=a+radial+1;
    if(rings[0][0]>rings[1][0]) indices.push(a,a+1,b,a+1,b+1,b);
    else indices.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  return add(parent,g,material,...offset);
}
function seam(parent,points,r=.004,material=M.seam){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const mesh=add(parent,new THREE.TubeGeometry(curve,Math.max(20,points.length*6),r,5,false),material);
  mesh.castShadow=false;return mesh;
}
function humanLeg(root,side){
  const hip=group(root,side*.19,.79,.005);
  const thigh=sculpt(hip,M.skin,[[0,.098,.107],[ -.11,.116,.115],[-.23,.119,.115],[-.32,.103,.102],[-.41,.089,.09]],24);
  const knee=group(hip,side*.012,-.395,0);
  orb(knee,M.skin,0,-.018,.015,.100,.099,.093);
  sculpt(knee,M.skin,[[ -.04,.094,.087],[-.12,.095,.09],[-.21,.084,.085],[-.31,.058,.069]],24);
  const ankle=group(knee,0,-.33,.016);
  const sock=sculpt(ankle,M.cotton,[[-.01,.068,.075],[-.05,.071,.079],[-.10,.065,.072]],24);
  const shoe=orb(ankle,M.rubber,0,-.06,.13,.15,.071,.25);
  cube(ankle,M.iron,0,-.017,.20,.16,.012,.28);
  for(let i=0;i<3;i++)strap(ankle,M.cotton,-.002,.004,.12+i*.048,.13,.012,.008);
  return {hip,knee,ankle,shoe};
}
function humanArm(torso,side){
  const shoulder=group(torso,side*.295,.39,.007);
  orb(shoulder,M.skin,side*.025,-.04,.02,.103,.125,.105);
  sculpt(shoulder,M.skin,[[-.06,.095,.09,side*.02],[-.16,.093,.086,side*.04],[-.31,.076,.08,side*.06]],24);
  const elbow=group(shoulder,side*.065,-.305,0);
  orb(elbow,M.skin,0,-.013,0,.072,.073,.07);
  sculpt(elbow,M.skin,[[-.015,.073,.069],[-.085,.083,.071],[-.22,.056,.057]],24);
  const wrist=group(elbow,0,-.23,.011);
  const hand=orb(wrist,M.skin,0,-.048,.02,.085,.108,.04);
  for(let f=0;f<4;f++){
    const x=(f-1.5)*.034;
    tube(wrist,M.skin,[x,-.12,.021],[x+(f-1.5)*.008,-.19+Math.abs(f-1.6)*.021,.04],.014,.010,10);
  }
  tube(wrist,M.skin,[side*.075,-.02,.015],[side*.135,-.11,.078],.028,.015,12);
  return {shoulder,elbow,wrist};
}
function skirt(parent){
  const rings=[];
  for(let i=0;i<=24;i++){
    const t=i/24,y=.45-t*.86;
    const r=.20+.30*Math.pow(t,1.22);
    const rx=r*(1+.03*Math.cos(t*18)),rz=r*.78;
    rings.push([y,rx,rz,0,0]);
  }
  const cloth=sculpt(parent,M.dress,rings,64,[0,0,0],.065);
  // Loose, uneven stitched hem and vertical wrinkles have actual relief.
  const hem=[];for(let i=0;i<=80;i++){
    const a=i*Math.PI*2/80,rad=.52*(1+.04*Math.cos(7*a));
    hem.push([Math.cos(a)*rad,-.42+.018*Math.sin(11*a),Math.sin(a)*rad*.78]);
  }
  seam(parent,hem,.006,M.cotton);
  for(let k=0;k<14;k++){
    const a=k*Math.PI*2/14;
    const pts=[];for(let j=0;j<9;j++){
      const t=j/8,rad=.2+.3*Math.pow(t,1.22);
      pts.push([rad*Math.cos(a),.43-t*.83,rad*.78*Math.sin(a)]);
    }
    seam(parent,pts,.0032,M.cotton);
  }
  return cloth;
}
function carton(parent){
  const size=.81,half=size/2,wall=.027;
  // Six thin planes model a real upside-down hollow box. No solid toy cube.
  cube(parent,M.cardboard,0,half,0,size,wall,size);
  cube(parent,M.face,0,0,half, size,size,wall);
  cube(parent,M.label,-half,0,0,wall,size,size);
  cube(parent,M.cardboard,half,0,0,wall,size,size);
  cube(parent,M.cardboard,0,0,-half,size,size,wall);
  const top=strap(parent,M.cotton,0,half+.017,0,.11,.007,size);
  for(const s of [-1,1]){
    const flap=group(parent,0,-half+.01,s*half);
    const panel=cube(flap,M.cardboard,0,-.047,s*.095,size*.98,.023,.25);
    panel.rotation.x=s*.18;
    seam(parent,[[-half,-half,s*half],[0,-half+.01,s*half],[half,-half,s*half]],.006,M.seam);
  }
  for(const s of [-1,1]){
    const flap=group(parent,s*half,-half+.01,0);
    const panel=cube(flap,M.cardboard,s*.10,-.045,0,.25,.025,size*.94);panel.rotation.z=-s*.24;
  }
  for(const x of [-half,half])for(const z of [-half,half]){
    cube(parent,M.seam,x,0,z,.02,size,.02);
  }
}
function teddy(hand) {
  const root=group(hand,0,-.065,.14);
  orb(root,M.bear,0,-.13,0,.12,.16,.09);
  orb(root,M.bear,0,.04,0,.13,.125,.11);
  for(const s of [-1,1]){
    orb(root,M.bear,s*.105,.13,0,.06,.064,.053);
    orb(root,M.bear,s*.13,-.12,0,.048,.10,.04);
    orb(root,M.bear,s*.058,-.30,0,.053,.08,.05);
  }
  orb(root,M.cotton,0,.015,.105,.068,.040,.02);
  orb(root,M.dark,0,.015,.124,.024,.02,.01);
  for(const s of [-1,1])orb(root,M.dark,s*.047,.075,.11,.012,.012,.011);
  return root;
}
function buildTab(scene){
  const root=group(scene);root.name='Tab';root.scale.setScalar(.66);
  const legs=[humanLeg(root,-1),humanLeg(root,1)];
  const torso=group(root,0,1.21,0);
  skirt(torso);
  sculpt(torso,M.dress,[[.37,.22,.15],[.47,.205,.135],[.54,.17,.105]],32);
  for(const s of [-1,1]){
    strap(torso,M.cotton,s*.16,.41,.10,.032,.24,.012,s*.12);
  }
  const arms=[humanArm(torso,-1),humanArm(torso,1)];
  const head=group(torso,0,1.02,0);
  carton(head);
  teddy(arms[1].wrist);
  return {root,torso,head,arms:arms.map(a=>a.shoulder),legs:legs.map(l=>l.hip),
    elbows:arms.map(a=>a.elbow),knees:legs.map(l=>l.knee),anchor:1.78,groundScale:.66};
}
function panel(parent,material,x,y,z,w,h,d){
  const o=cube(parent,material,x,y,z,w,h,d);return o;
}
function robotLimb(parent,side,long,metal,withHand=true){
  const shoulder=group(parent,side*.31,.28,0);
  orb(shoulder,M.iron,0,-.03,0,.11,.11,.11);
  tube(shoulder,M.rubber,[0,-.03,0],[side*.10,-.22,.01],.079,.063);
  tube(shoulder,metal,[side*.03,-.08,.02],[side*.09,-.22,.02],.069,.055);
  const elbow=group(shoulder,side*.11,-.22,.01);
  orb(elbow,M.steel,0,0,0,.077,.075,.079);
  tube(elbow,M.rubber,[0,-.03,0],[side*.05,-long,.04],.065,.047);
  panel(elbow,metal,side*.028,-long*.50,.035,.10,long*.65,.085);
  const hand=group(elbow,side*.05,-long,.035);
  orb(hand,M.iron,0,-.02,.0,.084,.085,.07);
  if(withHand){
    for(let i=0;i<3;i++){
      const xx=(i-1)*.045;
      tube(hand,M.rubber,[xx,-.05,.02],[xx,-.15,.065],.020,.012,10);
    }
  }
  wire(shoulder,[side*.11,-.1,-.01],[side*.12,-.30,-.045],.014);
  return {shoulder,elbow,hand};
}
function robotLeg(root,side,height=.32){
  const hip=group(root,side*.19,height,0);
  orb(hip,M.iron,0,0,0,.095,.095,.10);
  tube(hip,M.rubber,[0,-.02,0],[side*.026,-height*.45,0],.067,.049);
  panel(hip,M.steel,side*.014,-height*.23,.045,.1,height*.34,.09);
  const knee=group(hip,side*.027,-height*.46,0);
  orb(knee,M.iron,0,0,0,.07,.065,.078);
  tube(knee,M.rubber,[0,0,0],[0,-height*.47,.014],.050,.041);
  const foot=group(knee,0,-height*.47,.04);
  orb(foot,M.iron,0,-.018,.12,.115,.045,.23);
  panel(foot,M.steel,0,.008,.15,.13,.025,.18);
  return {hip,knee,foot};
}
// Fixed, UV-mapped two-dimensional eye graphics conform to the actual dome.
// No raised eye volumes, pupils, blinking controls or independently moving eyes.
function shiftDomeDecal(head,material,cx,cy,width,height,angle=0,offset=.006){
  const nx=12,ny=4,positions=[],uvs=[],indices=[];
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    const u=x/nx-.5,v=y/ny-.5;
    const dx=u*width,dy=v*height;
    const X=cx+Math.cos(angle)*dx-Math.sin(angle)*dy;
    const Y=cy+Math.sin(angle)*dx+Math.cos(angle)*dy;
    const R=.62;
    const Z=Math.sqrt(Math.max(.0001,R*R-X*X-Y*Y))+offset;
    positions.push(X,Y,Z);uvs.push(x/nx,y/ny);
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const a=y*(nx+1)+x,b=a+nx+1;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  return add(head,geo,material);
}
const shiftInk=new THREE.MeshBasicMaterial({color:'#0c1010',toneMapped:false,side:THREE.DoubleSide});
const shiftLight=new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false,side:THREE.DoubleSide});
function buildShift(scene){
  const root=group(scene);root.name='Shift';root.scale.setScalar(.46);
  const legs=[robotLeg(root,-1,.33),robotLeg(root,1,.33)];
  const torso=group(root,0,.54,0);
  const body=sculpt(torso,M.steel,[[-.29,.25,.19],[-.21,.27,.22],[.03,.27,.24],[.25,.19,.19],[.33,.14,.14]],40);
  const breast=panel(torso,M.iron,0,-.04,.236,.35,.38,.035);
  panel(torso,M.steel,0,-.015,.263,.245,.25,.024);
  panel(torso,M.glass,0,-.025,.28,.15,.165,.008);
  for(const s of [-1,1])for(let j=0;j<3;j++)bolt(torso,s*.155,-.18+j*.13,.259);
  const arms=[robotLimb(torso,-1,.21,M.steel),robotLimb(torso,1,.21,M.steel)];
  // Owner correction: shallow inverted-wok cap, circular from above.
  const head=group(torso,0,.26,0);head.scale.y=.56;
  const dome=add(head,new THREE.SphereGeometry(.62,64,40,0,Math.PI*2,0,Math.PI/2),M.steel,0,0,0);
  const rim=add(head,new THREE.TorusGeometry(.612,.034,12,64),M.iron,0,.003,0);
  rim.rotation.x=Math.PI/2;
  // Shift's eyes are stationary 2-D white graphics on the curved metal dome.
  // The shallow dark border is also a surface graphic, not a socket or lid.
  for(const side of [-1,1]){
    const angle=-side*.065;
    shiftDomeDecal(head,shiftInk,side*.315,.145,.454,.205,angle,.009);
    shiftDomeDecal(head,shiftLight,side*.315,.145,.370,.128,angle,.015);
  }
  for(let i=0;i<14;i++){
    const theta=i*Math.PI*2/14;
    bolt(head,Math.sin(theta)*.60,.02,Math.cos(theta)*.60,theta);
  }
  const neck=group(torso,0,.35,0);
  tube(neck,M.iron,[0,0,0],[0,.14,0],.14,.13);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    wire(torso,[Math.cos(a)*.11,.28,Math.sin(a)*.11],[Math.cos(a)*.15,.44,Math.sin(a)*.15],.017);
  }
  const gun=group(torso,.38,.04,.13);
  panel(gun,M.iron,.40,0,0,.86,.29,.34);
  const housing=add(gun,new THREE.CylinderGeometry(.22,.23,.30,24),M.steel,.86,0,0);housing.rotation.z=Math.PI/2;
  const barrel=group(gun,.96,0,0);
  for(let i=0;i<6;i++){
    const a=i*Math.PI*2/6;
    const t=tube(barrel,M.iron,[0,Math.cos(a)*.145,Math.sin(a)*.145],[.86,Math.cos(a)*.145,Math.sin(a)*.145],.041,.037,16);
    panel(barrel,M.steel,.72,Math.cos(a)*.145,Math.sin(a)*.145,.085,.075,.075);
  }
  add(gun,new THREE.TorusGeometry(.175,.036,8,28),M.oxide,1.08,0,0).rotation.y=Math.PI/2;
  gun.visible=false;
  return {root,torso,head,arms:arms.map(a=>a.shoulder),legs:legs.map(l=>l.hip),
    elbows:arms.map(a=>a.elbow),knees:legs.map(l=>l.knee),gun,barrel,anchor:.91,groundScale:.46};
}
// The boxy Canadian-style talking mechanism has two **separate** mesh shells.
// Both shell pieces have actual UVs from ExtrudeGeometry, not a texture mask.
function trapGeometry(bottom=-.47,top=.46){
  const xAt=y=>.64+((y+.47)/.93)*.21;
  const shape=new THREE.Shape();
  shape.moveTo(-xAt(bottom),bottom);
  shape.lineTo(xAt(bottom),bottom);
  shape.lineTo(xAt(top),top);
  shape.lineTo(-xAt(top),top);
  shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{
    depth:.46,bevelEnabled:true,bevelThickness:.02,
    bevelSize:.015,bevelSegments:3,steps:1,curveSegments:12
  });
  geo.translate(0,0,-.23);geo.computeVertexNormals();return geo;
}
function buildQwerty(scene){
  const root=group(scene);root.name='Qwerty';root.scale.setScalar(.27);
  const legs=[robotLeg(root,-1,.34),robotLeg(root,1,.34)];
  const torso=group(root,0,.55,0);
  sculpt(torso,M.iron,[[-.30,.19,.145],[-.22,.22,.17],[.03,.24,.19],[.23,.16,.14],[.31,.12,.12]],40);
  panel(torso,M.steel,0,-.045,.192,.32,.37,.055);
  panel(torso,M.iron,0,-.044,.228,.20,.22,.012);
  panel(torso,M.glass,0,-.044,.236,.13,.15,.01);
  for(const s of [-1,1])for(const y of [-.2,.14])bolt(torso,s*.16,y,.238);
  const arms=[robotLimb(torso,-1,.29,M.iron),robotLimb(torso,1,.29,M.iron)];
  const neck=group(torso,0,.30,0);
  tube(neck,M.iron,[0,0,0],[0,.22,0],.12,.14,24);
  for(let i=0;i<3;i++)add(neck,new THREE.TorusGeometry(.14+i*.012,.023,10,28),M.steel,0,.04+i*.07,0).rotation.x=Math.PI/2;
  const head=group(torso,0,.80,0);
  // Lower jaw stays attached to the neck. The top is hinged along the BACK edge
  // of the horizontal cut, and carries both eyes and its riveted metal housing.
  const splitY=-.095,backZ=-.23;
  add(head,trapGeometry(-.47,splitY),M.iron);
  panel(head,M.dark,0,splitY+.012,.205,1.38,.07,.064);
  const lid=group(head,0,splitY,backZ);
  const topShell=trapGeometry(splitY,.46);
  topShell.translate(0,-splitY,-backZ);
  add(lid,topShell,M.iron);
  // Aligned local origin for the accessories, but they travel with the lid.
  const face=group(lid,0,-splitY,-backZ);
  for(const s of [-1,1]){
    const socket=add(face,new THREE.CylinderGeometry(.205,.205,.045,48),M.dark,s*.33,.065,.285);
    socket.rotation.x=Math.PI/2;
    const glass=add(face,new THREE.CylinderGeometry(.175,.175,.045,48),M.glass,s*.33,.065,.31);
    glass.rotation.x=Math.PI/2;
    const white=add(face,new THREE.CylinderGeometry(.139,.139,.018,48),M.eye,s*.33,.065,.345);
    white.rotation.x=Math.PI/2;
    orb(face,M.glass,s*.31,.16,.359,.05,.045,.009);
    seam(face,[[s*.67,-.09,.26],[s*.78,.12,.26],[s*.84,.40,.26]],.011,M.oxide);
    bolt(face,s*.77,.35,.30);
    panel(face,M.steel,s*.80,.23,0,.04,.18,.21);
  }
  // Edge detailing is split with the physical seam: no decorations float
  // across Qwerty's face when the lid opens.
  for(let i=0;i<6;i++){
    const x=-.58+i*.235;
    orb(face,M.oxide,x,.36,.278,.014,.014,.009);
    orb(head,M.oxide,x,-.36,.278,.014,.014,.009);
  }
  const hinge=add(head,new THREE.CylinderGeometry(.033,.033,1.29,16),M.oxide,0,splitY,backZ-.016);
  hinge.rotation.z=Math.PI/2;
  return {root,torso,head,arms:arms.map(a=>a.shoulder),legs:legs.map(l=>l.hip),
    elbows:arms.map(a=>a.elbow),knees:legs.map(l=>l.knee),speechLid:lid,anchor:1.09,groundScale:.27};
}
export function createCharacters(scene) {
  const actors={Tab:buildTab(scene),Shift:buildShift(scene),Qwerty:buildQwerty(scene)};
  for(const [name,rig] of Object.entries(actors))rig.name=name;
  return actors;
}
export function articulateWalk(rig, t, speed, effort, talking = false){
  // Contralateral arm/leg timing with ground-clearance and articulated knees.
  const phase=t*speed, swing=Math.sin(phase)*.55*effort;
  for(let i=0;i<2;i++){
    const s=i?1:-1, foot=swing*s;
    rig.legs[i].rotation.x=foot*.77;
    rig.knees[i].rotation.x=Math.max(0,foot)*.74+.10;
    rig.arms[i].rotation.x=-foot*.48;
    rig.elbows[i].rotation.x= -.12-Math.max(0,-foot)*.19;
  }
  rig.torso.rotation.z=Math.sin(phase*.5)*.021*effort;
  rig.torso.rotation.x=Math.sin(phase)*.018*effort;
  rig.head.rotation.z=Math.sin(t*.54+rig.anchor)*.045;
  rig.head.rotation.y=Math.sin(t*.43+rig.anchor)*.11;
  rig.root.position.y=.025+Math.abs(Math.sin(phase))*.034*effort;
  if(rig.name==='Qwerty' && rig.speechLid){
    // Intentionally cartoonishly hard-cut cadence: South Park Canadian flaps,
    // but executed by a physical hinge on the realistic trapezoidal casing.
    // Only animate while THIS character's actual dialogue bubble is showing.
    const beats=Math.sin(t*17.5)+.39*Math.sin(t*11.2)+.19*Math.sin(t*29.3);
    const openness=talking?Math.min(1,Math.max(0,beats*.63+.46)):0;
    const target=-openness*.53;
    rig.speechLid.rotation.x += (target-rig.speechLid.rotation.x)*.42;
    rig.speechLid.position.y=-.095+openness*.035;
  }
  if(talking && rig.name==='Qwerty'){
    rig.arms[0].rotation.z=-.48+Math.sin(t*8)*.34;
    rig.arms[1].rotation.z=.60+Math.cos(t*11)*.37;
    rig.elbows[0].rotation.x=-.66;
    rig.elbows[1].rotation.x=-.54;
    rig.head.rotation.z=Math.sin(t*8)*.10;
  }else{rig.arms[0].rotation.z=rig.arms[1].rotation.z=0;}
}