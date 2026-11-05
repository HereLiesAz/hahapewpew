// T3.6: Tab's child gait and quiet acting on her existing Victoria/Tab skin.
// The source GLB and the dirty/torn costume are unchanged. In particular,
// the bear stays attached to hand.R and the box face never deforms.
import * as THREE from './vendor/three.module.js';

const CLIPS=['Tab_Walk','Tab_Idle','Tab_Bear_Swing'];
const STEP=0.44; // world units per child-sized step, not a timer-driven treadmill
const STANCE=0.55; // foot stays fixed in world space for 55% of its stride
const HIP_DROP=0.10; // gives the near-straight rest legs room to step

function angleDelta(from,to){return Math.atan2(Math.sin(to-from),Math.cos(to-from));}
function approach(current,target,rate,dt){return current+(target-current)*(1-Math.exp(-rate*dt));}

// Preserve the authored knee offsets and solve the lateral foot target during
// a planted turn. Hip abduction about Z follows sagittal flexion about X.
function solveLeg(hip,knee,ankle,x,z,y){
  const upper=knee.position,lower=ankle.position;
  const a=Math.hypot(upper.y,upper.z),b=Math.hypot(lower.y,lower.z);
  const lateral=x-hip.position.x,vertical=hip.position.y-y;
  hip.rotation.order='ZXY';
  hip.rotation.z=Math.atan2(lateral,vertical);
  const dz=z-hip.position.z,dy=-Math.hypot(lateral,vertical);
  const dist=Math.hypot(dz,dy);
  if(!Number.isFinite(dist))throw new RangeError('Invalid Tab ankle target');
  // Real turns and load-time lane alignment can briefly exceed a planted
  // leg's radius. Preserve the rendered game and shorten the target to the
  // anatomical reach; the controller will establish a new contact next step.
  const d=Math.min(a+b-1e-5,Math.max(Math.abs(a-b)+1e-5,dist));
  const fold=Math.acos(THREE.MathUtils.clamp((d*d-a*a-b*b)/(2*a*b),-1,1));
  const upperRest=Math.atan2(upper.z,-upper.y);
  const lowerRest=Math.atan2(lower.z,-lower.y);
  const direction=Math.atan2(dz,-dy);
  const thigh=direction+Math.atan2(b*Math.sin(fold),a+b*Math.cos(fold));
  hip.rotation.x=upperRest-thigh;
  knee.rotation.x=fold+lowerRest-upperRest;
  ankle.rotation.x=-hip.rotation.x-knee.rotation.x;
  // Cancelling only X leaves the sole banked by the hip's lateral abduction.
  // XYZ composes ankle X flexion before inverse Z roll, undoing both rotations.
  ankle.rotation.order='XYZ';
  ankle.rotation.z=-hip.rotation.z;
  return Math.abs(dist-d);
}

