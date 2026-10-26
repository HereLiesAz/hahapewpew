#!/usr/bin/env node
/**
 * Actual game/browser S2.7 acceptance evidence.
 * Requires: npm install --no-save playwright; npx playwright install chromium
 * Run: node scripts/shift_s27_browser_qa.mjs [artifact directory]
 *
 * Never substitutes the production GLB; localhost explicitly selects S27.
 */
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const output=resolve(process.argv[2]||'artifacts/shift-s27');
await mkdir(output,{recursive:true});
const server=spawn('python3',['scripts/serve_shift_qa.py'],{stdio:'pipe'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
const record={cases:[],errors:[]};
async function ready(){
  for(let n=0;n<80;n++){
    if(server.exitCode!==null)throw new Error('QA server exited before readiness');
    try{const result=await fetch('http://127.0.0.1:8765/');if(result.ok)return;}catch{}
    await sleep(150);
  }
  throw new Error('Local S2.7 server did not start');
}
try {
  await ready();
  browser=await chromium.launch({
    headless:true,
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
          '--enable-unsafe-swiftshader','--disable-dev-shm-usage']
  });
  const configurations=[
    ['idle','front'],['walk','threequarter'],['turn','side'],
    ['talk','front'],['weapon','threequarter'],['fire','threequarter'],
    ['fallback','front']
  ];
  for(const [mode,view] of configurations){
    const context=await browser.newContext({
      viewport:{width:1280,height:720},
      recordVideo:{dir:output,size:{width:1280,height:720}}
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    const target='http://127.0.0.1:8765/?shiftQA=s27-'+mode+'&shiftView='+view;
    await page.goto(target,{waitUntil:'domcontentloaded',timeout:25000});
    if(mode==='fallback'){
      await page.waitForFunction(() => {
        const c=document.querySelector('#world');
        return c?.dataset.shiftModel==='legacy' && window.__shiftQA?.crew?.Shift;
      },null,{timeout:20000});
      await page.waitForTimeout(1200);
    } else {
      await page.waitForFunction(()=>
        document.querySelector('#world')?.dataset.shiftModel==='glb-s27'
        && window.__shiftQA?.crew?.Shift?.asset?.s27===true,
      null,{timeout:25000});
      await page.waitForTimeout(mode==='fire'?1600:mode==='weapon'?1100:550);
    }
    if(mode==='fire'){
      // Headless SwiftShader can render far below 60 fps. Advance actual
      // in-game controller with deterministic simulation timesteps, not
      // an unreliable fixed amount of wall-clock time.
      await page.evaluate(()=>{
        const motion=window.__shiftQA.crew.Shift.asset;
        if(!motion?.s27)throw new Error('S27 controller unavailable');
        for(let i=0;i<50;i++)motion.update(.05,{walking:false,firing:true});
      });
    }
    const result=await page.evaluate(mode=>{
      const c=document.querySelector('#world'),rig=window.__shiftQA.crew.Shift;
      const motion=rig.asset?.s27?rig.asset:null;
      let meshes=0;
      rig.root.traverseVisible(obj=>{if(obj.isMesh)meshes++});
      return {
        mode,model:c.dataset.shiftModel,visibleMeshes:meshes,
        fallback:!motion,
        clips:motion?.actionNames||null,
        weaponVisible:motion?.weapon.root.visible??null,
        spin:motion?.weapon.barrelSpin??null,
        deployment:motion?.weapon.deployment??null,
        eyeMaterial:motion?.eyes[0]?.type??null,
        white:motion?.eyes[0]?.color.getHexString()??null
      };
    },mode);
    record.cases.push(result); // Preserve failing observations for diagnosis.
    if(mode==='fallback'){
      if(!result.fallback||result.model!=='legacy'||result.visibleMeshes===0)
        throw new Error('S27 fallback failed: '+JSON.stringify(result));
    } else {
      if(result.fallback||result.model!=='glb-s27'
        ||result.white!=='ffffff'||result.eyeMaterial!=='MeshBasicMaterial')
        throw new Error('Candidate not rendering correctly: '+JSON.stringify(result));
      if((mode==='idle'||mode==='walk'||mode==='turn'||mode==='talk')
          &&result.weaponVisible)throw new Error('Weapon visible during '+mode);
      if((mode==='weapon'||mode==='fire')&&!result.weaponVisible)
        throw new Error('Weapon not deployed in '+mode);
      if(mode==='fire'&&!(result.spin>1))throw new Error('Barrel failed to spin');
      if(mode==='weapon'&&result.spin!==0)throw new Error('Barrel spins before firing');
    }
    if(errors.length)throw new Error('Browser page error: '+errors.join('; '));
    // Preserve the original wide-angle screenshot as gameplay evidence.
    await page.screenshot({path:output+'/'+mode+'-'+view+'.png'});
    // Then frame Shift in the actual game (not a standalone mock viewer).
    // Freeze walking so head/feet and weapon state remain reproducible.
    const frame=await page.evaluate(async ({view})=>{
      const THREE=await import('/vendor/three.module.js');
      const qa=window.__shiftQA,rig=qa?.crew?.Shift;
      if(!qa?.camera||!qa?.cameraControl||!rig?.root)
        throw new Error('Actual game camera/Shift actor missing');
      document.querySelector('#pause').click();
      document.querySelector('#follow').click();
      // Measure real rendered geometry, including the skinned mesh's
      // object/armature scales. A hardcoded height was incorrectly reporting
      // 410px despite a character only ~200px tall in Chromium screenshots.
      const actor=rig.asset?.s27?rig.asset.model:rig.root;
      actor.updateWorldMatrix(true,true);
      const box=new THREE.Box3().setFromObject(actor,true);
      if(box.isEmpty())throw new Error('Shift world-space mesh bounds empty');
      const extent=box.getSize(new THREE.Vector3());
      const target=box.getCenter(new THREE.Vector3());
      const ctl=qa.cameraControl;
      ctl.free.copy(target);
      ctl.point.copy(target);
      const targetPixels=360;
      const fovRadians=qa.camera.fov*Math.PI/180;
      const fit=extent.y*innerHeight/(2*Math.tan(fovRadians/2)*targetPixels);
      ctl.zoom=Math.max(.7,Math.min(3.8,fit));
      ctl.pitch=.12;
      // Shift faces local +Z and its actor root rotates +90deg about Y:
      // its actual front is world +X, not world +Z.
      ctl.yaw=view==='front'?Math.PI:view==='side'?Math.PI/2:Math.PI*.75;
      const distance=ctl.zoom*Math.cos(ctl.pitch);
      qa.camera.position.set(
        target.x-Math.cos(ctl.yaw)*distance,
        target.y+ctl.zoom*Math.sin(ctl.pitch),
        target.z+Math.sin(ctl.yaw)*distance
      );
      qa.camera.lookAt(target);
      qa.camera.updateMatrixWorld(true);
      const bottom=new THREE.Vector3(target.x,box.min.y,target.z).project(qa.camera);
      const top=new THREE.Vector3(target.x,box.max.y,target.z).project(qa.camera);
      const projectedHeight=Math.abs(top.y-bottom.y)*innerHeight/2;
      const center=target.clone().project(qa.camera);
      return {model:document.querySelector('#world')?.dataset.shiftModel,
        measuredWorldHeight:extent.y,measuredWorldWidth:extent.x,
        projectedHeight,centerX:center.x,centerY:center.y,
        yaw:ctl.yaw,zoom:ctl.zoom,pitch:ctl.pitch};
    },{view});
    record.cases[record.cases.length-1].closeup=frame;
    if(frame.model!==result.model || frame.projectedHeight<260 ||
       !Number.isFinite(frame.measuredWorldHeight) ||
       frame.measuredWorldHeight<=0 ||
       Math.abs(frame.centerX)>.15 || Math.abs(frame.centerY)>.15)
      throw new Error('S2.7 geometry-based close-up framing failed: '+JSON.stringify(frame));
    // Camera is held on the frozen actor by the real game's updateCamera().
    await page.waitForTimeout(250);
    await page.screenshot({path:output+'/'+mode+'-'+view+'-closeup.png'});
    await context.close(); // flush WebM recording into output
  }
} catch(error){
  record.errors.push(String(error));
  process.exitCode=1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await writeFile(output+'/results.json',JSON.stringify(record,null,2));
}
if(record.errors.length)throw new Error(record.errors.join('\n'));
console.log('S2.7 WebGL acceptance passes:',record.cases.length);
