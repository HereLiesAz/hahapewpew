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

function updateRestBind(gltf) {
  gltf.scene.updateMatrixWorld(true);
  const visited = new Set();
  gltf.scene.traverse(node => {
    if (!node.isSkinnedMesh || visited.has(node.skeleton)) return;
    visited.add(node.skeleton);
    node.skeleton.calculateInverses();
  });
}

function attachClamp(wrist, side, material) {
  const hook = new THREE.Group();
  hook.name = 'Qwerty.ReferenceClamp.' + (side < 0 ? 'L' : 'R');
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
  const spine = gltf.scene.getObjectByName('spine');
  const neckBone = gltf.scene.getObjectByName('neck');
  if (!spine?.isBone || !neckBone?.isBone) throw new Error('Qwerty spine/neck missing');
  spine.position.y -= .085;
  neckBone.position.y -= .085;
  for (const side of ['L', 'R']) {
    const hip = gltf.scene.getObjectByName('hip' + side);
    const knee = gltf.scene.getObjectByName('knee' + side);
    const ankle = gltf.scene.getObjectByName('ankle' + side);
    if (![hip, knee, ankle].every(node => node?.isBone)) throw new Error('Qwerty leg bones missing');
    hip.position.y -= .075;
    knee.position.y += .035;
    ankle.position.y += .040;
  }
  const lowerTorso = -.085;
  const lowerHead = -.170;
  const offsets = {
    spine: lowerTorso,
    'armL': lowerTorso, 'armR': lowerTorso,
    'elbowL': lowerTorso, 'elbowR': lowerTorso,
    neck: (x, y, z) => [x, .929 + (y - 1.035) * (.016 / .085), z],
    base_plate: lowerHead, skull_upper: lowerHead,
    eyelidL: lowerHead, eyelidR: lowerHead,
    'hipL': -.075, 'hipR': -.075,
    'kneeL': -.040, 'kneeR': -.040,
    'wristL': () => [0, .53, 0],
    'wristR': () => [0, .53, 0]
  };
  reshape(gltf, offsets);
  updateRestBind(gltf);
  attachClamp(wrists[0], -1, limb[0].material);
  attachClamp(wrists[1], 1, limb[0].material);
  gltf.scene.userData.qwertyProportionsFitted = true;
}

export function fitShiftProportions(gltf) {
  if (gltf.scene.userData.shiftProportionsFitted) return;
  const spine = gltf.scene.getObjectByName('spine');
  const neckBone = gltf.scene.getObjectByName('neck');
  if (!spine?.isBone || !neckBone?.isBone) throw new Error('Shift spine/neck missing');
  spine.position.y -= .035;
  neckBone.position.y -= .020;
  for (const side of ['L', 'R']) {
    const hip = gltf.scene.getObjectByName('hip' + side);
    const knee = gltf.scene.getObjectByName('knee' + side);
    const ankle = gltf.scene.getObjectByName('ankle' + side);
    if (![hip, knee, ankle].every(node => node?.isBone)) throw new Error('Shift leg bones missing');
    hip.position.y -= .040;
    knee.position.y += .022;
    ankle.position.y += .018;
  }
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
  updateRestBind(gltf);
  gltf.scene.userData.shiftProportionsFitted = true;
}
