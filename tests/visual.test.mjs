import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const painted = fs.readFileSync(new URL('../public/visual.js', import.meta.url), 'utf8');
let fallbacks = 0;
let images = 0;
let textDraws = 0;
const drawnTexts = [];
const canvas = {
  save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, bezierCurveTo() {}, quadraticCurveTo() {}, beginPath() {}, ellipse() {},
  moveTo() {}, lineTo() {}, stroke() {}, fill() {}, closePath() {}, fillRect() {},
  strokeRect() {}, arc() {}, rect() {}, clip() {}, drawImage() { images++; },
  createLinearGradient() { return {addColorStop() {}}; },
  createRadialGradient() { return {addColorStop() {}}; },
  measureText(t) {return {width:t.length*7};},
  fillText(text,x) {textDraws++; drawnTexts.push({text,x});}, strokeText() {}
};
class Entity { constructor(name,x,h=90) {this.name=name;this.x=x;this.y=530;this.w=40;this.h=h;this.dialogue=null;this.dialogueTimer=0;this.firing=0;this.isThinking=false;this.state='idle';this.target=null;this.vx=0;} update() {this.x += this.vx;} drawBubble(){} }
class Tab extends Entity {draw() {fallbacks++;}};
class Shift extends Entity {draw() {fallbacks++;}};
class Qwerty extends Entity {draw() {fallbacks++;}};
class Bear extends Entity {draw() {fallbacks++;}};
const tab=new Tab('Tab',420),shift=new Shift('Shift',240),qwerty=new Qwerty('Qwerty',590),bear=new Bear('Bear',440);
const cast=[tab,shift,qwerty,bear];
const ether={ broadcast(sender,message) {} };
class FakeImage {constructor(){this.complete=true;this.naturalWidth=400;this.width=400;this.height=600;} set src(v){assert.match(v,/^\/assets\/art\/.*\.webp$/);}}
const locations=['CVS PARKING LOT'];
let prompt;
const sandbox={ctx:canvas,Tab,Shift,Qwerty,Bear,Entity,tab,cast,locations,askTheVoid:async (name,message)=>{prompt=message;return 'Math is dead.';},world:{state:'traveling',location:'THE WASTELAND',locationsVisited:0,scrollSpeed:1.3,killingNow:false},W:900,H:650,groundY:530,dt:1,paused:false,Image:FakeImage,ether,drawGroundDecor() {},drawBanner() {},console};
vm.createContext(sandbox);
vm.runInContext(painted,sandbox,{filename:'visual.js'});
sandbox.drawGroundDecor();
assert.ok(images>0,'wasteland background should be rendered');
images=0;
tab.dialogue='Four short lines of dialogue become an easy to read bubble.';
tab.draw();shift.draw();qwerty.draw();bear.draw();
assert.equal(images,6,'each illustrated actor has independently drawn head and body; bear stays with Tab');
assert.ok(textDraws,'text dialogue appears in character-specific bubbles');
assert.equal(fallbacks,0,'renders sprites rather than old rectangles once images load');
assert.equal(cast.length,4,'visual layer did not remove any actor or rewrite engine state');
assert.equal(sandbox.world.state,'traveling','original world mechanics remain unchanged');
sandbox.drawBanner();
console.log('visual renderer and bubble regression checks passed');

assert.ok(locations.includes('THE UNBROKEN MIRROR'), 'mirror encounter added');
assert.ok(locations.includes('THE BOTTOMLESS CRATER'), 'crater encounter added');
assert.ok(locations.includes('WAR MACHINE GRAVEYARD'), 'machine encounter added');
assert.ok(locations.includes('THE HUGGING STATUE'), 'statue encounter added');
// Test anchored authored outcomes rather than re-implementing movement math.
const originalShiftX=shift.x;
for (let i=0;i<160;i++) shift.update();
assert.ok(shift.x>300&&shift.x<440, 'Shift stays in the travelling group');
assert.ok(shift.x>originalShiftX, 'companion moves toward the group position');
assert.ok(shift.vx===0, 'travel nudging does not invent uncontrolled velocity');
// Arriving must not redirect actors or change the world stage.
sandbox.world.state='arrived';
const arrivedX=shift.x;
shift.update();
assert.equal(shift.x,arrivedX, 'autonomous resting behavior is preserved at stops');
for (const place of ['THE UNBROKEN MIRROR','THE BOTTOMLESS CRATER','THE SINGING FISH','WAR MACHINE GRAVEYARD','FAMILY BILLBOARD','THE HUGGING STATUE','GAS STATION']) {
  sandbox.world.location=place;
  sandbox.drawGroundDecor();
}
assert.equal(sandbox.cast.length,4, 'scenery never creates/removes people or robots');
await sandbox.askTheVoid('Tab','What is that?');
assert.match(prompt,/Location: GAS STATION\. What is that\?/);
assert.equal(sandbox.world.state,'arrived','scene art does not change the simulation state');

// The final bubble module runs after the visual renderer in production.
const dialogues = fs.readFileSync(new URL('../public/bubbles.js', import.meta.url), 'utf8');
vm.runInContext(dialogues, sandbox, { filename: 'bubbles.js' });
qwerty.dialogue = 'A GRANDIOSE ASSERTION ABOUT MORAL DUTY AND THE INEVITABILITY OF OUR CONCLUSIONS.';
drawnTexts.length=0;
qwerty.draw();
const qwertyWords=drawnTexts.filter(x=>x.text.includes('GRANDIOSE'));
assert.ok(qwertyWords.length > 0, 'Qwerty continues to draw his rant');
assert.ok(qwertyWords[0].x > 580, 'on desktop Qwerty dialogue begins to the right of Tab');
