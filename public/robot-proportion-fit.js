import * as THREE from './vendor/three.module.js';

// Production skinned-mesh silhouette corrections. GLB bytes, bone hierarchy,
// animations, face art and material identities remain immutable.
function reshape(gltf, offsets) {
  gltf.scene.traverse(node => {
    if (!node.isSkinnedMesh) return;
    const old = node.geometry;
    const geometry = old.clone();
    const positions = geometry.attributes.position;
    const skin = geometry.attributes.skinIndex;
    let modified = false;
    for (let i = 0; i < positions.count; i++) {
      const bone = node.skeleton.bones[skin.getX(i)]?.name;
      const point = offsets[bone];
      if (!point) continue;
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);
      if (typeof point === 'number') y += point;
      else [x, y, z] = point(x, y, z);
      positions.setXYZ(i, x, y, z);
      modified = true;
    }
    if (modified) {
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      node.geometry = geometry;
    } else geometry.dispose();
  });
}

function attachClamp(wrist, side, material) {
  const hook = new THREE.Group();
  hook.name = 'Qwerty.ReferenceClamp.' + (side < 0 ? 'L' : 'R');
  hook.scale.setScalar(1.75);
  const segments = [
    [[0, 0, 0], [side * .080, -.010, .020], .020],
    [[side * .080, -.010, .020], [side * .120, -.043, .020], .017],
    [[side * .120, -.043, .020], [side * .086, -.059, .020], .013],
    [[0, -.018, 0], [side * .071, -.082, .020], .018],
    [[side * .071, -.082, .020], [side * .103, -.111, .020], .015],
    [[side * .103, -.111, .020], [side * .072, -.119, .020], .012]
  ];
  const up = new THREE.Vector3(0, 1, 0);
  for (const [a, b, radius] of segments) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const span = end.clone().sub(start);
    const piece = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, span.length(), 8),
      material
    );
    piece.position.copy(start).add(end).multiplyScalar(.5);
    piece.quaternion.setFromUnitVectors(up, span.normalize());
    piece.castShadow = true;
    piece.receiveShadow = true;
    hook.add(piece);
  }
  wrist.add(hook);
  return hook;
}

// Apply the same depth fit to the body and its spine-bound inset surfaces.
function fitTorsoDepth(gltf, materialName, ratio) {
  const meshes=[];
  gltf.scene.traverse(node=>{if(node.isSkinnedMesh)meshes.push(node)});
  const body=meshes.filter(node=>node.material?.name===materialName);
  if(body.length!==1)throw Error('Ambiguous torso material: '+materialName);
  const p=body[0].geometry.attributes.position,j=body[0].geometry.attributes.skinIndex;
  let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;
  for(let i=0;i<p.count;i++){
    if(body[0].skeleton.bones[j.getX(i)]?.name!=='spine')continue;
    x0=Math.min(x0,p.getX(i));x1=Math.max(x1,p.getX(i));
    z0=Math.min(z0,p.getZ(i));z1=Math.max(z1,p.getZ(i));
  }
  if(!(x1>x0&&z1>z0))throw Error('Invalid torso dimensions: '+materialName);
  const factor=ratio*(x1-x0)/(z1-z0),pivot=(z0+z1)/2;
  for(const node of meshes){
    const geometry=node.geometry.clone(),positions=geometry.attributes.position;
    const joints=geometry.attributes.skinIndex;
    let changed=false;
    for(let i=0;i<positions.count;i++){
      if(node.skeleton.bones[joints.getX(i)]?.name!=='spine')continue;
      positions.setZ(i,pivot+(positions.getZ(i)-pivot)*factor);changed=true;
    }
    if(changed){
      positions.needsUpdate=true;geometry.computeVertexNormals();node.geometry=geometry;
    }else geometry.dispose();
  }
}

// Match arm and forearm cross-section widths to Shift's corresponding legs.
function thickenShiftArms(gltf){
  const meshes=[];
  gltf.scene.traverse(n=>{
    if(n.isSkinnedMesh&&n.material?.name==='Shift/Limb_Black')meshes.push(n);
  });
  if(meshes.length!==1)throw Error('Shift limb primitive missing');
  const node=meshes[0],geometry=node.geometry.clone();
  const p=geometry.attributes.position,j=geometry.attributes.skinIndex;
  const groups=new Map();
  for(let i=0;i<p.count;i++){
    const name=node.skeleton.bones[j.getX(i)]?.name;
    if(!name)continue;
    if(!groups.has(name))groups.set(name,[]);
    groups.get(name).push(i);
  }
  for(const side of ['L','R'])for(const [arm,leg] of [['arm','hip'],['elbow','knee']]){
    const ai=groups.get(arm+side),li=groups.get(leg+side);
    if(!ai?.length||!li?.length)throw Error('Missing Shift limb span: '+arm+side);
    const bounds=indices=>{
      const xs=indices.map(i=>p.getX(i)),zs=indices.map(i=>p.getZ(i));
      return {cx:(Math.min(...xs)+Math.max(...xs))/2,
        cz:(Math.min(...zs)+Math.max(...zs))/2,
        width:Math.max(...xs)-Math.min(...xs),
        depth:Math.max(...zs)-Math.min(...zs)};
    };
    const a=bounds(ai),l=bounds(li);
    if(!(a.width>0&&a.depth>0))throw Error('Zero-width Shift arm: '+arm+side);
    const factor=Math.max(1,Math.min(2.5,
      Math.max(l.width/a.width,l.depth/a.depth)));
    for(const i of ai){
      p.setX(i,a.cx+(p.getX(i)-a.cx)*factor);
      p.setZ(i,a.cz+(p.getZ(i)-a.cz)*factor);
    }
  }
  p.needsUpdate=true;geometry.computeVertexNormals();node.geometry=geometry;
}

