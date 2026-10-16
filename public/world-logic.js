/* Deterministic world placement and dialogue timing; shared with tests. */
export const CHUNK_LENGTH = 54;
export const SCENES = Object.freeze([
  { name: 'THE EMBRACE', detail: 'A stone statue of two people hugging.', kind: 'statue' },
  { name: 'THE DEPLETED MINE', detail: 'A crater with no answer at the bottom.', kind: 'crater' },
  { name: 'SOMETHING LIKE A FAMILY', detail: 'A billboard promises an impossible tomorrow.', kind: 'billboard' },
  { name: 'THE DEAD ARMY', detail: 'Giant war machines with empty batteries.', kind: 'graveyard' },
  { name: 'THE MIRROR', detail: 'An undamaged mirror in a ruined street.', kind: 'mirror' },
  { name: 'A SINGING FISH', detail: 'A battery-operated novelty fish on a wall.', kind: 'fish' }
]);
export function hash32(value) {
  let n = (value | 0) ^ 0x6c8e9cf5;
  n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
export function rng(seed) {
  let value = hash32(seed);
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
export function landmarkForChunk(index) {
  if (index < 0) return null;
  return SCENES[index % SCENES.length];
}
// A road grid with uninterrupted travel in the center row and cross streets
// every third column. Free camera streaming uses both coordinates.
export function streetAt(ix, iz) {
  return { eastWest: iz % 3 === 0, northSouth: ix % 3 === 0 };
}
export function districtKeys(crewX, spectator = null) {
  const required = new Set();
  const cx = Math.floor(crewX / CHUNK_LENGTH);
  for (let x=cx-2;x<=cx+2;x++)for(let z=-1;z<=1;z++)required.add(`${x}:${z}`);
  if (spectator) {
    const sx=Math.floor(spectator.x / CHUNK_LENGTH);
    const sz=Math.floor(spectator.z / CHUNK_LENGTH);
    for (let x=sx-1;x<=sx+1;x++)for(let z=sz-1;z<=sz+1;z++)required.add(`${x}:${z}`);
  }
  return required;
}
export function dialogueFrames(words) {
  return Math.min(3600, Math.max(330, 120 + words * 21));
}
export function passageName(x) {
  const scene = landmarkForChunk(Math.floor(x / CHUNK_LENGTH));
  return scene ? scene.name : 'THE WASTELAND';
}
