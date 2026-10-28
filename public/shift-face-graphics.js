import * as THREE from './vendor/three.module.js';

// Stable S2.3 triangle ranges in the preserved Shift skin: the surrounding
// ink primitive also contains the head rim and body outline, which stay drawn.
const INK_START=288,INK_STOP=2016;

/** Print Shift's existing eye artwork on the actual skinned shell triangles.
 * Call after cel-material conversion. No surface position, joint, animation,
 * source GLB or graphic XY contour changes; only the old raised decals retire.
 * The mask has white interiors, opaque black frames and transparent exterior.
 * Returns shared unlit material, source-linked layers and reversible disposal.
 */
export function attachShiftFaceGraphics(model){
  const shells=[];let ink,white;
  model.traverse(n=>{
    if(!n.isSkinnedMesh)return;
    if(['Shift/Dome_Side','Shift/Dome_Graphite'].includes(n.material?.name))shells.push(n);
    if(n.material?.name==='Shift/Ink_Outline')ink=n;
    if(n.material?.name==='Shift/Eyes_2D_Emission')white=n;
  });
  if(shells.length!==2||shells.some(n=>n.geometry.index||n.geometry.attributes.position.count%3)||
     !ink||!white||ink.geometry.index||white.geometry.index||
     ink.geometry.attributes.position.count<INK_STOP||white.geometry.attributes.position.count!==1728)
    throw Error('Unsupported fixed Shift face layout');
  const head=model.getObjectByName('head');
  for(const [mesh,first,stop] of [[ink,INK_START,INK_STOP],[white,0,1728]]){
    const joints=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    for(let i=first;i<stop;i++){
      if(mesh.skeleton.bones[joints.getX(i)]!==head||weights.getX(i)!==1||
         weights.getY(i)!==0||weights.getZ(i)!==0||weights.getW(i)!==0)
        throw Error('Shift graphic must be rigidly bound to head');
    }
  }
  const inkPositions=ink.geometry.attributes.position,whitePositions=white.geometry.attributes.position;
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for(let i=INK_START;i<INK_STOP;i++){
    xmin=Math.min(xmin,inkPositions.getX(i));xmax=Math.max(xmax,inkPositions.getX(i));
    ymin=Math.min(ymin,inkPositions.getY(i));ymax=Math.max(ymax,inkPositions.getY(i));
  }
  if(![xmin,xmax,ymin,ymax].every(Number.isFinite)||xmax<=xmin||ymax<=ymin)
    throw Error('Degenerate Shift graphic bounds');
  // Transparent padding prevents clamp-to-edge painting outside the artwork.
  const padding=(xmax-xmin)/128;
  xmin-=padding;xmax+=padding;ymin-=padding;ymax+=padding;
  const width=1024,height=Math.max(64,Math.ceil(width*(ymax-ymin)/(xmax-xmin)));
  const pixels=new Uint8Array(width*height*4);
  function paint(positions,first,stop,value){
    for(let i=first;i<stop;i+=3){
      const triangle=[0,1,2].map(j=>[
        (positions.getX(i+j)-xmin)/(xmax-xmin)*width,
        (positions.getY(i+j)-ymin)/(ymax-ymin)*height
      ]);
      const [[ax,ay],[bx,by],[cx,cy]]=triangle;
      const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(width-1,Math.ceil(Math.max(ax,bx,cx)));
      const minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(height-1,Math.ceil(Math.max(ay,by,cy)));
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        const px=x+.5,py=y+.5;
        const a=(bx-ax)*(py-ay)-(by-ay)*(px-ax);
        const b=(cx-bx)*(py-by)-(cy-by)*(px-bx);
        const c=(ax-cx)*(py-cy)-(ay-cy)*(px-cx);
        if(!((a>=0&&b>=0&&c>=0)||(a<=0&&b<=0&&c<=0)))continue;
        const offset=(y*width+x)*4;
        pixels[offset]=pixels[offset+1]=pixels[offset+2]=value;pixels[offset+3]=255;
      }
    }
  }
  paint(inkPositions,INK_START,INK_STOP,0);
  paint(whitePositions,0,1728,255);
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.needsUpdate=true;
  const material=new THREE.MeshBasicMaterial({
    name:'Shift/Eyes_2D_Emission',color:0xffffff,map:texture,toneMapped:false,
    alphaTest:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  });
  const layers=[];
  for(const source of shells){
    const positions=source.geometry.attributes.position,indices=[];
    for(let i=0;i<positions.count;i+=3){
      if([0,1,2].every(j=>positions.getZ(i+j)>=-1e-7))indices.push(i,i+1,i+2);
    }
    const selected=source.geometry.clone();selected.setIndex(indices);
    const geometry=selected.toNonIndexed();selected.dispose();
    const p=geometry.attributes.position,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){
      uv[i*2]=(p.getX(i)-xmin)/(xmax-xmin);uv[i*2+1]=(p.getY(i)-ymin)/(ymax-ymin);
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const mesh=source.clone(false);mesh.geometry=geometry;mesh.material=material;
    mesh.name='Shift.PrintedFace.'+source.name;mesh.castShadow=false;mesh.receiveShadow=false;
    mesh.renderOrder=1;source.parent.add(mesh);
    layers.push({mesh,source,sourceIndices:indices});
  }
  const originalInk=ink.geometry,originalVisible=white.visible;
  ink.geometry=originalInk.clone();
  ink.geometry.setIndex(Array.from({length:inkPositions.count},(_,i)=>i).filter(i=>i<INK_START||i>=INK_STOP));
  white.visible=false;
  let disposed=false;
  function dispose(){
    if(disposed)return;disposed=true;
    for(const {mesh} of layers){mesh.removeFromParent();mesh.geometry.dispose();}
    ink.geometry.dispose();ink.geometry=originalInk;white.visible=originalVisible;
    material.dispose();texture.dispose();
  }
  return {material,texture,layers,dispose};
}
