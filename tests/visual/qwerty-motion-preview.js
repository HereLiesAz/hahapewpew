import * as THREE from '../../public/vendor/three.module.js';
import {GLTFLoader} from '../../public/vendor/GLTFLoader.js';
import {createQwertyMotionRig} from '../../public/qwerty-motion.js';
const url=new URL(location.href);
const pose=url.searchParams.get('pose')||'idle';
const scene=new THREE.Scene();
scene.background=new THREE.Color('#c4bfb2');
const camera=new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.01,100);
camera.position.set(3.0,2.5,6.6);camera.lookAt(0,1.48,0);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff,.66));
const directional=new THREE.DirectionalLight(0xffffff,3.5);directional.position.set(-2,5,6);scene.add(directional);
scene.add(new THREE.HemisphereLight('#fff5e1','#57545b',1.1));
const grid=new THREE.GridHelper(8,8,'#827a74','#aaa297');grid.position.y=0;scene.add(grid);
try {
 const g=await new GLTFLoader().loadAsync('../../workbench/qwerty/Qwerty_Q16_validated.glb');
 const rig=createQwertyMotionRig(g);scene.add(g.scene);
 if(pose==='talk'||pose==='combined')rig.setSpeaking(true);
 if(pose==='lids')rig.setLids(true,true);
 if(pose==='kill')rig.setKillMode(true);
 const frames=Number(url.searchParams.get('frames')||0);
 const staticTime=Number(url.searchParams.get('time')||0);
 if(staticTime)rig.update(staticTime);
 let last=performance.now();
 function frame(now) {
  if(frames)rig.update(Math.min((now-last)/1000,.05));
  last=now;renderer.render(scene,camera);
  if(frames)requestAnimationFrame(frame);
 }
 frame(performance.now());
 window.__motion={ready:true,pose,skullY:rig.skull.position.y,plateY:rig.fixedPlate.position.y,
    toonBands:4,eyeMaterial:rig.eyes[0].type,clipName:rig.walk.getClip().name};
} catch(e){window.__motion={ready:false,error:String(e)};document.body.textContent=String(e);}