export function fitQwertyProportions(gltf) {
  if (gltf.scene.userData.qwertyProportionsFitted) return;
  const limb = [];
  gltf.scene.traverse(node => {
    if (node.isSkinnedMesh && node.material?.name === 'Qwerty/Limb_Black')
      limb.push(node);
  });
  if (limb.length !== 1) throw new Error('Qwerty limb primitive missing or ambiguous');
  const names = ['wristL', 'wristR'];
  const wrists = names.map(name => gltf.scene.getObjectByName(name));
  if (wrists.some(node => !node?.isBone)) throw new Error('Qwerty wrist bones missing');
  const body = [];
  gltf.scene.traverse(node => {
    if (node.isSkinnedMesh && node.material?.name === 'Qwerty/Body_Graphite')
      body.push(node);
  });
  if (body.length !== 1) throw new Error('Qwerty torso shell missing');
  const positions = body[0].geometry.attributes.position;
  const ids = body[0].geometry.attributes.skinIndex;
  let bottom = Infinity, top = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    if (body[0].skeleton.bones[ids.getX(i)]?.name !== 'spine') continue;
    bottom = Math.min(bottom, positions.getY(i));
    top = Math.max(top, positions.getY(i));
  }
  if (!(top > bottom)) throw new Error('Qwerty torso dimensions unavailable');
  const lowerTorso = -.085, torsoCompression = .80;
  const headDrop = (top - bottom) * (1 - torsoCompression);
  const lowerHead = -.170 - headDrop;
  const offsets = {
    spine: (x, y, z) => [x, bottom + (y - bottom) * torsoCompression + lowerTorso, z],
    'armL': lowerTorso, 'armR': lowerTorso,
    'elbowL': lowerTorso, 'elbowR': lowerTorso,
    neck: (x, y, z) => [x, .929 - headDrop + (y - 1.035) * (.016 / .085), z],
    base_plate: lowerHead, skull_upper: lowerHead,
    eyelidL: lowerHead, eyelidR: lowerHead,
    'hipL': -.075, 'hipR': -.075,
    'kneeL': -.040, 'kneeR': -.040,
    'wristL': () => [0, .53, 0],
    'wristR': () => [0, .53, 0]
  };
  reshape(gltf, offsets);
  fitTorsoDepth(gltf, 'Qwerty/Body_Graphite', 1);
  attachClamp(wrists[0], -1, limb[0].material);
  attachClamp(wrists[1], 1, limb[0].material);
  gltf.scene.userData.qwertyProportionsFitted = true;
}

export function fitShiftProportions(gltf) {
  if (gltf.scene.userData.shiftProportionsFitted) return;
  reshape(gltf, {
    spine: -.035,
    'armL': -.035, 'armR': -.035,
    'elbowL': -.035, 'elbowR': -.035,
    'wristL': -.035, 'wristR': -.035,
    neck: (x, y, z) => [x, .848 + (y - .877) * (.014 / .061), z],
    'hipL': -.040, 'hipR': -.040,
    'kneeL': -.018, 'kneeR': -.018,
    head: -.055
  });
  fitTorsoDepth(gltf, 'Shift/Body_Graphite', 1.10);
  thickenShiftArms(gltf);
  const limb = [];
  gltf.scene.traverse(node => {
    if (node.isSkinnedMesh && node.material?.name === 'Shift/Limb_Black') limb.push(node);
  });
  if (limb.length !== 1) throw new Error('Shift limb geometry missing');
  for (const [side, name] of [[-1, 'wristL'], [1, 'wristR']]) {
    const wrist = gltf.scene.getObjectByName(name);
    if (!wrist?.isBone) throw new Error('Shift wrist bone missing: ' + name);
    attachClamp(wrist, side, limb[0].material).name =
      'Shift.ReferenceClamp.' + (side < 0 ? 'L' : 'R');
  }
  gltf.scene.userData.shiftProportionsFitted = true;
}
