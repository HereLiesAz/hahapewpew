import * as THREE from './vendor/three.module.js';

/** Four discrete lighting bands. No photo textures or metallic gloss on either robot. */
const ramp = new THREE.DataTexture(new Uint8Array([
  55,55,55,255, 108,108,108,255, 183,183,183,255, 255,255,255,255
]),4,1,THREE.RGBAFormat);
ramp.magFilter = THREE.NearestFilter;
ramp.minFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

const colors = {
  Qwerty: { Face_Matte:'#626166', Side_Dark:'#333237',
    Outline:'#141418', Body_Graphite:'#49494d', Panel_Gray:'#87868a',
    Limb_Black:'#202024', Eyelid_2D:'#1c1b1e' },
  Shift: { Dome_Graphite:'#777777', Ink_Outline:'#090909',
    Body_Graphite:'#515154', Control_Light:'#92918f', Limb_Black:'#090909',
    nickel:'#a6a6aa', charcoal:'#65656a', rubber:'#26272a',
    glass:'#282a2c', dark:'#242528', oxide:'#635555', cotton:'#727176' }
};
function isEye(m) {
  return (m.name||'').includes('Eyes_2D_Emission') ||
    (m.emissiveIntensity||0)>.55 && !!m.emissive && m.emissive.getHex()!==0;
}
function robotColor(m, robot) {
  for(const [key,color] of Object.entries(colors[robot])){
    if((m.name||'').toLowerCase().includes(key.toLowerCase()))return color;
  }
  return robot==='Qwerty'?'#5c5b60':'#8d8d92';
}
/** Modifies the render materials only, preserving UVs, skins and animation clips. */
export function celShadeRobot(root, robot) {
  if(!colors[robot])throw Error('Only Qwerty and Shift are cel-shaded');
  const replaced=new Map(), eyes=[];
  root.traverse(obj=>{
    if(!obj.isMesh)return;
    function shade(old){
      if(replaced.has(old))return replaced.get(old);
      let m;
      if(isEye(old)){
        m=new THREE.MeshBasicMaterial({name:old.name||robot+'/Eyes_2D_Emission',
          color:'#ffffff',toneMapped:false,side:THREE.DoubleSide});
        eyes.push(m);
      } else {
        m=new THREE.MeshToonMaterial({name:old.name,color:robotColor(old,robot),
          gradientMap:ramp,side:old.side});
      }
      replaced.set(old,m);return m;
    }
    obj.material=Array.isArray(obj.material)?obj.material.map(shade):shade(obj.material);
  });
  return {eyes,gradientMap:ramp};
}
