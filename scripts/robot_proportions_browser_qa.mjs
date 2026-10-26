#!/usr/bin/env node
/** Actual live-asset production browser QA for the owner's Qwerty/Shift sizing. */
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
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
  context=await browser.newContext({viewport:{width:1280,height:720}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  // qwertyQA merely exposes the real scene. It does not swap either character.
  await page.goto('http://127.0.0.1:8765/?qwertyQA=front',
                  {waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForFunction(()=>{
    const q=window.__qwertyQA?.crew;
    const c=document.querySelector('#world');
    return c?.dataset.qwertyModel==='glb-q16' && c.dataset.shiftModel==='glb'
      && q?.Qwerty?.asset?.root && q?.Shift?.asset?.model;
  },null,{timeout:30000});
  await page.waitForTimeout(600);
  const observed=await page.evaluate(async()=>{
    const THREE=await import('/vendor/three.module.js');
    const qa=window.__qwertyQA;
    const q=qa.crew.Qwerty,s=qa.crew.Shift;
    const qbox=new THREE.Box3().setFromObject(q.asset.root,true);
    const sbox=new THREE.Box3().setFromObject(s.asset.model,true);
    if(qbox.isEmpty()||sbox.isEmpty())throw Error('Loaded production GLB has empty bounds');
    const qHeight=qbox.getSize(new THREE.Vector3()).y;
    const shiftHeight=sbox.getSize(new THREE.Vector3()).y;
    return {
      qScale:[q.root.scale.x,q.root.scale.y,q.root.scale.z],
      sScale:[s.root.scale.x,s.root.scale.y,s.root.scale.z],
      qHeight,shiftHeight,relativeHeight:shiftHeight/qHeight,
      glbQ:document.querySelector('#world').dataset.qwertyModel,
      glbS:document.querySelector('#world').dataset.shiftModel
    };
  });
  report.results.push(observed);
  if(observed.qScale.some(v=>v!==.27)||observed.sScale.some(v=>v!==.46)||
     observed.relativeHeight<.84||observed.relativeHeight>.995)
    throw Error('Production character scale/height mismatch: '+JSON.stringify(observed));
  if(errors.length)throw Error(errors.join('; '));
  await page.screenshot({path:dir+'/production-wide.png'});
  await page.evaluate(()=>{
    if(document.querySelector('#pause').getAttribute('aria-pressed')!=='true')
      document.querySelector('#pause').click();
    if(document.querySelector('#follow').getAttribute('aria-pressed')==='true')
      document.querySelector('#follow').click();
  });
  for(const mode of ['shift-front','shift-top','qwerty-front']){
    const frame=await page.evaluate(async name=>{
      const THREE=await import('/vendor/three.module.js');
      const qa=window.__qwertyQA,ctl=qa.cameraControl;
      const s=name==='qwerty-front'?qa.crew.Qwerty.asset.root:qa.crew.Shift.asset.model;
      const bb=new THREE.Box3().setFromObject(s,true);
      const target=bb.getCenter(new THREE.Vector3());
      ctl.free.copy(target);ctl.point.copy(target);
      ctl.pitch=name==='shift-top'?1.50:.12;
      ctl.yaw=name==='shift-front'?Math.PI:name==='qwerty-front'?Math.PI:0;
      ctl.zoom=name==='shift-top'?1.20:name==='qwerty-front'?1.60:1.55;
      qa.camera.up.set(0,1,0);
      const dx=ctl.zoom*Math.cos(ctl.pitch),dy=ctl.zoom*Math.sin(ctl.pitch);
      qa.camera.position.set(target.x-Math.cos(ctl.yaw)*dx,
                             target.y+dy,
                             target.z+Math.sin(ctl.yaw)*dx);
      qa.camera.lookAt(target);qa.camera.updateMatrixWorld(true);
      return {mode:name,modelHeight:bb.getSize(new THREE.Vector3()).y,
        target:target.toArray(),pitch:ctl.pitch,zoom:ctl.zoom};
    },mode);
    await page.waitForTimeout(750);
    if(errors.length)throw Error(errors.join('; '));
    await page.screenshot({path:dir+'/'+mode+'.png'});
    report.results.push(frame);
  }
  report.passed=true;
}catch(e){
  report.errors.push(String(e));
  process.exitCode=1;
}finally{
  await writeFile(dir+'/results.json',JSON.stringify(report,null,2));
  await context?.close();
  await browser?.close();
  server.kill('SIGTERM');
}
if(report.errors.length)throw Error(report.errors.join('\n'));
console.log('Production Qwerty/Shift actual-game screenshot QA passed');
