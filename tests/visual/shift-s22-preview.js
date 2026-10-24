import * as THREE from '../../public/vendor/three.module.js';
import {GLTFLoader} from '../../public/vendor/GLTFLoader.js';
import {celShadeRobot} from '../../public/cel-robots.js';

// Isolated workbench acceptance. Never change /public's installed actor.
const params=new URL(location.href).searchParams;
const view=params.get('view')||'front';
const pose=params.get('pose')||'idle';
const views={
  front:[0,1.08,6],
  side:[6,1.08,0],
  threequarter:[4.2,1.5,4.2],
  back:[0,1.08,-6]
};
const poses=['idle','walk','talk'];
const error=document.querySelector('#error');
if(!Object.hasOwn(views,view)||!poses.includes(pose))
  throw new Error('Supported views: front, side, threequarter, back; poses: idle, walk, talk.');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#18191b');
const camera=new THREE.OrthographicCamera(-2.3,2.3,2.3,-2.3,.01,100);
camera.position.set(...views[view]);
camera.lookAt(0,.90,0);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.AmbientLight(0xffffff,.60));
const sun=new THREE.DirectionalLight(0xffffff,3);
sun.position.set(-3,5,4);
scene.add(sun);
scene.add(new THREE.HemisphereLight('#ffffff','#47494f',1.2));
const grid=new THREE.GridHelper(5,10,'#494b4c','#292b2d');
grid.position.y=0;
scene.add(grid);
function resize() {
  const aspect=innerWidth/Math.max(1,innerHeight);
  camera.left=-2.1*aspect;
  camera.right=2.1*aspect;
  camera.top=2.1;
  camera.bottom=-2.1;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
addEventListener('resize',resize);
resize();
try {
  const sourceAsset=params.get('model')==='s23'?'Shift_S23.glb':'Shift_S22.glb';
 const gltf=await new GLTFLoader().loadAsync(sourceAsset==='Shift_S23.glb'
   ? '../../workbench/shift/Shift_S23.glb'
   : '../../workbench/shift/Shift_S22.glb');
  const gunMount=gltf.scene.getObjectByName('armR');
  let skinned=0;
  gltf.scene.traverse(node=>{if(node.isSkinnedMesh)skinned++;});
  const {eyes}=celShadeRobot(gltf.scene,'Shift');
  const clips=Object.fromEntries(gltf.animations.map(clip=>[clip.name,clip]));
  if(!gunMount?.isBone||!skinned||eyes.length!==1||
     !clips.Shift_Idle||!clips.Shift_Walk||!clips.Shift_Talk)
    throw new Error('Candidate fails Shift runtime contract');
  scene.add(gltf.scene);
  const mixer=new THREE.AnimationMixer(gltf.scene);
  const action=mixer.clipAction(clips['Shift_'+pose[0].toUpperCase()+pose.slice(1)]);
  action.play();
  const staticTime=Number(params.get('time')||0);
  if(!Number.isFinite(staticTime)||staticTime<0||staticTime>30)
    throw new Error('Invalid sample time');
  mixer.update(staticTime);
  const moving=params.get('frames')==='1';
  let last=performance.now();
  function render(now) {
    if(moving)mixer.update(Math.min(.05,Math.max(0,(now-last)/1000)));
    last=now;
    renderer.render(scene,camera);
    if(moving)requestAnimationFrame(render);
  }
  render(performance.now());
  document.body.dataset.shiftReady='true';
  window.__shiftQA={
    ready:true,view,pose,sourceAsset,skinned,arm:gunMount.name,eyeMaterial:eyes[0].type,
    animations:gltf.animations.map(clip=>clip.name),
    scene,renderer,camera,model:gltf.scene,mixer
  };
} catch(e) {
  document.body.dataset.shiftReady='false';
  window.__shiftQA={ready:false,error:String(e)};
  error.textContent=String(e);
  console.error(e);
}
