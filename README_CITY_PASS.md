# Urban open-world city pass (historical snapshot)

The city-only staging pass described below was later deployed. Its character-proxy limitation was subsequently addressed by the separately textured, articulated character-models module. The historical limitations are retained as a record of what was then missing.

## Scope

A single city-environment and spectator-camera pass for the ongoing 3D fishbowl. No change to its three character identities, Cloudflare-hosted dialogue API, speech bubbles, human encounter scheduling, paused state, or main static site entry point.

Changes to existing repository files:
- `public/world3d.js`: replace the one-road strip with connected two-dimensional urban chunks; PBR-surface procedural textures for asphalt, facades, concrete, cardboard and robot shells; ruined buildings with broken/boarded windows; sidewalks, curbs, intersection markings, parked wrecks with four wheels, and lamp posts; rotate walkers toward movement; use closer cinematic behind-the-trio camera framing; allow free camera to stream distant neighborhoods without deleting the trio's immediate district.
- `public/world-logic.js`: pure, tested grid-road topology and deterministic active-chunk selection shared by renderer and tests.
- `tests/world3d.test.mjs`: 3 added targeted tests for intersections, negative grid coordinates, two-focus streaming and visual/camera hooks.

## Existing invariants

- The main cast remains Tab, Shift and Qwerty, modeled with 3D meshes in `world3d.js` and advanced by `updateActors`.
- Narration remains text bubbles anchored to heads, generated through the unchanged `/api/think` endpoint. No voice audio or on-device AI.
- Autonomous forward movement continues along +X; free spectator controls do not steer characters.
- Streets render as real world geometry with material textures, not sprite overlays or comic panels.

## Unfinished work / limitations

This is **not** a finished realistic game. The leading characters remain procedural geometric proxies, not production-quality scanned or sculpted rigs with PBR maps. There is no collision/navigation mesh, driving, destructible structures, or ambient vehicle traffic. Some ruins remain procedural boxes. True GTA-grade environmental fidelity needs authored glTF models, PBR textures, lighting calibration and LOD. A full WebGL browser/performance pass was not possible in this container because the Three.js vendor bundle is not present in the staged files. Do not present this as complete or deploy without that pass.

## Checks

`node --check public/world3d.js`, `node --check public/world-logic.js`, `node --test tests/world3d.test.mjs` — all passed locally (8 tests). GLEE cold adversarial review unavailable.
