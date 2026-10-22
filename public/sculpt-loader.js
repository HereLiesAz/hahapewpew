import * as THREE from './vendor/three.module.js';

// GLB 2.0 runtime for the authored, UV/PBR skinned character assets.
// Kept local; no runtime CDN or dependency on remote model APIs.
const TYPE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const COMPONENT={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
function parseGLB(buffer){
  const view=new DataView(buffer);
  if(buffer.byteLength>24*1024*1024||buffer.byteLength<28||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)throw new Error('Invalid or oversized GLB');
  const n=view.getUint32(12,true);
  if(view.getUint32(16,true)!==0x4e4f534a||n>buffer.byteLength-28)throw new Error('Invalid GLB JSON chunk');
  const g=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n))),binStart=20+n;
  if(view.getUint32(binStart+4,true)!==0x004e4942||view.getUint32(binStart,true)+binStart+8>buffer.byteLength)throw new Error('Invalid GLB binary chunk');
  if(g.asset?.version!=='2.0'||g.buffers?.length!==1||g.skins?.length!==1)throw new Error('Unsupported GLB');
  return {g,buffer,base:binStart+8};
}
function attr(file,index){
  const {g,base,buffer}=file,a=g.accessors[index],v=g.bufferViews[a?.bufferView];
  if(!v||a.sparse||v.byteStride)throw new Error('Unsupported accessor');
  const C=COMPONENT[a.componentType],width=TYPE[a.type];
  if(!C||!width||!Number.isSafeInteger(a.count)||a.count<1)throw new Error('Invalid attribute');
  const begin=base+v.byteOffset+(a.byteOffset||0),size=a.count*width*C.BYTES_PER_ELEMENT;
  if(begin%C.BYTES_PER_ELEMENT!==0||begin+size>buffer.byteLength||size>v.byteLength-(a.byteOffset||0))throw new Error('Invalid view range');
  return new C(buffer,begin,a.count*width).slice();
}
async function textures(file){
  const {g,base,buffer}=file;
  return Promise.all(g.images.map(async img=>{
    const v=g.bufferViews[img.bufferView];
    if(!v||img.mimeType!=='image/png')throw new Error('Invalid texture');
    const b=buffer.slice(base+v.byteOffset,base+v.byteOffset+v.byteLength);
    const bitmap=await createImageBitmap(new Blob([b],{type:'image/png'}),{imageOrientation:'none'});
    const tex=new THREE.Texture(bitmap);
    tex.flipY=false;tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    tex.anisotropy=4;tex.needsUpdate=true;return tex;
  }));
}
async function importCharacter(url){
  const response=await fetch(url,{cache:'force-cache'});
  if(!response.ok)throw new Error('Model unavailable: '+url+' HTTP '+response.status);
  const file=parseGLB(await response.arrayBuffer()),g=file.g,maps=await textures(file);
  const materials=g.materials.map(p=>new THREE.MeshStandardMaterial({
    name:p.name,map:maps[g.textures[p.pbrMetallicRoughness.baseColorTexture.index].source],
    metalness:p.pbrMetallicRoughness.metallicFactor,roughness:p.pbrMetallicRoughness.roughnessFactor,
    side:p.doubleSided?THREE.DoubleSide:THREE.FrontSide
  }));
  const skin=g.skins[0],bones=skin.joints.map(index=>{
    const node=g.nodes[index],bone=new THREE.Bone();
    bone.name=node.name;bone.position.fromArray(node.translation||[0,0,0]);
    if(node.rotation)bone.quaternion.fromArray(node.rotation);
    return bone;
  });
  const jointByNode=new Map(skin.joints.map((index,i)=>[index,bones[i]]));
  for(const index of skin.joints){
    const parent=jointByNode.get(index);
    for(const child of g.nodes[index].children||[])if(jointByNode.has(child))parent.add(jointByNode.get(child));
  }
  const group=new THREE.Group();
  group.add(jointByNode.get(skin.skeleton));
  group.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
  const body=new THREE.Group(),gun=new THREE.Group();gun.visible=false;
  group.add(body,gun);
  for(const node of g.nodes){
    if(node.mesh===undefined)continue;
    const p=g.meshes[node.mesh]?.primitives?.[0];
    if(!p||p.mode!==4)throw new Error('Expected GLB triangles');
    const geo=new THREE.BufferGeometry();
    for(const [source,target,size] of [['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2],['JOINTS_0','skinIndex',4],['WEIGHTS_0','skinWeight',4]]){
      if(p.attributes[source]===undefined)throw new Error('Missing '+source);
      geo.setAttribute(target,new THREE.BufferAttribute(attr(file,p.attributes[source]),size));
    }
    geo.setIndex(new THREE.BufferAttribute(attr(file,p.indices),1));
    const mesh=new THREE.SkinnedMesh(geo,materials[p.material]);
    mesh.name=g.meshes[node.mesh].name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    (mesh.name.endsWith('_gun')?gun:body).add(mesh);
    mesh.bind(skeleton,new THREE.Matrix4());
  }
  const named=Object.fromEntries(bones.map(b=>[b.name,b]));
  return {group,torso:named.Spine,head:named.Head,
    arms:[named.LUpperArm,named.RUpperArm],elbows:[named.LLowerArm,named.RLowerArm],
    legs:[named.LUpperLeg,named.RUpperLeg],knees:[named.LLowerLeg,named.RLowerLeg],
    gun,barrel:named.Barrel||new THREE.Group()};
}
export async function loadSculptedCharacters(actors){
  const names=['Tab','Shift','Qwerty'];
  const replacements=await Promise.all(names.map(name=>importCharacter('/assets/models/'+name.toLowerCase()+'.glb')));
  // Atomic replacement: a missing/corrupt asset leaves all original characters intact.
  for(let i=0;i<names.length;i++){
    const rig=actors[names[i]],replacement=replacements[i];
    rig.root.clear();rig.root.scale.setScalar(1);rig.root.add(replacement.group);
    Object.assign(rig,replacement);
    rig.anchor=names[i]==='Tab'?2.03:names[i]==='Shift'?1.12:1.21;
  }
}