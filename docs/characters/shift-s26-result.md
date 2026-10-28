# S2.6 — Shift GLB rig and four-band material export

## Current production acceptance

The live S29 asset loads through the production `world3d.js` installer and `createShiftSequenceRig`. It retains the original 16 named bones, skin attributes, UVs and five clips; the concealed gun remains separately attached. The controller applies the shared six opaque cel materials and then prints the fixed, unlit face mask on the shell. No asset, geometry, material palette, character scale, animation or live gameplay code changes in this acceptance step.

The production regression now checks all 11,244 source skin vertices: finite matching position/normal/UV/skin attribute counts, valid joint indices, normalized nonnegative weights, and rest-skinned positions agreeing with original geometry. It verifies the actual installed opaque materials use nearest-filtered four-band ramps and that the printed face retains its unlit texture mask. These are project structural checks, not a claim of an external glTF validator run.

The Chromium gate renders a calibration atlas using references to the six actual installed materials. Flat swatches carry controlled unit normals giving dot products −0.75, −0.25, +0.25 and +0.75 under one white directional light of intensity π. Tone mapping is disabled only for this calibration, so Lambert's 1/π cancels and the expected pixel is the linear palette multiplied by the corresponding ramp intensity, converted to sRGB. All 24 opaque samples matched expected bytes within the two-byte tolerance and each material produced four distinct colours. Separate samples of the actual printed mask remained white/black across all rows. This is a shader/material test; the swatches are not replacement character meshes.

A second capture pair renders the real installed, skinned Shift root in an isolated scene at zero and bright directional illumination, keeping the production renderer's tone mapping. The shell responds to light while every fully white pixel in the dark image remains white in the bright image. The pair and the atlas were opened and inspected. Renderer settings and the root's original parent are restored in `finally` blocks.

Evidence: `shift-material-gpu-bands.png`, `shift-light-dark.png`, `shift-light-bright.png` and their measurements in the production browser `results.json`. The existing CI capture/upload steps publish these artifacts. All 88 Node tests, 50 Python tests and the complete production Chromium gate passed locally. Cold independent GLEE review covers the checks and captures; merged-commit CI must still be inspected separately.

This completes the S2.6 rig/material technical gate. It does not approve the entire character artwork, establish a performance budget, solve foot sliding, or verify a public deployment. S2.2, S2.4, S2.7 and broader locomotion acceptance remain separate.

## Historical S26 export record

**Original status:** Candidate committed for integration continuity. This step's binary and material contract is structurally verified, but **full Node/Python tests, browser shading captures, and independent cold GLEE review are outstanding**. Do not check S2.6 complete or replace the live Shift asset until the actual-render acceptance evidence passes.

## Authoritative inputs

- [Original Shift artwork](../../public/assets/art/shift.webp) and [S2.1 shape/face rules](shift-fidelity.md). Keep a low gray dome, fixed flat white graphic eyes with thick black borders, compact body and idle-hidden weapon.
- [S2.4 GLB candidate](../../workbench/shift/Shift_S24.glb) already contains 16 original joints, UVs, an identical head/eye mesh from S2.3, three old animation clips and grounded wedge feet.
- [S2.5 gun module](../../public/shift-weapon.js) is still a separately attached, wrist-controlled rig. **The exported GLB does not yet package this mechanism**; S2.7 must confirm the integrated runtime before any production substitution.

## Output and exact preservation guarantee

Run `python3 scripts/shift_materials_s26.py workbench/shift/Shift_S24.glb workbench/shift/Shift_S26.glb`.

The new `workbench/shift/Shift_S26.glb` is a **self-contained glTF 2.0 workbench candidate**, with only material metadata and asset extras changed. The binary buffer containing the complete mesh geometry, normals, UV coordinates, rigid skinning indices and weights, 16 inverse bind matrices, animation times/rotations and previous scene data is **byte-identical to S2.4**. All existing glTF accessors, bufferViews, meshes, scene roots, joints and animation channels remain the same. No unverified extra surface features, lids or eye bones are added.

The seven GLB material names are stable and match the live `celShadeRobot` material routing: `Dome_Graphite`, `Dome_Side`, `Ink_Outline`, `Body_Graphite`, `Control_Light`, `Limb_Black`, `Eyes_2D_Emission` (all prefixed `Shift/`). PBR baseColorFactor values are encoded **in linear sRGB**, not naive 8-bit sRGB/255, so the neutral material fallback matches the game's CSS hex palette. Opaque materials stay metallic 0, roughness 1 and double-sided.

The white eye graphics are `#ffffff` with existing `emissiveFactor: [1,1,1]` and the explicitly declared **`KHR_materials_unlit` glTF extension**. Three.js's bundled r180 `GLTFLoader` loads the eyes as `MeshBasicMaterial`, and the runtime cel adapter explicitly supplies `toneMapped:false`. The white stays unshaded; its two polygon interiors remain rigidly bound to the original head joint and do not get new animation channels.

## Browser render material contract

The production `public/cel-robots.js` uses `MeshToonMaterial` for Shift's six opaque materials, nearest sampling and a 4×1 `DataTexture` with bands **120, 158, 211 and 255**. S2.6 fixes a real return-value inconsistency: `celShadeRobot(root, 'Shift')` previously returned Qwerty's `gradientMap` to consumers even though it had applied Shift's brighter ramp; it now returns the **actual Shift ramp**. Qwerty still uses its independent **55, 108, 183, 255** four-band ramp.

[Palette and numerical ramp evidence](../evidence/shift-s26-ramp.svg) shows the material keys and intended stepped samples. This SVG is **not a captured WebGL render**.

## Tests and gates

- `tests/test_shift_materials_s26.py`: validates bitwise-preserved GLB binary, preserved 16-bone rig/scene/animations, 11,244 vertices, UVs, weights, neutral palette, eye extension and generator reproducibility.
- `tests/shift-materials-s26.test.mjs`: loads the *real* GLB through bundled `GLTFLoader`, checks the actual unlit eye material, glTF head/wrist joints, sampled 4-band Shift and Qwerty gradients, source palette names/hex values, head motion and the separately deployable S2.5 gun.
- `tests/shift-reference-asset.test.mjs`: corrects two inherited S2.2 regex assertions that incorrectly treated the legitimate localhost-only test route as invalid.
- `tests/visual/shift-s22.html` and `shift-s22-preview.js`: select `?model=s26`, with optional `&weapon=stowed`, `revealed` or `spin`, keeping S2.2/S2.3/S2.4 selections available.

To inspect from a real checkout, run `python3 scripts/serve_shift_qa.py` and open `http://127.0.0.1:8765/tests/visual/shift-s22.html?model=s26&view=front&weapon=stowed`; repeat for `view=side`, `view=threequarter`, and revealed/spin with `frames=1`.

**Confirmed directly during preparation:** the S2.4-to-S2.6 packed GLB binary buffer was copied unchanged; the output is a valid, aligned GLB with seven materials and glTF `KHR_materials_unlit`; SHA and material changes were stored as an isolated GitHub blob. **Not claimed:** a passed complete `npm test`, Python suite, glTF browser render, lighting shader capture, S2.5 joint playback acceptance, or cold GLEE approval. Existing S2.2–S2.5 acceptance boxes remain open. S2.6's checkbox remains open too.

**User workflow:** Each incremental S2.x candidate is committed, pushed and merged to `main` before reporting completion. That Git history requirement does not waive visual acceptance or authorize publishing the new GLB as Shift's live model. S2.7 covers integration and motion-based acceptance.