export function createTabMotionRig(gltf,root){
  if(!gltf?.scene||!Array.isArray(gltf.animations)||!root?.isObject3D)
    throw new TypeError('Tab motion requires a loaded skinned glTF and its character root');
  const clips=new Map(gltf.animations.map(clip=>[clip.name,clip]));
  for(const name of CLIPS)if(!clips.has(name))throw new Error('Tab missing clip: '+name);
  const bone=name=>{
    const result=gltf.scene.getObjectByName(name.replaceAll('.',''));
    if(!result?.isBone)throw new Error('Tab missing joint: '+name);
    return result;
  };
  const joints={root:bone('root'),spine:bone('spine'),chest:bone('chest'),
    neck:bone('neck'),head:bone('head'),bear:bone('bear'),
    shoulderL:bone('shoulder.L'),shoulderR:bone('shoulder.R'),
    elbowL:bone('elbow.L'),elbowR:bone('elbow.R'),
    wristR:bone('wrist.R'),handR:bone('hand.R'),
    hipL:bone('hip.L'),kneeL:bone('knee.L'),ankleL:bone('ankle.L'),
    hipR:bone('hip.R'),kneeR:bone('knee.R'),ankleR:bone('ankle.R')};
  let skin=0;gltf.scene.traverse(n=>{if(n.isSkinnedMesh)skin++});
  if(skin<1)throw new Error('Tab has no skinned mesh');
  if(joints.bear.parent!==joints.handR)throw new Error('Teddy must remain held by right hand');
  const mixer=new THREE.AnimationMixer(gltf.scene);
  const walk=mixer.clipAction(clips.get('Tab_Walk'));
  const idle=mixer.clipAction(clips.get('Tab_Idle'));
  const bear=mixer.clipAction(clips.get('Tab_Bear_Swing'));
  for(const action of [walk,idle,bear])action.play();
  const sides=[
    {name:'L',hip:joints.hipL,knee:joints.kneeL,ankle:joints.ankleL,offset:0},
    {name:'R',hip:joints.hipR,knee:joints.kneeR,ankle:joints.ankleR,offset:STEP}
  ];
  const rest=new Map(Object.values(joints).map(j=>[j,{p:j.position.clone(),q:j.quaternion.clone()}]));
  const lastPosition=root.position.clone();
  let travel=0,time=0,motion=0,reachCorrections=0;
  const anchors=new Map(),footprint=new Map();
  const p0=new THREE.Vector3(),world=new THREE.Vector3();

  function reset(){
    mixer.stopAllAction();
    for(const [j,v] of rest){j.position.copy(v.p);j.quaternion.copy(v.q);}
    travel=0;time=0;motion=0;reachCorrections=0;
    lastPosition.copy(root.position);
    anchors.clear();footprint.clear();
  }
  function update(dt,{walking,heading}={}){
    if(!Number.isFinite(dt)||dt<0)throw new RangeError('Invalid Tab animation delta');
    if(dt===0)return;
    time+=dt;
    const dx=root.position.x-lastPosition.x,dz=root.position.z-lastPosition.z;
    const moved=Math.hypot(dx,dz);
    const moving=walking??moved/dt>0.08;
    lastPosition.copy(root.position);
    if(moving)travel+=moved;
    const aimed=Number.isFinite(heading)?heading:moved>1e-5?Math.atan2(dx,dz):root.rotation.y;
    const yawError=angleDelta(root.rotation.y,aimed);
    root.rotation.y+=yawError*(1-Math.exp(-3.0*dt));
    motion=approach(motion,moving?1:0,9,dt);
    // A neutral QA reset stops mixer actions; reactivate authored idle,
    // shoulder and bear tracks on the first subsequent update.
    if(!walk.isRunning()||!idle.isRunning()||!bear.isRunning())
      for(const action of [walk,idle,bear])action.reset().play();
    walk.setEffectiveWeight(motion*0.24); // shoulders only; legs use foot locks
    idle.setEffectiveWeight(moving?0.18:0.72);
    bear.setEffectiveWeight(moving?0.18:0.035);
    mixer.update(dt);
    // The box turns as a single rigid piece; its printed graphics remain flat.
    const look=(1-motion)*Math.sin(time*0.88);
    joints.neck.rotation.y=0.10*look+0.22*yawError;
    joints.head.rotation.z=0.018*Math.sin(time*1.07)*(1-motion);
    joints.chest.rotation.z=0.013*Math.sin(time*1.9)*motion;
    // Never swing the arm holding the bear wildly through the skirt.
    joints.shoulderR.rotation.z=0.022*Math.sin(time*2.3)*motion;
    joints.wristR.rotation.z=0.013*Math.sin(time*1.55);
    joints.shoulderL.rotation.z=0.021*Math.sin(time*1.8)*(1-motion);
    const act={walking:moving,turning:Math.abs(yawError)>0.04,travel,stance:[],footSlip:[]};
    const cycleLength=2*STEP;
    for(const limb of sides){
      const phaseTravel=travel+limb.offset;
      const cycle=Math.floor(phaseTravel/cycleLength);
      const phase=(phaseTravel-cycle*cycleLength)/cycleLength;
      let raised=0;
      const restHip=rest.get(limb.hip).p;
      const restAnkleY=restHip.y+limb.knee.position.y+limb.ankle.position.y;
      if(moving){
        limb.hip.position.y=restHip.y-HIP_DROP;
        // Never extrapolate a step from the start of the journey: Tab's
        // actual path curves, and a stale heading eventually makes the
        // planted foot unreachable. Latch the anchor *where each foot lands*.
        const direction=new THREE.Vector3(Math.sin(aimed),0,Math.cos(aimed));
        const right=new THREE.Vector3(Math.cos(aimed),0,-Math.sin(aimed));
        const legX=(restHip.x+limb.knee.position.x+limb.ankle.position.x)*root.scale.x;
        const floor=root.position.y+restAnkleY*root.scale.y;
        let contact=anchors.get(limb.name);
        if(!contact||contact.cycle!==cycle){
          const point=root.position.clone()
            .addScaledVector(direction,cycleLength*(STANCE/2-phase))
            .addScaledVector(right,legX);
          point.y=floor;
          contact={cycle,point};anchors.set(limb.name,contact);
        }
        world.copy(contact.point);
        if(phase>STANCE){
          const fraction=(phase-STANCE)/(1-STANCE);
          const smooth=fraction*fraction*(3-2*fraction);
          const landing=root.position.clone()
            .addScaledVector(direction,cycleLength*(1+STANCE/2-phase))
            .addScaledVector(right,legX);
          landing.y=floor;
          world.lerp(landing,smooth);
          // Bound only upward jumps when walking resumes mid-swing. Never
          // delay the descending arc: the shoe must reach ground by stance.
          const previousHeight=footprint.get(limb.name)?.y??floor;
          const desiredHeight=.075*Math.sin(Math.PI*fraction);
          raised=Math.min(desiredHeight,Math.max(0,previousHeight-floor)+.9*dt);
          world.y=floor+raised;
        }
        root.updateWorldMatrix(true,false);
        p0.copy(world);root.worldToLocal(p0);
        const excess=solveLeg(limb.hip,limb.knee,limb.ankle,p0.x,p0.z,p0.y);
        if(excess>.001)reachCorrections++;
        // Compare actual ankle contact with the stationary world anchor. The
        // browser QA measures this too, using the *real* loaded skeleton.
        root.updateWorldMatrix(true,true);
        const actual=limb.ankle.getWorldPosition(new THREE.Vector3());
        const error=Math.hypot(actual.x-world.x,actual.z-world.z,actual.y-world.y);
        if(excess>.001&&phase<=STANCE)anchors.get(limb.name).point.copy(actual);
        act.footSlip.push(error);
        act.stance.push(phase<=STANCE);
        footprint.set(limb.name,world.clone());
      }else{
        // Freeze the actual ground contact during her pauses; resetting to
        // straight knees would drag shoes across the roadway.
        const contact=footprint.get(limb.name);
        if(contact){
          limb.hip.position.y=restHip.y-HIP_DROP;
          root.updateWorldMatrix(true,false);
          const floor=root.position.y+restAnkleY*root.scale.y;
          // Ease the airborne foot down instead of teleporting it to the road
          // in one frame when a scheduled hesitation interrupts its swing.
          p0.copy(contact);
          p0.y=floor+approach(Math.max(0,contact.y-floor),0,18,dt);
          world.copy(p0);root.worldToLocal(p0);
          const excess=solveLeg(limb.hip,limb.knee,limb.ankle,p0.x,p0.z,p0.y);
          if(excess>.001)reachCorrections++;
          root.updateWorldMatrix(true,true);
          const actual=limb.ankle.getWorldPosition(new THREE.Vector3());
          act.footSlip.push(actual.distanceTo(world));
          footprint.set(limb.name,excess>.001?actual.clone():world.clone());
        }else{
          limb.hip.position.y=restHip.y;
          limb.hip.rotation.x=0;
          limb.hip.rotation.z=0;
          limb.knee.rotation.x=0;
          limb.ankle.rotation.x=0;
          limb.ankle.rotation.z=0;
          act.footSlip.push(0);
        }
        act.stance.push(true);
      }
    }
    return act;
  }
  return {model:gltf.scene,mixer,walk,idle,bear,update,reset,joints,
    actionNames:CLIPS,debug:()=>({travel,time,motion,reachCorrections,footprint:[...footprint.entries()].map(([k,v])=>[k,v.toArray()])})};
}