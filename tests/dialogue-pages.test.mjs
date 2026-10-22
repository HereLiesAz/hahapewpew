import test from 'node:test';
import assert from 'node:assert/strict';
import {dialoguePages,visibleDialoguePage} from '../public/dialogue-pages.js';
import {readFileSync} from 'node:fs';
test('Qwerty monologue paginates without losing words',()=>{
 const text=Array.from({length:170},(_,i)=>`WORD${i}`).join(' ');
 const pages=dialoguePages(text,145);
 assert.ok(pages.length>=7);
 assert.ok(pages.every(page=>page.length<=145));
 assert.equal(pages.join(' '),text);
 assert.equal(visibleDialoguePage(pages,0,60),0);
 assert.equal(visibleDialoguePage(pages,59.999,60),pages.length-1);
});
test('short captions and boundary values remain legible',()=>{
 assert.deepEqual(dialoguePages('Math is dead.'),['Math is dead.']);
 assert.deepEqual(dialoguePages(''),[]);
 assert.equal(visibleDialoguePage([],20,60),-1);
 const pages=dialoguePages('one two three four',8);
 assert.ok(pages.length>=2);
 assert.equal(visibleDialoguePage(pages,100,10),pages.length-1);
});
test('game keeps whole dialogue in transcript and pages visible text',()=>{
 const game=readFileSync(new URL('../public/world3d.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/world3d.css',import.meta.url),'utf8');
 assert.match(game,/dialoguePages\(name==='Qwerty'/);
 assert.match(game,/visibleDialoguePage\(state\.pages/);
 assert.match(game,/logMessage\(name,clean\)/);
 assert.match(css,/max-height:min\(38vh,270px\)/);
});
