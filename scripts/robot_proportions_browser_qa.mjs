#!/usr/bin/env node
/** Inspect production GLBs, actual skinned vertices and complete motion in Chromium.
 * All captures use the real game scene; orthographic captures render synchronously
 * before the normal game camera resumes. No workbench model is substituted.
 */
import {spawn,spawnSync} from 'node:child_process';
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
    const surfaces=[...qa.groups.values()].flatMap(g=>g.userData.walkSurfaces);
    const contact=s.asset.ground(s.root,surfaces);
    if(!contact)throw Error('No rendered road under Shift');
    // Put the neutral Qwerty comparison on the same support plane. This is
    // QA placement only; production Qwerty motion remains unchanged.
    q.root.position.y+=contact.surfaceY-bounds(q.asset.root).min.y;
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
    let domeNormalSeams=0,domeSharedVertices=0;
    s.asset.model.traverse(n=>{
      if(!n.isMesh||n.material.name!=='Shift/Dome_Side')return;
      const p=n.geometry.attributes.position,normal=n.geometry.attributes.normal;
      const heights=Array.from({length:p.count},(_,i)=>p.getY(i));
      const lo=Math.min(...heights),hi=Math.max(...heights),seen=new Map();
      for(let i=0;i<p.count;i++){
        if(p.getY(i)<=lo+1e-5||p.getY(i)>=hi-1e-5)continue;
        const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join(',');
        const value=new T.Vector3().fromBufferAttribute(normal,i);
        if(seen.has(key)){
          domeSharedVertices++;
          if(value.distanceTo(seen.get(key))>1e-6)domeNormalSeams++;
        }else seen.set(key,value);
      }
    });
    const face=s.asset.faceGraphics;
    let eyeSurfaceGap=0,visibleRaisedEyes=0,raisedInkIndices=0,whitePixels=0,blackPixels=0;
    qa.scene.updateMatrixWorld(true);
    for(const {mesh,source,sourceIndices} of face.layers){
      mesh.skeleton.update();source.skeleton.update();
      for(let i=0;i<sourceIndices.length;i++){
        const printed=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
        const shellPoint=source.getVertexPosition(sourceIndices[i],new T.Vector3()).applyMatrix4(source.matrixWorld);
        eyeSurfaceGap=Math.max(eyeSurfaceGap,printed.distanceTo(shellPoint));
      }
    }
    s.asset.model.traverse(n=>{
      if(n.material?.name==='Shift/Eyes_2D_Emission'&&n.material!==face.material&&n.visible)visibleRaisedEyes++;
      if(n.material?.name==='Shift/Ink_Outline')
        raisedInkIndices=n.geometry.index?Array.from(n.geometry.index.array).filter(i=>i>=288&&i<2016).length:Infinity;
    });
    const mask=face.texture.image.data;
    for(let i=0;i<mask.length;i+=4)if(mask[i+3]===255){if(mask[i]===255)whitePixels++;else blackPixels++;}
    window.__productionQA={T,qa,q,s,points,bounds,qb,sb};
    return {qScale:q.root.scale.toArray(),sScale:s.root.scale.toArray(),
      qHeight:qb.max.y-qb.min.y,shiftHeight:sb.max.y-sb.min.y,
      eyeSurfaceGap,printedEyeLayers:face.layers.length,visibleRaisedEyes,raisedInkIndices,whitePixels,blackPixels,
      relativeHeight:(sb.max.y-sb.min.y)/(qb.max.y-qb.min.y),qTorso,sTorso,
      domeRise:db.max.y-db.min.y,domeDiameter:Math.max(db.max.x-db.min.x,db.max.z-db.min.z),domeNormalSeams,domeSharedVertices,
      qFoot:qb.min.y,shiftFoot:sb.min.y,surfaceY:contact.surfaceY,ringCount:rings.size,radialError,
      clips:s.asset.actionNames,barrels:s.asset.weapon.barrelCount,
      models:[document.querySelector('#world').dataset.qwertyModel,document.querySelector('#world').dataset.shiftModel]};
  });
  report.results.push({mode:'neutral-production',...measured});
  assert.deepEqual(measured.qScale,[.27,.27,.27]);
  assert.deepEqual(measured.sScale,[.46,.46,.46]);
  assert.ok(Number.isFinite(measured.relativeHeight)&&measured.relativeHeight>0);
  assert.ok(measured.domeRise/measured.domeDiameter>.26&&measured.domeRise/measured.domeDiameter<.30,'head must be a shallow wok');
  assert.ok(Math.abs(measured.qTorso-measured.sTorso)/measured.qTorso<.01);
  assert.ok(Math.abs(measured.qFoot-measured.surfaceY)<1e-6);
  assert.ok(Math.abs(measured.shiftFoot-measured.surfaceY)<1e-6);
  assert.equal(measured.domeNormalSeams,0);
  assert.ok(measured.domeSharedVertices>1000);
  assert.equal(measured.ringCount,11);
  assert.ok(measured.radialError<2e-6);
  assert.ok(measured.eyeSurfaceGap<1e-8);
  assert.equal(measured.printedEyeLayers,2);
  assert.equal(measured.visibleRaisedEyes,0);
  assert.equal(measured.raisedInkIndices,0);
  assert.ok(measured.whitePixels>0&&measured.blackPixels>0);
  assert.equal(measured.barrels,6);
  assert.deepEqual(measured.clips,['Shift_Walk','Shift_Idle','Shift_Talk','Shift_Turn','Shift_Weapon']);

  async function capture(mode,view='front',pair=false){
    const result=await page.evaluate(({view,pair})=>{
      const {T,qa,q,s,bounds}=window.__productionQA;
      const eyes=view==='eyes'||view==='eyes-side',gun=view==='gun'||view==='gun-muzzle';
      const box=view==='motion'?window.__productionQA.motionBox:gun?bounds(s.asset.weapon.root,view==='gun-muzzle'?'Shift/Control_Light':null):eyes?bounds(s.asset.model,'Shift/Dome_Side'):pair?bounds(q.asset.root).union(bounds(s.asset.model))
        :bounds(view==='qwerty'?q.asset.root:s.asset.model);
      const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
      const aspect=innerWidth/innerHeight;
      const half=eyes?Math.max(size.y*.65,Math.max(size.x,size.z)*.55/aspect):Math.max(size.y,size.x,size.z)*.65;
      const cam=new T.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,30);
      let direction=view==='top'?new T.Vector3(0,1,0)
        :(view==='side'||view==='eyes-side')?new T.Vector3(0,0,-1):(view==='threequarter'||view==='motion')?new T.Vector3(1,0,-1).normalize():new T.Vector3(1,0,0);
      if(gun){
        direction=new T.Vector3(1,0,0).transformDirection(s.asset.weapon.rotor.matrixWorld);
        if(view==='gun')direction.applyAxisAngle(new T.Vector3(0,1,0),Math.PI/3);
      }
      cam.position.copy(center).addScaledVector(direction,gun?Math.max(size.x,size.y,size.z)*1.5+.02:5);
      cam.up.set(0,view==='top'?0:1,view==='top'?-1:0);
      cam.lookAt(center);cam.updateMatrixWorld(true);
      // Prevent the other actor occluding single-character side views.
      const hidden=[];
      for(const rig of [qa.crew.Tab,q,s])if(rig===qa.crew.Tab||(!pair&&rig!==(view==='qwerty'?q:s))){
        hidden.push([rig.root,rig.root.visible]);rig.root.visible=false;
      }
      qa.renderer.render(qa.scene,cam);
      const data=qa.renderer.domElement.toDataURL('image/png');
      let imageRange=null;
      if(gun){
        const probe=document.createElement('canvas');probe.width=160;probe.height=100;
        const ctx=probe.getContext('2d');ctx.drawImage(qa.renderer.domElement,0,0,160,100);
        const rgba=ctx.getImageData(0,0,160,100).data;
        let low=255,high=0;
        for(let i=0;i<rgba.length;i+=4){low=Math.min(low,rgba[i],rgba[i+1],rgba[i+2]);high=Math.max(high,rgba[i],rgba[i+1],rgba[i+2]);}
        imageRange=high-low;
      }
      hidden.forEach(([root,visible])=>{root.visible=visible});
      // A fixed camera envelope is not the actor's measured pixel height.
      const measuredBox=view==='motion'?bounds(s.asset.model):box;
      const measuredCenter=measuredBox.getCenter(new T.Vector3());
      const top=new T.Vector3(measuredCenter.x,measuredBox.max.y,measuredCenter.z).project(cam);
      const bottom=new T.Vector3(measuredCenter.x,measuredBox.min.y,measuredCenter.z).project(cam);
      let projectedSpan=null;
      if(gun){
        const pixels=window.__productionQA.points(s.asset.weapon.root).map(p=>p.project(cam));
        projectedSpan=Math.max(
          (Math.max(...pixels.map(p=>p.x))-Math.min(...pixels.map(p=>p.x)))*innerWidth/2,
          (Math.max(...pixels.map(p=>p.y))-Math.min(...pixels.map(p=>p.y)))*innerHeight/2);
      }
      return {data,projection:cam.type,direction:direction.toArray(),projectedSpan,imageRange,
        projectedHeight:Math.abs(top.y-bottom.y)*innerHeight/2,
        bounds:{min:measuredBox.min.toArray(),max:measuredBox.max.toArray()},
        cameraBounds:view==='motion'?{min:box.min.toArray(),max:box.max.toArray()}:null};
    },{view,pair});
    await writeFile(dir+'/'+mode+'.png',Buffer.from(result.data.split(',')[1],'base64'));
    delete result.data;report.results.push({mode,...result});
    if(view==='gun'||view==='gun-muzzle'){
      assert.ok(result.projectedSpan>300);assert.ok(result.imageRange>20,'weapon close-up is blank');
    }
    else if(view!=='top')assert.ok(result.projectedHeight>300);
    return result;
  }
  await capture('production-pair','front',true);
  await capture('shift-front');
  await capture('shift-side','side');
  await capture('shift-threequarter','threequarter');
  await capture('shift-eyes-front','eyes');
  await capture('shift-eyes-side','eyes-side');
  const overhead=await capture('shift-top-orthographic','top');
  assert.deepEqual(overhead.direction,[0,1,0]);
  await capture('qwerty-front','qwerty');

  // Calibrate the actual installed materials through WebGL, rather than only
  // inspecting ramp bytes. These flat swatches isolate lighting/colour math.
  const shading=await page.evaluate(()=>{
    const {T,qa,s}=window.__productionQA,renderer=qa.renderer;
    const materials=new Map();
    s.asset.model.traverseVisible(n=>{if(n.isMesh&&n.material.isMeshToonMaterial)materials.set(n.material.name,n.material)});
    const entries=[...materials.entries()].sort(([a],[b])=>a.localeCompare(b));
    const face=s.asset.faceGraphics,mask=face.texture.image;
    function solidUV(value){
      for(let y=1;y<mask.height-1;y++)for(let x=1;x<mask.width-1;x++){
        let solid=true;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const i=((y+dy)*mask.width+x+dx)*4;
          if(mask.data[i]!==value||mask.data[i+3]!==255)solid=false;
        }
        if(solid)return [(x+.5)/mask.width,(y+.5)/mask.height];
      }
      throw Error('No solid printed-face texel');
    }
    const whiteUV=solidUV(255),blackUV=solidUV(0);
    const scene=new T.Scene();scene.background=new T.Color(0x202020);
    const light=new T.DirectionalLight(0xffffff,Math.PI);light.position.set(0,0,3);scene.add(light);
    const camera=new T.OrthographicCamera(-4,4,2.5,-2.5,.01,10);camera.position.z=3;
    const geometries=[],rows=[-.75,-.25,.25,.75],bands=[120,158,211,255];
    const samples=[],probe=document.createElement('canvas');probe.width=160;probe.height=100;
    const ctx=probe.getContext('2d');
    const oldTone=renderer.toneMapping;
    try{
      renderer.toneMapping=T.NoToneMapping;
      for(let col=0;col<8;col++)for(let row=0;row<4;row++){
        const geometry=new T.PlaneGeometry(.8,.8);geometries.push(geometry);
        const normal=geometry.attributes.normal;
        for(let i=0;i<normal.count;i++)normal.setXYZ(i,Math.sqrt(1-rows[row]**2),0,rows[row]);
        let material;
        if(col<6)material=entries[col][1];
        else{
          material=face.material;const uv=col===6?whiteUV:blackUV;
          for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setXY(i,...uv);
        }
        const tile=new T.Mesh(geometry,material);tile.position.set(col-3.5,1.5-row,0);scene.add(tile);
      }
      renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,160,100);
      for(let col=0;col<8;col++){
        const pixels=[],expected=[];
        for(let row=0;row<4;row++){
          pixels.push([...ctx.getImageData(10+col*20,20+row*20,1,1).data].slice(0,3));
          const color=col<6?entries[col][1].color.clone().multiplyScalar(bands[row]/255):new T.Color(col===6?0xffffff:0);
          expected.push(color.getHexString().match(/../g).map(v=>parseInt(v,16)));
        }
        samples.push({material:col<6?entries[col][0]:col===6?'printed-white':'printed-black',pixels,expected});
      }
      return {samples,data:renderer.domElement.toDataURL('image/png')};
    }finally{renderer.toneMapping=oldTone;geometries.forEach(g=>g.dispose());}
  });
  await writeFile(dir+'/shift-material-gpu-bands.png',Buffer.from(shading.data.split(',')[1],'base64'));delete shading.data;
  for(const sample of shading.samples){
    for(let row=0;row<4;row++)for(let channel=0;channel<3;channel++)
      assert.ok(Math.abs(sample.pixels[row][channel]-sample.expected[row][channel])<=2,JSON.stringify(sample));
    if(sample.material.startsWith('Shift/'))assert.equal(new Set(sample.pixels.map(p=>p.join(','))).size,4);
  }
  report.results.push({mode:'production-material-gpu-bands',...shading});

  // Render the real installed skinned mesh in isolation under two controlled
  // light levels. Keep the production renderer's tone mapping and face mask.
  const lighting=await page.evaluate(()=>{
    const {T,qa,s,bounds}=window.__productionQA,root=s.root,parent=root.parent;
    const isolated=new T.Scene();isolated.background=new T.Color(0x202020);
    const light=new T.DirectionalLight(0xffffff,0);light.position.set(5,4,2);isolated.add(light);
    const box=bounds(s.asset.model),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
    const half=Math.max(size.x,size.y,size.z)*.65,aspect=innerWidth/innerHeight;
    const camera=new T.OrthographicCamera(-half*aspect,half*aspect,half,-half,.01,30);
    camera.position.copy(center).add(new T.Vector3(5,0,0));camera.lookAt(center);
    const probe=document.createElement('canvas');probe.width=innerWidth;probe.height=innerHeight;
    const ctx=probe.getContext('2d'),frames=[];
    try{
      isolated.attach(root);
      for(const intensity of [0,Math.PI*3]){
        light.intensity=intensity;qa.renderer.render(isolated,camera);
        ctx.drawImage(qa.renderer.domElement,0,0);
        const pixels=ctx.getImageData(0,0,probe.width,probe.height).data;
        frames.push({intensity,pixels,data:qa.renderer.domElement.toDataURL('image/png')});
      }
      let whitePixels=0,whiteChanged=0,changedPixels=0;
      for(let i=0;i<frames[0].pixels.length;i+=4){
        const a=frames[0].pixels,b=frames[1].pixels;
        if(a[i]===255&&a[i+1]===255&&a[i+2]===255){
          whitePixels++;if(b[i]!==255||b[i+1]!==255||b[i+2]!==255)whiteChanged++;
        }
        if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>20)changedPixels++;
      }
      return {whitePixels,whiteChanged,changedPixels,frames:frames.map(({intensity,data})=>({intensity,data}))};
    }finally{parent.attach(root);qa.scene.updateMatrixWorld(true);}
  });
  for(let i=0;i<lighting.frames.length;i++){
    await writeFile(dir+'/shift-light-'+(i?'bright':'dark')+'.png',Buffer.from(lighting.frames[i].data.split(',')[1],'base64'));
    delete lighting.frames[i].data;
  }
  assert.ok(lighting.whitePixels>1000);assert.equal(lighting.whiteChanged,0);
  assert.ok(lighting.changedPixels>10000,'actual shell must respond to light');
  report.results.push({mode:'production-skinned-lighting',...lighting});

  // Film production playback from deterministic rendered frames. The camera
  // stays fixed across each sequence; video time follows simulated clip time.
  const sequences=[
    ['idle','Shift_Idle'],['walk','Shift_Walk'],['talk','Shift_Talk'],
    ['turn','Shift_Turn'],['weapon','Shift_Weapon']
  ];
  for(const [mode,clip] of sequences){
    const frameDir=dir+'/shift-motion-'+mode;
    await mkdir(frameDir,{recursive:true});
    const setup=await page.evaluate(({mode,clip})=>{
      const {s,sb}=window.__productionQA,a=s.asset;
      a.mixer.stopAllAction();a.model.traverse(n=>{if(n.isSkinnedMesh)n.pose()});
      Object.values(a.clips).forEach(action=>action.reset().play());
      a.weapon.pose(0,0);a.weapon.setDeployed(false);
      window.__productionQA.motionBox=sb.clone().expandByScalar(.06);
      return {duration:mode==='weapon'?3:a.clips[clip].getClip().duration,
        frames:mode==='weapon'?60:24,
        rest:Object.fromEntries(['spine','head','root','hipL','wristR'].map(n=>[n,(a.bones[n]||a.model.getObjectByName(n)).quaternion.toArray()]))};
    },{mode,clip});
    const samples=[];
    for(let frame=0;frame<setup.frames;frame++){
      const sample=await page.evaluate(({mode,frame,dt})=>{
        const {T,qa,s,bounds,motionBox}=window.__productionQA,a=s.asset;
        a.update(dt,{walking:mode==='walk',speaking:mode==='talk',turning:mode==='turn',
          deploy:mode==='weapon'&&frame<20,firing:mode==='weapon'&&frame>=20&&frame<40});
        const surfaces=[...qa.groups.values()].flatMap(g=>g.userData.walkSurfaces);
        if(!a.ground(s.root,surfaces))throw Error('Motion frame lacks road contact');
        qa.scene.updateMatrixWorld(true);
        const actual=bounds(a.model);
        if(!motionBox.containsBox(actual))throw Error('Motion escaped fixed camera bounds');
        const layer=a.faceGraphics.layers[0],eyeIndex=0;
        layer.mesh.skeleton.update();
        const eye=layer.mesh.getVertexPosition(eyeIndex,new T.Vector3()).applyMatrix4(layer.mesh.matrixWorld);
        eye.applyMatrix4(a.bones.head.matrixWorld.clone().invert());
        return {joints:Object.fromEntries(['spine','head','root','hipL','wristR'].map(n=>[n,(a.bones[n]||a.model.getObjectByName(n)).quaternion.toArray()])),
          eye:eye.toArray(),visible:a.weapon.root.visible,spin:a.weapon.barrelSpin};
      },{mode,frame,dt:setup.duration/setup.frames});
      samples.push(sample);
      await capture('shift-motion-'+mode+'/frame-'+String(frame).padStart(3,'0'),'motion');
    }
    const joint=mode==='idle'?'spine':mode==='walk'?'hipL':mode==='talk'?'head':mode==='turn'?'root':'wristR';
    if(joint)assert.ok(samples.some(s=>s.joints[joint].some((v,i)=>Math.abs(v-setup.rest[joint][i])>1e-4)),mode+' joint static');
    for(const sample of samples)
      assert.ok(Math.hypot(...sample.eye.map((v,i)=>v-samples[0].eye[i]))<2e-6,'eye moves independently of head');
    if(mode==='weapon'){
      assert.ok(samples.slice(20,40).some(s=>s.visible&&s.spin>1));
      assert.equal(samples.at(-1).visible,false);assert.equal(samples.at(-1).spin,0);
    }else assert.ok(samples.every(s=>!s.visible));
    const encoded=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(setup.frames/setup.duration),
      '-i',frameDir+'/frame-%03d.png','-c:v','libvpx-vp9','-pix_fmt','yuv420p',dir+'/shift-motion-'+mode+'.webm'],
      {encoding:'utf8',timeout:60000});
    assert.equal(encoded.status,0,encoded.error?.message||encoded.stderr);
    const checked=spawnSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0',
      '-show_entries','stream=nb_read_frames,width,height,r_frame_rate','-of','json',dir+'/shift-motion-'+mode+'.webm'],{encoding:'utf8',timeout:15000});
    assert.equal(checked.status,0,checked.error?.message||checked.stderr);
    const video=JSON.parse(checked.stdout).streams[0];
    assert.equal(Number(video.nb_read_frames),setup.frames);assert.equal(video.width,1600);assert.equal(video.height,1000);
    const [numerator,denominator]=video.r_frame_rate.split('/').map(Number);
    assert.ok(Math.abs(setup.frames/(numerator/denominator)-setup.duration)<.01,'encoded timebase differs from simulation');
    report.results.push({mode:'production-motion-'+mode,duration:setup.duration,frames:setup.frames,video,samples});
  }

  // Sample a complete authored walk cycle using the production controller and
  // actual road triangles. Inspect every skinned ankle vertex, not root height.
  const gait=[];
  for(let frame=0;frame<32;frame++){
    const sample=await page.evaluate(()=>{
      const {T,qa,s}=window.__productionQA;
      if(!window.__productionQA.gaitStarted){
        Object.values(s.asset.clips).forEach(a=>a.reset().play());
        window.__productionQA.gaitStarted=true;
      }
      s.asset.update(s.asset.clips.Shift_Walk.getClip().duration/32,{walking:true});
      const surfaces=[...qa.groups.values()].flatMap(g=>g.userData.walkSurfaces);
      if(!s.asset.ground(s.root,surfaces))throw Error('Walk has no road support');
      qa.scene.updateMatrixWorld(true);
      const feet=[];
      for(const name of ['ankleL','ankleR']){
        const vertices=[];
        s.asset.model.traverseVisible(mesh=>{
          if(!mesh.isSkinnedMesh)return;
          mesh.skeleton.update();
          const joints=mesh.geometry.attributes.skinIndex;
          for(let i=0;i<joints.count;i++)if(mesh.skeleton.bones[joints.getX(i)]?.name===name)
            vertices.push(mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld));
        });
        if(!vertices.length)throw Error('Missing rendered foot: '+name);
        let clearance=Infinity;
        for(const vertex of vertices){
          const ray=new T.Raycaster(vertex.clone().add(new T.Vector3(0,2,0)),new T.Vector3(0,-1,0),0,4);
          const hit=ray.intersectObjects(surfaces,false)[0];
          if(!hit)throw Error('No road beneath rendered foot vertex');
          clearance=Math.min(clearance,vertex.y-hit.point.y);
        }
        feet.push({name,clearance,vertices:vertices.length});
      }
      return {time:s.asset.mixer.time,feet,
        knees:['kneeL','kneeR'].map(n=>s.asset.bones[n].quaternion.toArray())};
    });
    for(const foot of sample.feet)assert.ok(foot.clearance>=-1e-6,'animated foot penetrates road');
    assert.ok(Math.min(...sample.feet.map(f=>f.clearance))<1e-6,'neither foot supports walk');
    gait.push(sample);
    if([0,10,21].includes(frame))await capture('shift-walk-'+frame,'threequarter');
  }
  for(let knee=0;knee<2;knee++)assert.ok(gait.some(s=>s.knees[knee].some((v,i)=>Math.abs(v-gait[0].knees[knee][i])>1e-4)),'knee did not animate');
  report.results.push({mode:'production-body-gait',samples:gait});

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
      let visibleMeshes=0;
      a.weapon.root.traverseVisible(n=>{if(n.isMesh)visibleMeshes++;});
      return {visible:a.weapon.root.visible,visibleMeshes,spin:a.weapon.barrelSpin,deployment:a.weapon.deployment};
    },mode);
    report.results.push({mode:'weapon-'+mode,...weapon});
    assert.equal(weapon.visible,mode==='deploy'||mode==='fire');
    assert.equal(weapon.visibleMeshes>0,weapon.visible);
    if(mode==='fire')assert.ok(weapon.spin>1);
    else assert.equal(weapon.spin,0);
    await capture('shift-weapon-'+mode,'side');
    if(mode==='deploy'){
      await capture('shift-gun-deployed-close','gun');
      await capture('shift-gun-six-muzzles','gun-muzzle');
    }
    if(mode==='fire'){
      await capture('shift-gun-spin-before','gun-muzzle');
      const spin=await page.evaluate(()=>{
        const {T,qa,s}=window.__productionQA,w=s.asset.weapon;
        function sample(){
          qa.scene.updateMatrixWorld(true);
          const barrels=w.rotor.children.filter(n=>n.name.startsWith('Shift.Weapon.Barrel.'));
          return {vertices:barrels.map(n=>n.getVertexPosition(0,new T.Vector3()).applyMatrix4(n.matrixWorld).toArray()),
            muzzle:w.muzzleWorldPosition().toArray(),hinge:w.hinge.quaternion.toArray(),slide:w.extend.position.toArray()};
        }
        const before=sample();
        w.update(.017);
        return {before,after:sample()};
      });
      assert.equal(spin.before.vertices.length,6);
      const displacement=spin.before.vertices.map((p,i)=>Math.hypot(...p.map((v,k)=>v-spin.after.vertices[i][k])));
      assert.ok(displacement.every(d=>d>.001),'rendered barrels must rotate');
      assert.deepEqual(spin.before.hinge,spin.after.hinge);
      assert.deepEqual(spin.before.slide,spin.after.slide);
      assert.ok(Math.hypot(...spin.before.muzzle.map((v,i)=>v-spin.after.muzzle[i]))<1e-6);
      report.results.push({mode:'rendered-barrel-motion',...spin,displacement});
      await capture('shift-gun-spin-after','gun-muzzle');
    }

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
      projectileVisible:shot.dot.visible,weaponVisible:weapon.root.visible,
      groundGap:(()=>{
        const foot=window.__productionQA.bounds(s.asset.model).min.y;
        const ray=new T.Raycaster(new T.Vector3(s.root.position.x,2,s.root.position.z),new T.Vector3(0,-1,0));
        const road=ray.intersectObjects([...qa.groups.values()].flatMap(g=>g.userData.walkSurfaces),false)[0];
        if(!road)throw Error('No rendered road in combat');
        return foot-road.point.y;
      })()};
  });
  report.results.push({mode:'production-combat',...combat});
  assert.ok(combat.alignment>.999 && combat.spin>1);
  assert.ok(combat.projectileVisible && combat.weaponVisible);
  assert.ok(Math.abs(combat.groundGap)<1e-6);
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
