import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createTabMotionRig} from '../public/tab-motion.js';

const parts={
  root:[null,[0,0,0]],spine:['root',[0,1.30,0]],chest:['spine',[0,.36,0]],
  neck:['chest',[0,.25,0]],head:['neck',[0,.07,0]],
  'shoulder.L':['chest',[-.22,.12,0]],'elbow.L':['shoulder.L',[-.16,-.32,.02]],
  'shoulder.R':['chest',[.23,.12,0]],'elbow.R':['shoulder.R',[.10,-.43,.015]],
  'wrist.R':['elbow.R',[.015,-.28,.045]],'hand.R':['wrist.R',[0,-.06,0]],
  bear:['hand.R',[.06,-.12,.09]],
  'hip.L':['root',[-.135,1.19,0]],'knee.L':['hip.L',[-.005,-.527,.023]],
  'ankle.L':['knee.L',[.005,-.518,.011]],
  'hip.R':['root',[.135,1.19,0]],'knee.R':['hip.R',[.005,-.527,.023]],
  'ankle.R':['knee.R',[-.005,-.518,.011]]
};
function fixture({animated=false}={}){
  const scene=new THREE.Group(),character=new THREE.Group();character.add(scene);
  character.rotation.y=Math.PI/2;
  const names=new Map();
  for(const [name,[parent,point]] of Object.entries(parts)){
    const bone=new THREE.Bone();bone.name=name.replaceAll('.','');
    bone.position.set(...point);names.set(name,bone);
    if(parent)names.get(parent).add(bone);else scene.add(bone);
  }
  const dummy=new THREE.Group();dummy.isSkinnedMesh=true;scene.add(dummy);
  const animations=['Tab_Walk','Tab_Idle','Tab_Bear_Swing']
    .map(n=>{
      const tracks=animated&&n==='Tab_Idle'
        ?[new THREE.QuaternionKeyframeTrack('spine.quaternion',[0,1],
          [0,0,0,1,0,0,.19866933,.98006658])]
        :animated&&n==='Tab_Bear_Swing'
        ?[new THREE.QuaternionKeyframeTrack('bear.quaternion',[0,1],
          [0,0,0,1,0,0,.19866933,.98006658])]
        :[];
      return new THREE.AnimationClip(n,1,tracks);
    });
  const motion=createTabMotionRig({scene,animations},character);
  return {scene,character,names,motion};
}
function ankle(f,side){
  f.character.updateMatrixWorld(true);
  return f.names.get(`ankle.${side}`).getWorldPosition(new THREE.Vector3());
}
function close(actual,expected,tolerance=0.008){assert.ok(Math.abs(actual-expected)<tolerance,`${actual} must be within ${tolerance} of ${expected}`);}

test('runtime requires the real Tab clip and weighted-rig contract',()=>{
  const f=fixture();
  assert.deepEqual(f.motion.actionNames,['Tab_Walk','Tab_Idle','Tab_Bear_Swing']);
  assert.throws(()=>createTabMotionRig({scene:f.scene,animations:[]},f.character),/Tab missing clip/);
  f.names.get('bear').removeFromParent();f.names.get('root').add(f.names.get('bear'));
  assert.throws(()=>createTabMotionRig({scene:f.scene,animations:['Tab_Walk','Tab_Idle','Tab_Bear_Swing'].map(n=>new THREE.AnimationClip(n,1,[]))},f.character),/Teddy must remain/);
});

test('child stance translates the world root without sliding a planted ankle',()=>{
  const f=fixture();
  const frames=[];
  for(const distance of [.06,.10,.14]){
    f.character.position.x=distance;
    const state=f.motion.update(.1,{walking:true,heading:Math.PI/2});
    frames.push({state,point:ankle(f,'L')});
    assert.equal(state.stance[0],true,'left foot must be in stance at fixed checkpoints');
    assert.ok(state.footSlip[0]<.009,'real ankle must reach its world target');
  }
  for(const frame of frames.slice(1)){
    close(frame.point.x,frames[0].point.x);
    close(frame.point.z,frames[0].point.z);
    close(frame.point.y,frames[0].point.y);
  }
  // Both shoes contact the same plane despite their offset step cycles.
  close(frames[0].point.y,.145,.004);
  assert.ok(f.names.get('knee.L').rotation.x>0,'stance leg should bend anatomically');
});

