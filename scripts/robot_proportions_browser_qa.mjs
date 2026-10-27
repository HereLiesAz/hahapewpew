#!/usr/bin/env node
/** Inspect production GLBs, actual skinned vertices and complete motion in Chromium.
 * All captures use the real game scene; orthographic captures render synchronously
 * before the normal game camera resumes. No workbench model is substituted.
 */
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const dir=resolve(process.argv[2]||'artifacts/robot-proportions');
await mkdir(dir,{recursive:true});
const server=spawn('python3',['scripts/serve_shift_qa.py'],{stdio:'pipe'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const report={results:[],errors:[]};
let browser,context;
try {
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw Error('Local QA server terminated');
    try{if((await fetch('http://127.0.0.1:8765/')).ok)break;}catch{}
    await sleep(150);
    if(i===79)throw Error('QA server unavailable');
  }
  browser=await chromium.launch({headless:true,args:[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
  ]});
  context=await browser.newContext({viewport:{width:1600,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  await page.goto('http://127.0.0.1:8765/?qwertyQA=front',
                  {waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>{
    const q=window.__qwertyQA?.crew,c=document.querySelector('#world');
    return c?.dataset.qwertyModel==='glb-q16' && c.dataset.shiftModel==='glb'
      && q?.Qwerty?.asset?.root && q?.Shift?.asset?.s27;
  },null,{timeout:30000});
  await page.screenshot({path:dir+'/production-wide.png'});
  const measured=await page.evaluate(async()=>{
    const T=await import('/vendor/three.module.js');
    const qa=window.__qwertyQA,q=qa.crew.Qwerty,s=qa.crew.Shift;
    if(document.querySelector('#pause').getAttribute('aria-pressed')!=='true')
      document.querySelector('#pause').click();
    // Reset both loaded skeletons to their authored standing pose. Animated
    // heights are recorded separately; a walking pose is not a standing ruler.
    for(const rig of [q,s]){
      rig.asset.mixer.stopAllAction();
      const model=rig.asset.model||rig.asset.root;
      model.traverse(n=>{if(n.isSkinnedMesh)n.pose()});
      rig.root.position.set(0,0,rig===q?-.5:.5);
      rig.root.rotation.set(0,Math.PI/2,0);
    }
    function points(model,material=null){
      qa.scene.updateMatrixWorld(true);
      const out=[];
      model.traverseVisible(n=>{
        if(!n.isMesh || (material&&n.material.name!==material))return;
        if(n.isSkinnedMesh)n.skeleton.update();
        for(let i=0;i<n.geometry.attributes.position.count;i++)
          out.push(n.getVertexPosition(i,new T.Vector3()).applyMatrix4(n.matrixWorld));
      });
      if(!out.length)throw Error('No visible rendered vertices for '+material);
      return out;
    }
    const bounds=(model,material)=>new T.Box3().setFromPoints(points(model,material));
    const qb=bounds(q.asset.root),sb=bounds(s.asset.model);
    const qTorso=bounds(q.asset.root,'Qwerty/Body_Graphite').getSize(new T.Vector3()).y;
    const sTorso=bounds(s.asset.model,'Shift/Body_Graphite').getSize(new T.Vector3()).y;
    const dome=points(s.asset.model,'Shift/Dome_Side');
    const db=new T.Box3().setFromPoints(dome),center=db.getCenter(new T.Vector3());
    const rings=new Map();
    for(const p of dome){
      const k=p.y.toFixed(5),r=Math.hypot(p.x-center.x,p.z-center.z);
      if(!rings.has(k))rings.set(k,[]);
      rings.get(k).push(r);
    }
    const radialError=Math.max(...[...rings.values()].map(rs=>Math.max(...rs)-Math.min(...rs)));
    window.__productionQA={T,qa,q,s,points,bounds,qb,sb};
    return {qScale:q.root.scale.toArray(),sScale:s.root.scale.toArray(),
      qHeight:qb.max.y-qb.min.y,shiftHeight:sb.max.y-sb.min.y,
      relativeHeight:(sb.max.y-sb.min.y)/(qb.max.y-qb.min.y),qTorso,sTorso,
      qFoot:qb.min.y,shiftFoot:sb.min.y,ringCount:rings.size,radialError,
      clips:s.asset.actionNames,barrels:s.asset.weapon.barrelCount,
      models:[document.querySelector('#world').dataset.qwertyModel,document.querySelector('#world').dataset.shiftModel]};
  });
  report.results.push({mode:'neutral-production',...measured});
  assert.deepEqual(measured.qScale,[.27,.27,.27]);
  assert.deepEqual(measured.sScale,[.46,.46,.46]);
  assert.ok(Math.abs(measured.relativeHeight-.92)<.005,JSON.stringify(measured));
  assert.ok(Math.abs(measured.qTorso-measured.sTorso)/measured.qTorso<.01);
  assert.ok(Math.abs(measured.qFoot)<.02 && Math.abs(measured.shiftFoot)<.02);
  assert.equal(measured.ringCount,11);
  assert.ok(measured.radialError<2e-6);
  assert.equal(measured.barrels,6);
  assert.deepEqual(measured.clips,['Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon']);

  async function capture(mode,view='front',pair=false){
    const result=await page.evaluate(({view,pair})=>{
      const {T,qa,q,s,bounds}=window.__productionQA;
      const box=pair?bounds(q.asset.root).union(bounds(s.asset.model))
        :bounds(view==='qwerty'?q.asset.root:s.asset.model);
      const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
      const half=Math.max(size.y,size.x,size.z)*.65;
      const aspect=innerWidth/innerHeight;
      const cam=new T.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,30);
      const direction=view==='top'?new T.Vector3(0,1,0)
        :view==='side'?new T.Vector3(0,0,-1):new T.Vector3(1,0,0);
      cam.position.copy(center).addScaledVector(direction,5);
      cam.up.set(0,view==='top'?0:1,view==='top'?-1:0);
      cam.lookAt(center);cam.updateMatrixWorld(true);
      // Prevent the other actor occluding single-character side views.
      const hidden=[];
      for(const rig of [qa.crew.Tab,q,s])if(rig===qa.crew.Tab||(!pair&&rig!==(view==='qwerty'?q:s))){
        hidden.push([rig.root,rig.root.visible]);rig.root.visible=false;
      }
      qa.renderer.render(qa.scene,cam);
      const data=qa.renderer.domElement.toDataURL('image/png');
      hidden.forEach(([root,visible])=>{root.visible=visible});
      const top=new T.Vector3(center.x,box.max.y,center.z).project(cam);
      const bottom=new T.Vector3(center.x,box.min.y,center.z).project(cam);
      return {data,projection:cam.type,direction:direction.toArray(),
        projectedHeight:Math.abs(top.y-bottom.y)*innerHeight/2,
        bounds:{min:box.min.toArray(),max:box.max.toArray()}};
    },{view,pair});
    await writeFile(dir+'/'+mode+'.png',Buffer.from(result.data.split(',')[1],'base64'));
    delete result.data;report.results.push({mode,...result});
    if(view!=='top')assert.ok(result.projectedHeight>300);
    return result;
  }
  await capture('production-pair','front',true);
  await capture('shift-front');
  await capture('shift-side','side');
  const overhead=await capture('shift-top-orthographic','top');
  assert.deepEqual(overhead.direction,[0,1,0]);
  await capture('qwerty-front','qwerty');

  const motion=await page.evaluate(()=>{
    const {T,q,s,qa,points}=window.__productionQA;
    const head=s.asset.bones.head;
    function headLocalEyes(){
      const world=points(s.asset.model,'Shift/Eyes_2D_Emission');
      const inverse=head.matrixWorld.clone().invert();
      return world.map(p=>p.applyMatrix4(inverse));
    }
    const before=headLocalEyes(),rest=head.quaternion.clone();
    // Restart the existing clip actions after the neutral-pose measurement.
    Object.values(s.asset.clips).forEach(a=>a.reset().play());
    for(let i=0;i<6;i++)s.asset.update(.05,{walking:false,speaking:true,turning:true});
    const after=headLocalEyes();
    const eyeError=Math.max(...before.map((p,i)=>p.distanceTo(after[i])));
    const headAngle=rest.angleTo(head.quaternion);
    q.asset.walk.setEffectiveWeight(0);
    q.asset.setSpeaking(false);q.asset.setSpeaking(true);
    q.asset.update(.12);qa.scene.updateMatrixWorld(true);
    const open=q.asset.skull.position.clone(),plate=q.asset.fixedPlate.position.clone();
    window.__productionQA.openPlate=plate;
    return {eyeError,headAngle,eyes:s.asset.eyes.map(e=>({type:e.type,color:e.color.getHexString()})),
      qFlapY:open.y,plate:plate.toArray()};
  });
  report.results.push({mode:'head-motion',...motion});
  assert.ok(motion.eyeError<2e-6 && motion.headAngle>1e-4);
  assert.deepEqual(motion.eyes,[{type:'MeshBasicMaterial',color:'ffffff'}]);
  await capture('shift-head-motion');
  await capture('qwerty-talk-open','qwerty');
  const closed=await page.evaluate(()=>{
    const {q,openPlate}=window.__productionQA;
    q.asset.setSpeaking(false);q.asset.update(.05);
    return {y:q.asset.skull.position.y,plateUnchanged:q.asset.fixedPlate.position.equals(openPlate)};
  });
  report.results.push({mode:'qwerty-talk-closed',...closed});
  assert.ok(motion.qFlapY>closed.y+.01 && closed.plateUnchanged);
  await capture('qwerty-talk-closed','qwerty');
  for(const mode of ['hidden','deploy','fire','retract']){
    const weapon=await page.evaluate(mode=>{
      const {s}=window.__productionQA,a=s.asset;
      for(let i=0;i<80;i++)a.update(.05,{walking:false,deploy:mode==='deploy',firing:mode==='fire'});
      return {visible:a.weapon.root.visible,spin:a.weapon.barrelSpin,deployment:a.weapon.deployment};
    },mode);
    report.results.push({mode:'weapon-'+mode,...weapon});
    assert.equal(weapon.visible,mode==='deploy'||mode==='fire');
    if(mode==='fire')assert.ok(weapon.spin>1);
    else assert.equal(weapon.spin,0);
    await capture('shift-weapon-'+mode,'side');
  }
  const combat=await page.evaluate(()=>{
    const {T,qa,s}=window.__productionQA;
    const target={root:new T.Group(),life:1,panicked:false};
    target.root.position.set(3,0,5);
    qa.fireAt(target);
    for(let i=0;i<14;i++)qa.updateActors(.05);
    qa.scene.updateMatrixWorld(true);
    const weapon=s.asset.weapon;
    const muzzle=weapon.muzzleWorldPosition();
    const start=weapon.rotor.getWorldPosition(new T.Vector3());
    const direction=muzzle.clone().sub(start).normalize();
    const shot=qa.temporary.find(p=>p.target===target&&p.dot);
    if(!shot)throw Error('Actual production combat emitted no projectile');
    const toTarget=shot.to.clone().sub(muzzle).normalize();
    return {alignment:direction.dot(toTarget),spin:weapon.barrelSpin,
      projectileVisible:shot.dot.visible,weaponVisible:weapon.root.visible};
  });
  report.results.push({mode:'production-combat',...combat});
  assert.ok(combat.alignment>.999 && combat.spin>1);
  assert.ok(combat.projectileVisible && combat.weaponVisible);
  await capture('shift-production-combat','side');
  // Abort the actual production URLs, rather than switching to a QA candidate.
  await page.close();
  for(const name of ['Shift','Qwerty']){
    console.log('Checking production fallback:',name);
    const fallback=await context.newPage(),fallbackErrors=[];
    fallback.on('pageerror',e=>fallbackErrors.push(String(e)));
    await fallback.route('**/assets/characters/'+(name==='Shift'?'Shift_Rigged.glb':'Qwerty_Q16_Validated.glb'),r=>r.abort());
    await fallback.goto('http://127.0.0.1:8765/?qwertyQA=front',{waitUntil:'domcontentloaded',timeout:30000});
    await fallback.waitForFunction(name=>{
      const qa=window.__qwertyQA,rig=qa?.crew?.[name];
      let count=0;rig?.root.traverseVisible(n=>{if(n.isMesh)count++});
      return count>0 && document.querySelector('#world').dataset[name.toLowerCase()+'Model']==='legacy'
        && ['glb','glb-q16'].includes(document.querySelector('#world').dataset[name==='Shift'?'qwertyModel':'shiftModel']);
    },name);
    assert.deepEqual(fallbackErrors,[]);
    await fallback.screenshot({path:dir+'/'+name.toLowerCase()+'-fallback.png'});
    report.results.push({mode:name+'-production-load-failure',fallback:true});
    await fallback.close();
  }
  assert.deepEqual(errors,[]);
  report.passed=true;
}catch(e){report.errors.push(String(e));process.exitCode=1;}
finally{
  await writeFile(dir+'/results.json',JSON.stringify(report,null,2));
  await context?.close();await browser?.close();server.kill('SIGTERM');
}
if(report.errors.length)throw Error(report.errors.join('\n'));
console.log('Production mesh, orthographic views, motion, weapon and fallback QA passed');
