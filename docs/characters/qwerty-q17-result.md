# Q1.7 — Qwerty short-stride motion and four-band cel shading

**Candidate:** `workbench/qwerty/Qwerty_Q16_validated.glb`. The
validated asset stays separate from the old GLB served by the live game;
Q1.8 remains the acceptance/swap gate.

**Code:** `public/qwerty-motion.js` creates a Three.js animation mixer
for the existing skinned GLB. `shortStrideClip` reduces imported hip
and knee quaternion angles to 62% without changing the source GLB,
preserving clip boundaries. The separate `Qwerty_Talk_Flap` track
translates the entire trapezoidal housing vertically; the thin
bottom plate remains stationary. Stopping speech resets the head
to its closed pose. Left and right black eye-rim eyelids have
individually enabled clips; the same flat unlit white eye geometry
turns solid red in kill mode.

**Cel shader:** `celShadeRobot` assigns
`MeshToonMaterial` with four discrete nearest-filter lighting bands
to Qwerty's opaque surfaces, while eye surfaces are rendered with
`MeshBasicMaterial` so lighting never creates reflections or
gradients across the white/red circles.

**Browser evidence captured from the actual Q1.6 candidate:**
- [Six-pose Chromium render comparison](../evidence/qwerty-q17-motion.jpg):
  neutral, mid-stride, speech at 0.21 and 0.65 seconds, black half-lidded
  eyes, solid-red kill eyes.
- [Short walk-and-talk browser motion recording](../evidence/qwerty-q17-motion.mp4):
  Chromium capture of continuous Three.js animation with a walk section
  followed by speech. This is real browser rendering, not a static mockup.
- The upper skull's Y value was 0.610 / 0.633 during speech,
  versus the closed 0.055; the base plate stayed Y=0.300.
  The browser logged zero JavaScript errors in all six sample poses.

**Reproduction:** serve the repository root using
`python3 -m http.server 8765`, then open
`/tests/visual/qwerty-motion.html?pose=talk&time=0.21`.
Use poses `idle`, `walk`, `talk`, `lids`, `kill`.
`&frames=1` animates continuously with requestAnimationFrame.

**Validation:** `node --test tests/qwerty-motion.test.mjs`
(4 passing real GLTFLoader/mixer/material tests);
`npm test` (45 passing). The checks include independent eyelid tracks,
clip return-to-start, 62% stride, closed/rest head, body four-band
toon, flat unlit eyes, and fixed base plate.

**Limit:** Q1.7 is a standalone motion/cel preview, **not** the
live website. Q1.8 must still verify integrated camera scale, speaker
transitions, Qwerty eye states, device performance, and asset-fallback
behavior before any public-character replacement.