test('production 0.66 root scale preserves true world ankle contact and sole clearance',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  const observed=[];
  for(const distance of [.08,.18,.29]){
    f.character.position.x=distance;
    const state=f.motion.update(.1,{walking:true,heading:Math.PI/2});
    observed.push(ankle(f,'L'));
    assert.ok(state.footSlip[0]<.009,'anchor must include actual root scale');
  }
  for(const point of observed.slice(1))
    assert.ok(point.distanceTo(observed[0])<.012,'foot must remain planted at production scale');
  close(observed[0].y,.0957,.003);
});

test('walking knees remain human-facing through every planted stride',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  const direction=new THREE.Vector3(0,0,1).applyQuaternion(f.character.quaternion);
  const samples=[0,0];
  for(let frame=1;frame<=120;frame++){
    f.character.position.x=frame*1.22/60;
    const state=f.motion.update(1/60,{walking:true,heading:Math.PI/2});
    for(let i=0;i<2;i++){
      if(!state.stance[i])continue;
      const side=i?'R':'L';
      f.character.updateMatrixWorld(true);
      const hip=f.names.get('hip.'+side).getWorldPosition(new THREE.Vector3());
      const knee=f.names.get('knee.'+side).getWorldPosition(new THREE.Vector3());
      const foot=f.names.get('ankle.'+side).getWorldPosition(new THREE.Vector3());
      const fromHip=knee.clone().sub(hip);
      const hipToFoot=foot.sub(hip);
      const onAxis=hipToFoot.multiplyScalar(fromHip.dot(hipToFoot)/hipToFoot.lengthSq());
      const anterior=fromHip.sub(onAxis).dot(direction);
      assert.ok(anterior>.002,
        side+' knee must flex forward of hip-to-ankle axis at frame '+frame+': '+anterior);
      samples[i]++;
    }
  }
  assert.ok(samples.every(n=>n>35),'sample both feet across several full stride cycles');
});

test('planted knees are only gently flexed, not digitigrade',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  let samples=0;
  for(let frame=1;frame<=120;frame++){
    f.character.position.x=frame*1.22/60;
    const gait=f.motion.update(1/60,{walking:true,heading:Math.PI/2});
    f.character.updateMatrixWorld(true);
    for(let i=0;i<2;i++){
      if(!gait.stance[i])continue;
      const side=i===0?'L':'R';
      const hip=f.names.get('hip.'+side).getWorldPosition(new THREE.Vector3());
      const knee=f.names.get('knee.'+side).getWorldPosition(new THREE.Vector3());
      const foot=f.names.get('ankle.'+side).getWorldPosition(new THREE.Vector3());
      const thigh=knee.clone().sub(hip).normalize();
      const shin=foot.clone().sub(knee).normalize();
      const flex=Math.acos(THREE.MathUtils.clamp(thigh.dot(shin),-1,1));
      assert.ok(flex<.70,
        side+' planted knee excessively flexed at frame '+frame+': '+flex);
      samples++;
    }
  }
  assert.ok(samples>=100,'measure both planted legs through repeated strides');
});

test('opposite leg advances on alternating half-strides, never sinks below ground',()=>{
  const f=fixture();let lifted=false,grounded=false;
  for(let n=1;n<=11;n++){
    f.character.position.x=n*.09;
    const result=f.motion.update(.09,{walking:true,heading:Math.PI/2});
    for(const side of ['L','R']){
      const y=ankle(f,side).y;
      assert.ok(y>=.14 && y<.25,`${side} ankle outside lift/contact window ${y}`);
      if(y>.17)lifted=true;
      if(Math.abs(y-.145)<.004)grounded=true;
    }
    assert.ok(result.footSlip.every(e=>e<.02));
  }
  assert.ok(lifted&&grounded,'alternating steps need both lift and grounded contact');
});

