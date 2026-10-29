// S2.7: independent GLB clip mixer + S2.5 gun actuator for Shift.
// Shared by the production Shift GLB and the localhost S27 candidate.
// Installation validates every clip before retiring the procedural fallback.
import * as THREE from './vendor/three.module.js';
import {toCreasedNormals} from './vendor/BufferGeometryUtils.js';
import {celShadeRobot} from './cel-robots.js';
import {attachShiftFaceGraphics} from './shift-face-graphics.js';
import {attachShiftConcealedMinigun} from './shift-weapon.js';

const REQUIRED=['Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon'];

export function createShiftSequenceRig(gltf) {
  if(!gltf?.scene||!Array.isArray(gltf.animations))throw new TypeError('Expected parsed Shift GLB');
  const actionsByName=new Map(gltf.animations.map(c=>[c.name,c]));
  for(const name of REQUIRED)if(!actionsByName.has(name))throw new Error('Shift clip missing: '+name);
  const bones={};
  for(const name of ['head','root','spine','neck','wristR','armR','hipL','kneeL','ankleL','hipR','kneeR','ankleR']){
    bones[name]=gltf.scene.getObjectByName(name);
    if(!bones[name]?.isBone)throw new Error('Shift bone missing: '+name);
  }
  const feet=new Map([['ankleL',[]],['ankleR',[]]]);
  let skinned=0;
  gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skinned++});
  if(!skinned)throw new Error('Shift skinned mesh missing');
  // Owner correction: make the small torso and attached arms 55% of their
  // authored size without shrinking the S29 wok/head. The head settles
  // naturally with the shorter body; leg length, root scale, mesh buffers
  // and clips stay unchanged. Reapply after pose().
  const compactScale=.55;
  const spineRest=bones.spine.position.clone(),neckRest=bones.neck.position.clone();
  const torsoShells=[];
  gltf.scene.traverse(node=>{
    if(node.isSkinnedMesh&&node.material?.name==='Shift/Body_Graphite')torsoShells.push(node);
  });
  if(torsoShells.length!==1)throw new Error('Shift torso shell missing or ambiguous');
  const bodyVertices=torsoShells[0].geometry.attributes.position;
  let originalTorsoBottom=Infinity;
  for(let i=0;i<bodyVertices.count;i++)
    originalTorsoBottom=Math.min(originalTorsoBottom,bodyVertices.getY(i));
  if(!(originalTorsoBottom<spineRest.y))throw new Error('Shift torso rest bounds invalid');
  // Shrink toward the original hip contact, not the spine pivot: shrinking
  // around that pivot lifts the torso clear of the legs.
  const spineDrop=(spineRest.y-originalTorsoBottom)*(1-compactScale);
  function restoreCompactBody(){
    bones.spine.position.copy(spineRest);
    bones.spine.position.y-=spineDrop;
    bones.spine.scale.setScalar(compactScale);
    bones.neck.position.copy(neckRest);
    bones.neck.scale.setScalar(1/compactScale);
  }
  restoreCompactBody();
  gltf.scene.traverse(node=>{
    if(!node.isSkinnedMesh)return;
    const joints=node.geometry.attributes.skinIndex;
    for(let i=0;i<joints.count;i++){
      const name=node.skeleton.bones[joints.getX(i)]?.name;
      if(feet.has(name))feet.get(name).push({mesh:node,index:i});
    }
  });
  if([...feet.values()].some(vertices=>!vertices.length))throw new Error('Shift foot geometry missing');
  // The exported shell is triangle soup with flat per-face normals. Average
  // normals at coincident shell vertices while retaining the hard rim crease.
  // Clone first: positions, UVs, skin attributes and source GLB stay intact.
  gltf.scene.traverse(node=>{
    if(node.isMesh&&['Shift/Dome_Side','Shift/Dome_Graphite'].includes(node.material?.name))
      node.geometry=toCreasedNormals(node.geometry.clone());
  });
  const {eyes:sourceEyes}=celShadeRobot(gltf.scene,'Shift');
  if(sourceEyes.length!==1||sourceEyes[0].type!=='MeshBasicMaterial'||
     sourceEyes[0].color.getHexString()!=='ffffff')throw new Error('Shift eye graphics changed');
  const faceGraphics=attachShiftFaceGraphics(gltf.scene);
  const eyes=[faceGraphics.material];
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
    restoreCompactBody();
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
  /** Place the supporting animated foot on a real rendered walking surface.
   * Raycasts only the supplied ground/road meshes, never scenery or actors.
   * Adjusts scene placement; GLB geometry, skin and animation stay unchanged.
   * Returns null when neither foot finds a surface within the local probe range.
   */
  function ground(actorRoot,surfaces){
    restoreCompactBody();
    actorRoot.updateWorldMatrix(true,false);
    actorRoot.updateMatrixWorld(true); // refresh SkinnedMesh bind inverses as well
    gltf.scene.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update()});
    surfaces.forEach(n=>n.updateWorldMatrix(true,false));
    const ray=new THREE.Raycaster();
    let contact=null;
    for(const vertices of feet.values()){
      const seen=new Set();
      for(const {mesh,index} of vertices){
        const p=mesh.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        // Triangle-soup corners repeat. Probe each distinct rendered position;
        // the lowest corner alone can miss an uphill edge penetrating the road.
        const key=p.toArray().join(',');
        if(seen.has(key))continue;
        seen.add(key);
        ray.set(p.clone().add(new THREE.Vector3(0,2,0)),new THREE.Vector3(0,-1,0));
        ray.far=4;
        const hit=ray.intersectObjects(surfaces,false)[0];
        if(!hit)continue;
        const adjustment=hit.point.y-p.y;
        if(!contact||adjustment>contact.adjustment)
          contact={adjustment,footY:p.y,surfaceY:hit.point.y};
      }
    }
    if(!contact)return null;
    const position=actorRoot.getWorldPosition(new THREE.Vector3());
    position.y+=contact.adjustment;
    if(actorRoot.parent)actorRoot.parent.worldToLocal(position);
    actorRoot.position.copy(position);
    actorRoot.updateMatrixWorld(true);
    return contact;
  }
  function dispose(){
    faceGraphics.dispose();
    weapon.setFiring(false);
    weapon.pose(0,0);
    weapon.root.removeFromParent();
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  }
  return Object.freeze({
    model:gltf.scene,mixer,clips,weapon,bones,eyes,faceGraphics,update,ground,restoreCompactBody,dispose,
    get actionNames(){return REQUIRED.slice()},
    get isDeployed(){return weapon.root.visible},
  });
}
