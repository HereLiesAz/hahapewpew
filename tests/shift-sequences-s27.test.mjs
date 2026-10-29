import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../public/vendor/three.module.js';
import {GLTFLoader} from '../public/vendor/GLTFLoader.js';
import {createShiftSequenceRig} from '../public/shift-motion.js';

const v26=readFileSync(new URL('../workbench/shift/Shift_S26.glb',import.meta.url));
const v27=readFileSync(new URL('../workbench/shift/Shift_S27.glb',import.meta.url));
const meta=raw=>JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12)));
async function parsed(raw=v27){
  const bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  return new Promise((ok,fail)=>new GLTFLoader().parse(bytes,'',ok,fail));
}

test('S2.7 exported GLB retains all original mesh bytes, skin, scene and 3 original clips',()=>{
  const before=meta(v26),after=meta(v27);
  assert.equal(v27.toString('ascii',0,4),'glTF');
  assert.equal(v27.readUInt32LE(8),v27.length);
  assert.deepEqual(after.animations.slice(0,3),before.animations);
  assert.deepEqual(after.animations.map(a=>a.name),[
    'Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon'
  ]);
  for(const key of ['nodes','skins','scenes','meshes','materials'])
    assert.deepEqual(after[key],before[key],key);
  assert.deepEqual(after.accessors.slice(0,before.accessors.length),before.accessors);
  const sourceBinary=v26.subarray(28+v26.readUInt32LE(12));
  const newBinary=v27.subarray(28+v27.readUInt32LE(12));
  assert.deepEqual(newBinary.subarray(0,sourceBinary.length),sourceBinary);
  assert.equal(after.skins[0].joints.length,16);
  assert.equal(after.asset.extras.shiftSequencesS27.step,'S2.7');
  const root=after.nodes.findIndex(n=>n.name==='root');
  const wrist=after.nodes.findIndex(n=>n.name==='wrist.R');
  assert.equal(after.animations[3].channels[0].target.node,root);
  assert.equal(after.animations[4].channels[0].target.node,wrist);
});

test('S2.7 scene controller plays idle/walk/turn/talk independently of six-barrel gun',async()=>{
  const motion=createShiftSequenceRig(await parsed());
  assert.deepEqual(motion.actionNames,['Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon']);
  assert.equal(motion.weapon.barrelCount,6);
  assert.equal(motion.weapon.root.visible,false);
  const restHead=motion.bones.head.quaternion.clone();
  motion.update(.08,{walking:false});
  assert.equal(motion.clips.Shift_Walk.getEffectiveWeight(),0);
  assert.equal(motion.clips.Shift_Idle.getEffectiveWeight(),1);
  motion.update(.12,{walking:true});
  assert.equal(motion.clips.Shift_Walk.getEffectiveWeight(),1);
  motion.update(.12,{walking:false,speaking:true,turning:true});
  assert.ok(motion.bones.head.quaternion.angleTo(restHead)>.00001);
  assert.ok(motion.clips.Shift_Turn.getEffectiveWeight()>.5);
  const before=motion.weapon.barrelSpin;
  motion.update(.1,{walking:false,deploy:true});
  assert.equal(motion.weapon.root.visible,true);
  assert.equal(motion.weapon.barrelSpin,before,'deploy may not spin');
  for(let i=0;i<16;i++)motion.update(.1,{walking:false,firing:true});
  assert.ok(motion.weapon.barrelSpin>before+5,'fire spins independent rotor');
  const spin=motion.weapon.barrelSpin;
  motion.update(.1,{walking:false,deploy:true});
  assert.equal(motion.weapon.barrelSpin,spin,'barrel must stop while weapon stays open');
  for(let i=0;i<100;i++)motion.update(.1,{walking:false});
  assert.equal(motion.weapon.root.visible,false);
  assert.equal(motion.weapon.barrelSpin,0);
  const eyes=motion.eyes;
  assert.equal(eyes.length,1);
  assert.equal(eyes[0].type,'MeshBasicMaterial');
  assert.equal(eyes[0].color.getHexString(),'ffffff');
  assert.equal(eyes[0].toneMapped,false);
  motion.dispose();
});

test('S2.7 GLTFLoader never needs procedural gun to complete standalone acceptance',async()=>{
  const gltf=await parsed();
  const model=createShiftSequenceRig(gltf);
  let skinned=0,unlit=0;
  gltf.scene.traverse(o=>{
    if(o.isSkinnedMesh)skinned++;
    if(o.isMesh&&o.material.name==='Shift/Eyes_2D_Emission'&&o.material.type==='MeshBasicMaterial')unlit++;
  });
  assert.ok(skinned>=1);
  assert.ok(unlit>=1);
  assert.ok(model.bones.wristR.isBone);
  assert.ok(model.bones.kneeL.isBone);
  assert.ok(model.bones.kneeR.isBone);
  assert.ok(model.bones.armR.isBone);
  model.dispose();
});