test('idle look, a deliberate turn, teddy grip and a planted pause are independent',()=>{
  const f=fixture();
  f.motion.update(.2,{walking:false,heading:Math.PI/2});
  assert.ok(Math.abs(f.names.get('neck').rotation.y)>.005);
  const bearParent=f.names.get('bear').parent;
  f.character.position.x=.13;f.motion.update(.1,{walking:true,heading:Math.PI/2});
  const position=ankle(f,'L');
  f.motion.update(.12,{walking:false,heading:Math.PI/2});
  const stopped=ankle(f,'L');
  close(stopped.x,position.x);close(stopped.z,position.z);
  assert.equal(f.names.get('bear').parent,bearParent);
  const yaw=f.character.rotation.y;
  f.motion.update(.2,{walking:false,heading:0});
  assert.ok(f.character.rotation.y<yaw-.3,'turn must interpolate, not snap');
  assert.ok(f.character.rotation.y>0,'turn must be progressive');
});


test('planted pause turns retain lateral world contact at production scale',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  f.character.position.x=.13;
  f.motion.update(.10,{walking:true,heading:Math.PI/2});
  const planted=['L','R'].map(side=>ankle(f,side));
  const initialYaw=f.character.rotation.y;
  const state=f.motion.update(.28,{walking:false,heading:0});
  assert.ok(f.character.rotation.y<initialYaw-.3,'fixture must turn substantially');
  assert.ok(state.turning,'paused heading change must be a real turn');
  for(let side=0;side<2;side++){
    const foot=ankle(f,side?'R':'L'),start=planted[side];
    assert.ok(Math.hypot(foot.x-start.x,foot.z-start.z)<.015,
      'turn must retain the planted shoe horizontal position');
    assert.ok(state.footSlip[side]<.017,'IK must reach the fixed world contact');
    const up=new THREE.Vector3(0,1,0).applyQuaternion(
      f.names.get(side?'ankle.R':'ankle.L').getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(up.y>.995,'planted shoe sole must remain level during hip abduction');
  }
  assert.ok(Math.abs(f.names.get('hip.L').rotation.z)>.03,
    'the hip must compensate lateral displacement, not discard it');
  for(let frame=0;frame<8;frame++){
    const next=f.motion.update(.05,{walking:false,heading:0});
    for(let side=0;side<2;side++){
      const foot=ankle(f,side?'R':'L'),start=planted[side];
      assert.ok(Math.hypot(foot.x-start.x,foot.z-start.z)<.02,
        'repeated turn frames must not accumulate lateral foot drift');
      assert.ok(next.footSlip[side]<.022);
      const up=new THREE.Vector3(0,1,0).applyQuaternion(
        f.names.get(side?'ankle.R':'ankle.L').getWorldQuaternion(new THREE.Quaternion()));
      assert.ok(up.y>.995,'repeated turn frames must not roll the sole sideways');
    }
  }
  f.motion.reset();
  close(f.names.get('hip.L').rotation.z,0,1e-9);
});

test('a mid-swing hesitation settles and resumes without a one-frame shoe jump',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  f.character.position.x=.13;
  f.motion.update(.016,{walking:true,heading:Math.PI/2});
  const airborne=ankle(f,'R').y;
  const grounded=.0957;
  assert.ok(airborne>grounded+.01,'fixture must interrupt an airborne right foot');
  f.motion.update(.016,{walking:false,heading:Math.PI/2});
  const firstPause=ankle(f,'R').y;
  assert.ok(Math.abs(firstPause-airborne)<.02,'pause must not drop the shoe in one frame');
  for(let n=0;n<25;n++)f.motion.update(.016,{walking:false,heading:Math.PI/2});
  const settled=ankle(f,'R').y;
  assert.ok(Math.abs(settled-grounded)<.009,'swinging foot must eventually reach the road');
  f.motion.update(.016,{walking:true,heading:Math.PI/2});
  assert.ok(Math.abs(ankle(f,'R').y-settled)<.02,
    'resuming the interrupted swing must not pop the shoe upward');
});

