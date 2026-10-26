// S2.5: Shift's compact six-barrel wrist weapon.
// An isolated 3-D candidate assembly. The owner drawing shows NO idle weapon;
// no geometry is rendered while stowed. Deployment and rotor spin are separate.
import * as THREE from './vendor/three.module.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const BODY_COLOR=0x44464a;
const INK_COLOR=0x101114;
const NOZZLE_COLOR=0x6b6c71;

export function attachShiftConcealedMinigun(wristBone) {
  if(!wristBone?.isBone)throw new TypeError('S2.5 needs the existing wristR bone');
  const root=new THREE.Group();
  root.name='Shift.Weapon.Cradle';
  root.position.set(.022,-.012,.02);
  wristBone.add(root);

  const extend=new THREE.Group();
  extend.name='Shift.Weapon.TelescopingSlide';
  root.add(extend);
  const hinge=new THREE.Group();
  hinge.name='Shift.Weapon.DeployHinge';
  extend.add(hinge);

  const ink=new THREE.MeshLambertMaterial({name:'Shift/Limb_Black',color:INK_COLOR,flatShading:true});
  const steel=new THREE.MeshLambertMaterial({name:'Shift/Body_Graphite',color:BODY_COLOR,flatShading:true});
  const muzzleMetal=new THREE.MeshLambertMaterial({name:'Shift/Control_Light',color:NOZZLE_COLOR,flatShading:true});
  function add(geometry, material, name, parent, x=0, y=0, z=0) {
    const item=new THREE.Mesh(geometry,material);
    item.name=name;
    item.position.set(x,y,z);
    item.castShadow=true;
    item.receiveShadow=true;
    parent.add(item);
    return item;
  }

  // Flat mechanical receiver hinged under the right wrist. Unlike a long
  // external machine gun this stays deliberately compact relative to Shift.
  add(new THREE.BoxGeometry(.14,.095,.095),steel,'Shift.Weapon.Receiver',hinge,.038,0,0);
  add(new THREE.BoxGeometry(.085,.103,.108),ink,'Shift.Weapon.RearGuard',hinge,-.028,0,0);
  const breech=add(new THREE.CylinderGeometry(.049,.053,.08,12),
    steel,'Shift.Weapon.Breech',hinge,.106,0,0);
  breech.rotation.z=Math.PI/2;

  // The barrel cage rotates around its own X axis; the hinge does not.
  const rotor=new THREE.Group();
  rotor.name='Shift.Weapon.BarrelRotor';
  rotor.position.set(.138,0,0);
  hinge.add(rotor);
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3, y=Math.cos(angle)*.031,z=Math.sin(angle)*.031;
    const tube=add(new THREE.CylinderGeometry(.009,.009,.205,8),ink,
      `Shift.Weapon.Barrel.${i+1}`,rotor,.084,y,z);
    tube.rotation.z=-Math.PI/2;
    const tip=add(new THREE.CylinderGeometry(.012,.012,.017,8),muzzleMetal,
      `Shift.Weapon.Muzzle.${i+1}`,rotor,.187,y,z);
    tip.rotation.z=-Math.PI/2;
  }
  const retainer=add(new THREE.TorusGeometry(.043,.007,6,24),
    steel,'Shift.Weapon.FrontCollar',rotor,.164,0,0);
  retainer.rotation.y=Math.PI/2;
  const muzzle=new THREE.Object3D();
  muzzle.name='Shift.Weapon.MuzzleOrigin';
  muzzle.position.set(.215,0,0);
  rotor.add(muzzle);

  let progress=0;
  let target=0;
  let firing=false;
  const spindleSpeed=28; // radians per second independent of hinge motion

  // Deterministic pose is used in rendered acceptance frames and guarantees
  // exactly no visible weapon geometry in the canonical zero pose.
  function pose(amount, spinAngle=rotor.rotation.x){
    if(!Number.isFinite(amount)||!Number.isFinite(spinAngle))
      throw new RangeError('Weapon pose and spin angle must be finite');
    progress=clamp(amount,0,1);
    root.visible=progress>0;
    extend.position.x=progress===1?0:-.145*(1-progress);
    hinge.rotation.z=progress===1?0:-.80*(1-progress);
    // The slide physically extends; the receiver does not magically scale.
    // Visibility, not a tiny external model, provides strict idle silhouette.
    rotor.rotation.x=spinAngle;
    return progress;
  }
  function setDeployed(enabled){
    target=enabled?1:0;
    if(!enabled)firing=false;
  }
  function setFiring(enabled){
    firing=Boolean(enabled);
    if(firing)target=1;
  }
  function update(dt){
    if(!Number.isFinite(dt)||dt<0)throw new RangeError('dt must be nonnegative');
    const step=Math.min(dt,.1),smoothing=1-Math.exp(-step*12);
    const next=Math.abs(progress-target)<.0002?target
      :progress+(target-progress)*smoothing;
    const spin=rotor.rotation.x+((firing&&next>.96)?spindleSpeed*step:0);
    pose(next,spin);
    // Once fully stowed, ensure a deterministic idle pose.
    if(!target&&!progress)rotor.rotation.x=0;
  }
  function muzzleWorldPosition(out=new THREE.Vector3()){
    root.updateWorldMatrix(true,true);
    return muzzle.getWorldPosition(out);
  }
  pose(0,0);
  return Object.freeze({
    root, extend, hinge, rotor, muzzle, pose, update, setDeployed,
    setFiring, muzzleWorldPosition,
    get deployment(){return progress},
    get firing(){return firing},
    get barrelSpin(){return rotor.rotation.x},
    get barrelCount(){return 6}
  });
}
