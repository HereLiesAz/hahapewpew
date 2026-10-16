import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const painted = fs.readFileSync(new URL('../public/visual.js', import.meta.url), 'utf8');
let fallbacks = 0;
let images = 0;
let textDraws = 0;
const canvas = {
  save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, ellipse() {},
  moveTo() {}, lineTo() {}, stroke() {}, fill() {}, closePath() {}, fillRect() {},
  strokeRect() {}, arc() {}, rect() {}, clip() {}, drawImage() { images++; },
  createLinearGradient() { return {addColorStop() {}}; },
  createRadialGradient() { return {addColorStop() {}}; },
  measureText(t) {return {width:t.length*7};},
  fillText() {textDraws++;}, strokeText() {}
};
class Entity { constructor(name,x,h=90) {this.name=name;this.x=x;this.y=530;this.w=40;this.h=h;this.dialogue=null;this.dialogueTimer=0;this.firing=0;this.isThinking=false;this.state='idle';this.target=null;} drawBubble(){} }
class Tab extends Entity {draw() {fallbacks++;}};
class Shift extends Entity {draw() {fallbacks++;}};
class Qwerty extends Entity {draw() {fallbacks++;}};
class Bear extends Entity {draw() {fallbacks++;}};
const tab=new Tab('Tab',420),shift=new Shift('Shift',240),qwerty=new Qwerty('Qwerty',590),bear=new Bear('Bear',440);
const cast=[tab,shift,qwerty,bear];
class FakeImage {constructor(){this.complete=true;this.naturalWidth=400;this.width=400;this.height=600;} set src(v){assert.match(v,/^\/assets\/art\/.*\.webp$/);}}
const sandbox={ctx:canvas,Tab,Shift,Qwerty,Bear,Entity,tab,cast,world:{state:'traveling',scrollSpeed:1.3,killingNow:false},W:900,H:650,groundY:530,dt:1,paused:false,Image:FakeImage,drawGroundDecor() {},drawBanner() {},console};
vm.createContext(sandbox);
vm.runInContext(painted,sandbox,{filename:'visual.js'});
sandbox.drawGroundDecor();
assert.ok(images>0,'wasteland background should be rendered');
images=0;
tab.dialogue='Four short lines of dialogue become an easy to read bubble.';
tab.draw();shift.draw();qwerty.draw();bear.draw();
assert.equal(images,3,'each image-defined actor renders once; the bear is included with Tab');
assert.ok(textDraws,'text dialogue appears in character-specific bubbles');
assert.equal(fallbacks,0,'renders sprites rather than old rectangles once images load');
assert.equal(cast.length,4,'visual layer did not remove any actor or rewrite engine state');
assert.equal(sandbox.world.state,'traveling','original world mechanics remain unchanged');
sandbox.drawBanner();
console.log('visual renderer and bubble regression checks passed');
