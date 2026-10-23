import * as THREE from './vendor/three.module.js';
import {celShadeRobot} from './cel-robots.js';

/** Candidate motion rig. Keep separate from the live character until Q1.8. */
export function shortStrideClip(source, factor=.62) {
  if (!(factor>0 && factor<=1)) throw new RangeError('Stride factor must be 0..1');
  const clip=source.clone();
  clip.name='Qwerty_Walk_ShortStride';
  for(const track of clip.tracks) {
    if (!/(hip|knee)(L|R)\.quaternion$/.test(track.name)) continue;
    const values=track.values;
    for(let i=0;i<values.length;i+=4) {
      if(Math.abs(values[i+1])>1e-5||Math.abs(values[i+2])>1e-5)
        throw new Error('Unexpected walk axis: '+track.name);
      const half=Math.atan2(values[i],values[i+3])*factor;
      values[i]=Math.sin(half);
      values[i+3]=Math.cos(half);
    }
  }
  return clip;
}

/** Actual skinned GLB, four toon bands, unshaded 2D eyes, independently driven lids. */
export function createQwertyMotionRig(gltf) {
  const root=gltf.scene;
  const skull=root.getObjectByName('skull_upper');
  const fixedPlate=root.getObjectByName('base_plate');
  const left=root.getObjectByName('eyelidL');
  const right=root.getObjectByName('eyelidR');
  const clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
  for(const name of ['Qwerty_Walk','Qwerty_Talk_Flap','Qwerty_Left_Lid','Qwerty_Right_Lid'])
    if(!clips[name])throw Error('Missing Qwerty clip '+name);
  if(!skull||!fixedPlate||!left||!right)throw Error('Missing Qwerty skeleton');
  const {eyes}=celShadeRobot(root,'Qwerty');
  if(eyes.length!==1)throw Error('Qwerty must use one shared flat-eye material');
  let skinned=0;
  root.traverse(obj=>{if(obj.isSkinnedMesh)skinned++});
  if(!skinned)throw Error('Qwerty motion requires actual skinned GLB');
  const mixer=new THREE.AnimationMixer(root);
  const walk=mixer.clipAction(shortStrideClip(clips.Qwerty_Walk));
  const talk=mixer.clipAction(clips.Qwerty_Talk_Flap);
  const lidL=mixer.clipAction(clips.Qwerty_Left_Lid);
  const lidR=mixer.clipAction(clips.Qwerty_Right_Lid);
  for(const action of [walk,talk,lidL,lidR]) {
    action.setLoop(THREE.LoopRepeat,Infinity);
    action.play();
  }
  walk.setEffectiveWeight(1);
  talk.setEffectiveWeight(0);
  lidL.setEffectiveWeight(0);
  lidR.setEffectiveWeight(0);
  let speaking=false,lids=[false,false],killMode=false;
  function setSpeaking(value) {
    value=!!value;
    if(value===speaking)return;
    speaking=value;
    talk.reset().play();
    talk.setEffectiveWeight(value?1:0);
  }
  function setLids(l,r) {
    const next=[!!l,!!r];
    [lidL,lidR].forEach((action,i)=>{
      if(next[i]!==lids[i]) {
        action.reset().play();
        action.setEffectiveWeight(next[i]?1:0);
      }
    });
    lids=next;
  }
  function setKillMode(value) {
    killMode=!!value;
    eyes[0].color.set(killMode?'#ff1616':'#ffffff');
  }
  function update(seconds) {
    if(!Number.isFinite(seconds)||seconds<0)throw RangeError('Expected nonnegative delta');
    mixer.update(seconds);
  }
  return {root,skull,fixedPlate,eyes,mixer,walk,talk,lidL,lidR,
    setSpeaking,setLids,setKillMode,update,get speaking(){return speaking}};
}
