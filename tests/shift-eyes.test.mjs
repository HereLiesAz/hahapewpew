import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../public/character-models.js',import.meta.url),'utf8');
test('Shift eyes are static 2D dome-mapped white graphics',()=>{
  const start=src.indexOf('function buildShift(scene){');
  const end=src.indexOf('function trapGeometry(',start);
  assert.ok(start>=0&&end>start);
  const shift=src.slice(start,end);
  assert.match(src,/function shiftDomeDecal\(/);
  assert.match(src,/new THREE\.MeshBasicMaterial\(\{color:'#ffffff',toneMapped:false/);
  assert.match(shift,/shiftDomeDecal\(head,shiftInk/);
  assert.match(shift,/shiftDomeDecal\(head,shiftLight/);
  assert.doesNotMatch(shift,/eyelid|blink|socket=|new THREE\.CylinderGeometry\(\.\d+,\.\d+,\.\d+,48\)/);
});