test('uninterrupted 60 FPS walking touches down without a delayed shoe drop',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  const dt=1/60;
  const floor=.0957; // Independent joint fixture world-space neutral ankle height.
  let priorHeights=null,priorStances=null,landings=0;
  for(let frame=1;frame<=160;frame++){
    f.character.position.x=frame*1.22*dt;
    const result=f.motion.update(dt,{walking:true,heading:Math.PI/2});
    const heights=['L','R'].map(side=>ankle(f,side).y);
    if(priorHeights){
      for(let side=0;side<2;side++){
        if(priorStances[side]===false&&result.stance[side]){
          landings++;
          assert.ok(priorHeights[side]-heights[side]<.017,
            'ordinary touchdown must not drop an airborne shoe in one frame');
          assert.ok(Math.abs(heights[side]-floor)<.007,
            'touchdown must reach the ground plane');
        }
      }
    }
    priorHeights=heights;
    priorStances=result.stance;
  }
  assert.ok(landings>=6,'check several completed steps from both legs');
});

test('curved root path rebases each foot plant without exhausting leg reach',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  let previous=new THREE.Vector3();
  let observations=0;
  for(let n=1;n<=80;n++){
    const t=n*.05;
    const pos=new THREE.Vector3(1.22*t,0,.16*Math.sin(t*.7));
    f.character.position.copy(pos);
    const dx=pos.x-previous.x,dz=pos.z-previous.z;
    const state=f.motion.update(.05,{walking:true,heading:Math.atan2(dx,dz)});
    assert.ok(state.footSlip.every(v=>v<.035),
      'world-space targets should remain reachable on a curved path');
    previous=pos;observations++;
  }
  assert.equal(observations,80);
  assert.ok(f.motion.debug().travel>4.8);
});

test('production startup gait does not overreach while converging onto a curved lane',()=>{
  const f=fixture();
  f.character.scale.setScalar(.66);
  f.character.position.z=.4;
  f.motion.reset();
  let worldX=0,clock=0,lastX=0,lastZ=.4;
  for(let i=0;i<120;i++){
    const dt=.05;clock+=dt;worldX+=dt*1.22;
    const desiredX=worldX+Math.sin(clock*.15)*.26;
    const desiredZ=.4+Math.sin(clock*.19)*.21;
    f.character.position.x=THREE.MathUtils.damp(f.character.position.x,desiredX,4,dt);
    f.character.position.z=THREE.MathUtils.damp(f.character.position.z,desiredZ,4,dt);
    const dx=f.character.position.x-lastX,dz=f.character.position.z-lastZ;
    f.motion.update(dt,{walking:Math.hypot(dx,dz)>dt*.08,
      heading:Math.atan2(dx,dz)});
    lastX=f.character.position.x;lastZ=f.character.position.z;
  }
  assert.ok(f.motion.debug().travel>4);
  assert.equal(f.motion.debug().reachCorrections,0,
    'a normal production lane must not require corrective foot sliding');
});

test('authored idle and bear clips resume after a neutral QA reset',()=>{
  const f=fixture({animated:true});
  f.motion.reset();
  assert.equal(f.motion.idle.isRunning(),false);
  f.motion.update(.5,{walking:false,heading:Math.PI/2});
  assert.equal(f.motion.idle.isRunning(),true);
  assert.equal(f.motion.bear.isRunning(),true);
  assert.ok(Math.abs(f.names.get('spine').quaternion.z)>.01,
    'authored spine track must animate after reset');
  assert.ok(Math.abs(f.names.get('bear').quaternion.z)>.001,
    'authored bear track must animate after reset');
});

test('reinitializing for a neutral reference capture restores authored bind pose',()=>{
  const f=fixture();
  f.character.position.x=.16;f.motion.update(.12,{walking:true,heading:Math.PI/2});
  f.motion.reset();
  close(f.names.get('hip.L').position.y,1.19,1e-9);
  close(f.names.get('knee.R').rotation.x,0,1e-9);
  close(f.names.get('neck').rotation.y,0,1e-9);
  assert.equal(f.motion.debug().travel,0);
});