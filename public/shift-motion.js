// S2.7: independent GLB clip mixer + S2.5 gun actuator for Shift.
// Shared by the production S28 GLB and the localhost S27 candidate.
// Installation validates every clip before retiring the procedural fallback.
import * as THREE from './vendor/three.module.js';
import {celShadeRobot} from './cel-robots.js';
import {attachShiftConcealedMinigun} from './shift-weapon.js';

const REQUIRED=['Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon'];

export function createShiftSequenceRig(gltf) {
  if(!gltf?.scene||!Array.isArray(gltf.animations))throw new TypeError('Expected parsed Shift GLB');
  const actionsByName=new Map(gltf.animations.map(c=>[c.name,c]));
  for(const name of REQUIRED)if(!actionsByName.has(name))throw new Error('Shift clip missing: '+name);
  const bones={};
  for(const name of ['head','root','wristR','armR','hipL','kneeL','ankleL','hipR','kneeR','ankleR']){
    bones[name]=gltf.scene.getObjectByName(name);
    if(!bones[name]?.isBone)throw new Error('Shift bone missing: '+name);
  }
  let skinned=0;
  gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skinned++});
  if(!skinned)throw new Error('Shift skinned mesh missing');
  const {eyes}=celShadeRobot(gltf.scene,'Shift');
  if(eyes.length!==1||eyes[0].type!=='MeshBasicMaterial'||
     eyes[0].color.getHexString()!=='ffffff')throw new Error('Shift eye graphics changed');
  const weapon=attachShiftConcealedMinigun(bones.wristR);
  celShadeRobot(weapon.root,'Shift');
  const mixer=new THREE.AnimationMixer(gltf.scene);
  const clips=Object.fromEntries(REQUIRED.map(name=>[name,mixer.clipAction(actionsByName.get(name))]));
  for(const action of Object.values(clips)){action.play();action.setEffectiveWeight(0);}
  clips.Shift_Weapon.setLoop(THREE.LoopOnce,1);
  clips.Shift_Weapon.clampWhenFinished=true;
  clips.Shift_Idle.setEffectiveWeight(1);
  let deployed=false;
  let elapsed=0;
  function update(dt,{walking=true,speaking=false,turning=false,deploy=false,firing=false}={}) {
    if(!Number.isFinite(dt)||dt<0||dt>.2)throw new RangeError('Invalid Shift update delta');
    elapsed+=dt;
    const active=Boolean(deploy||firing);
    if(active&&!deployed){
      clips.Shift_Weapon.reset().play();
    }
    if(!active&&deployed){
      clips.Shift_Weapon.stop().reset().play();
    }
    deployed=active;
    clips.Shift_Idle.setEffectiveWeight(walking?.18:1);
    clips.Shift_Walk.setEffectiveWeight(walking?1:0);
    clips.Shift_Talk.setEffectiveWeight(speaking?.55:0);
    clips.Shift_Turn.setEffectiveWeight(turning?.75:0);
    clips.Shift_Weapon.setEffectiveWeight(active?1:0);
    if(firing)weapon.setFiring(true);
    else if(active){weapon.setFiring(false);weapon.setDeployed(true);}
    else weapon.setDeployed(false);
    mixer.update(dt);
    weapon.update(dt);
    return {elapsed,weaponVisible:weapon.root.visible,barrelSpin:weapon.barrelSpin,
      deploying:weapon.deployment,clips:REQUIRED.slice()};
  }
  function dispose(){
    weapon.setFiring(false);
    weapon.pose(0,0);
    weapon.root.removeFromParent();
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  }
  return Object.freeze({
    model:gltf.scene,mixer,clips,weapon,bones,eyes,update,dispose,
    get actionNames(){return REQUIRED.slice()},
    get isDeployed(){return weapon.root.visible},
  });
}
