import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ROOT=new URL('../',import.meta.url);
const art=readFileSync(new URL('public/assets/art/tab.webp',ROOT));
const trace=JSON.parse(readFileSync(new URL('docs/characters/tab-t31-trace.json',ROOT),'utf8'));

function webpSize(data){
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.equal(data.toString('ascii',12,16),'VP8X');
  return [
    1+data[24]+(data[25]<<8)+(data[26]<<16),
    1+data[27]+(data[28]<<8)+(data[29]<<16)
  ];
}
function box(name){
  const item=trace.regions[name];
  assert.ok(item?.rect,'missing rectangle '+name);
  const [x,y,w,h]=item.rect;
  return {x,y,w,h};
}

test('T3.1 measured owner art is original 454x959 WebP, not resized stock imagery',()=>{
  assert.deepEqual(webpSize(art),[454,959]);
  assert.deepEqual(trace.sourceSize,[454,959]);
  assert.equal(trace.source,'public/assets/art/tab.webp');
  assert.equal(trace.step,'T3.1');
  assert.match(trace.measurementStatus,/approximate/);
  assert.equal(Object.keys(trace.regions).length,17);
});

test('T3.1 every manually traced polygon stays inside source image bounds',()=>{
  const [width,height]=trace.sourceSize;
  for(const [label,item] of Object.entries(trace.regions)){
    assert.ok(item.role?.length>10,label);
    assert.equal(Boolean(item.poly)+Boolean(item.rect),1,label);
    const points=item.poly||[
      item.rect.slice(0,2),
      [item.rect[0]+item.rect[2],item.rect[1]+item.rect[3]]
    ];
    for(const [x,y] of points){
      assert.ok(Number.isFinite(x)&&Number.isFinite(y),label);
      assert.ok(x>=0&&x<=width&&y>=0&&y<=height,label+' '+x+' '+y);
    }
    if(item.poly)assert.ok(item.poly.length>=3,label);
    else assert.ok(item.rect[2]>0&&item.rect[3]>0,label);
  }
});

test('T3.1 printed face is deliberately asymmetric and inside the cardboard front',()=>{
  const large=box('largePrintedEye'),small=box('smallPrintedEye');
  const mouth=box('mouthGrille'),front=trace.regions.cardboardFront.poly;
  assert.ok(large.w>small.w&&large.h>small.h);
  assert.ok(large.x+large.w<small.x+small.w);
  assert.ok(mouth.y>Math.max(large.y,small.y)+large.h);
  assert.ok(front.every(p=>p[0]>=100&&p[1]<230));
  assert.equal(trace.semantics.hasConventionalFace,false);
  assert.equal(trace.semantics.eyeballs,false);
  assert.equal(trace.semantics.expressionPrinted,true);
  assert.equal(trace.semantics.flaps,4);
  assert.match(trace.semantics.boxSideLettering,/upside down/);
});

test('T3.1 child hand, asymmetrical skirt and teddy ear hold are reference-bound',()=>{
  const teddy=box('teddy');
  const leftFoot=box('leftDarkFlat'),rightFoot=box('rightDarkFlat');
  const leftLeg=box('leftBareShin'),rightLeg=box('rightBareShin');
  const dress=trace.regions.dress.poly;
  const leftArm=trace.regions.leftBentArmAndHand.poly;
  const bearArm=trace.regions.rightArm.poly;
  assert.ok(teddy.x>trace.regions.bodice.poly[0][0]);
  assert.ok(bearArm.some(([x,y])=>x>320&&y>490));
  assert.ok(leftArm.some(([x,y])=>x<25&&y>280));
  assert.ok(dress.some(([x,y])=>y<400));
  assert.ok(dress.some(([x,y])=>y>700));
  assert.ok(leftLeg.y<rightLeg.y,'dress hem should be uneven');
  assert.ok(leftFoot.y>leftLeg.y&&rightFoot.y>rightLeg.y);
  assert.equal(trace.semantics.teddy,'hangs by one ear from right hand');
  assert.match(trace.semantics.cloth,/asymmetrical/);
  assert.match(trace.semantics.scale,/does not establish absolute/);
});

test('T3.1 annotation embeds the unchanged source art and lists every region',()=>{
  const svg=readFileSync(new URL('docs/evidence/tab-t31-reference.svg',ROOT),'utf8');
  assert.match(svg,/data:image\/webp;base64,/);
  assert.match(svg,/454 × 959/);
  assert.match(svg,/TRACED REGIONS/);
  for(const name of Object.keys(trace.regions))
    assert.match(svg,new RegExp(name.replace(/[A-Z]/g,x=>' '+x)));
  const runtime=readFileSync(new URL('public/world3d.js',ROOT),'utf8');
  assert.match(runtime,/Tab_Reference\.glb/);
});