test('S2.7 game QA requires localhost and explicitly preserves production fallback',()=>{
  const runtime=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
  const selector=runtime.match(/const shiftQaMode = [\s\S]*? : null;/)?.[0];
  assert.ok(selector,'QA selector must exist');
  const evaluate=(search,hostname)=>new Function('location','URLSearchParams',selector+'return shiftQaMode')({search,hostname},URLSearchParams);
  for(const mode of ['s27-idle','s27-walk','s27-turn','s27-talk','s27-weapon','s27-fire','s27-fallback']){
    assert.equal(evaluate('?shiftQA='+mode,'localhost'),mode);
    assert.equal(evaluate('?shiftQA='+mode,'127.0.0.1'),mode);
    assert.equal(evaluate('?shiftQA='+mode,'hahapewpew.com'),null);
    assert.equal(evaluate('?shiftQA='+mode,'localhost.example'),null);
  }
  assert.match(runtime,/Missing_Shift_S27\.glb/);
  assert.match(runtime,/new GLTFLoader\(\)\.loadAsync\('\/workbench\/shift\/Shift_S27\.glb'\)/);
  assert.match(runtime,/new GLTFLoader\(\)\.loadAsync\('\/assets\/characters\/Shift_Rigged\.glb'\)/);
  assert.match(runtime,/if\(shiftS27Qa\)\{/);
  assert.match(runtime,/legacy\.forEach\(node=>\{node\.visible=false;\}\)/);
  assert.match(runtime,/canvas\.dataset\.shiftModel='glb-s27'/);
  assert.match(runtime,/if\(!crew\.Shift\.asset\?\.s27&&crew\.Shift\.gun\.visible\)/);
  assert.match(runtime,/crew\.Shift\.asset\.weapon\.muzzleWorldPosition\(v3\(\)\)/);
  assert.match(runtime,/if\(!p\.from\)/);
  assert.match(runtime,/shiftQaView==='front'/);
});


test('S2.7 Chromium capture records in-game closeups without faking actor geometry',()=>{
  const src=readFileSync(new URL('../scripts/shift_s27_browser_qa.mjs',import.meta.url),'utf8');
  assert.match(src,/document\.querySelector\('#pause'\)\.click\(\)/);
  assert.match(src,/document\.querySelector\('#follow'\)\.click\(\)/);
  assert.match(src,/const actor=rig\.asset\?\.s27\?rig\.asset\.model:rig\.root/);
  assert.match(src,/new THREE\.Box3\(\)\.setFromObject\(actor,true\)/);
  assert.match(src,/extent\.y\*innerHeight/);
  assert.match(src,/ctl\.zoom=Math\.max/);
  assert.match(src,/view==='front'\?Math\.PI/);
  assert.match(src,/projectedHeight<260/);
  assert.match(src,/measuredWorldHeight:extent\.y/);
  assert.match(src,/-closeup\.png/);
  assert.match(src,/record\.cases\[record\.cases\.length-1\]\.closeup=frame/);
});


test('S2.7 production clips move their skinned joints and release back to idle',async()=>{
  const live=readFileSync(new URL('../public/assets/characters/Shift_Rigged.glb',import.meta.url));
  const motion=createShiftSequenceRig(await parsed(live));
  const names=['spine','hipL','kneeL','head','root','wristR'];
  const bones=Object.fromEntries(names.map(n=>[n,motion.model.getObjectByName(n)]));
  const rest=Object.fromEntries(names.map(n=>[n,bones[n].quaternion.clone()]));
  const cases=[
    ['Shift_Idle','spine',{walking:false}],
    ['Shift_Walk','hipL',{walking:true}],
    ['Shift_Talk','head',{walking:false,speaking:true}],
    ['Shift_Turn','root',{walking:false,turning:true}],
    ['Shift_Weapon','wristR',{walking:false,deploy:true}]
  ];
  for(const [clip,bone,options] of cases){
    Object.values(motion.clips).forEach(a=>a.reset().play());
    const samples=[];
    let probe;
    motion.model.traverse(n=>{
      if(probe||!n.isSkinnedMesh)return;
      const joints=n.geometry.attributes.skinIndex;
      for(let i=0;i<joints.count;i++){
        const p=n.geometry.attributes.position;
        const influenced=bone==='root'?Boolean(bones.root.getObjectById(n.skeleton.bones[joints.getX(i)].id))&&Math.hypot(p.getX(i),p.getZ(i))>.1:n.skeleton.bones[joints.getX(i)]===bones[bone];
        if(influenced){probe={mesh:n,index:i};break;}
      }
    });
    assert.ok(probe,'missing skinned geometry for '+bone);
    for(let frame=0;frame<24;frame++){
      motion.update(motion.clips[clip].getClip().duration/24,options);
      motion.model.updateMatrixWorld(true);probe.mesh.skeleton.update();
      const point=probe.mesh.getVertexPosition(probe.index,new THREE.Vector3()).applyMatrix4(probe.mesh.matrixWorld);
      assert.ok(point.toArray().every(Number.isFinite));
      samples.push({point,angle:bones[bone].quaternion.angleTo(rest[bone])});
    }
    assert.ok(Math.max(...samples.map(s=>s.angle))>1e-3,clip+' joint did not animate');
    assert.ok(samples.some(s=>s.point.distanceTo(samples[0].point)>1e-4),clip+' skin did not move');
    for(let i=0;i<30;i++)motion.update(.05,{walking:false});
    for(const n of ['hipL','kneeL','head','root','wristR'])
      assert.ok(bones[n].quaternion.angleTo(rest[n])<1e-6,n+' remained stuck after '+clip);
    assert.equal(motion.weapon.root.visible,false);
    assert.equal(motion.weapon.barrelSpin,0);
    assert.equal(motion.eyes[0].type,'MeshBasicMaterial');
  }
  motion.dispose();
});
