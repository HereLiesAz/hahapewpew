# Owner correction — Qwerty half-height, Shift true circular dome

**Date:** 2026-10-26. **Authority:** the owner's explicit latest instruction supersedes the older, too-large Qwerty and flattened Shift geometry. This correction is for the **live characters**, not another abandoned workbench preview.

## Qwerty

Qwerty's validated `public/assets/characters/Qwerty_Q16_Validated.glb` is **untouched**: same torso, head, eyes, eyelids, proportions, animations, materials and rig. The game's existing scene-root uniform scale changes from **0.54 to 0.27** on X, Y and Z, including the fallback model. The `groundScale` metadata is kept consistent at 0.27.

## Shift

The prior S2.7 Shift shell had horizontal ring radii **RX ≈ 0.615, RZ ≈ 0.34**. Its *top-down silhouette was not a circle*, contradicting the original rounded dome requirement and the owner's correction. The corrected production asset at `public/assets/characters/Shift_Rigged.glb` is regenerated from `workbench/shift/Shift_S27.glb` by `scripts/shift_dome_s28.py`; the same GLB is retained at `workbench/shift/Shift_S28.glb`.

For all **11** complete shell rings, the exporter measures the actual original X/Z radii and adjusts **only Z** by the interpolated ratio RX/RZ at each existing head height. Thus all rings become mathematically circular from overhead (maximum measured radial dispersion **0.000000086 model units**). This is a genuine *full dome with front and rear depth*, not a flat-shaded oval or a 2D disc. No separate eyes, pupils, or eyelids are added: both white eye graphics and their black ink frames follow the same head geometry correction.

The head's height is also increased **without resizing the torso, arms or legs**. The crown is recalculated so the complete, grounded Shift stands at **92% of Qwerty's new half-height**. Both models retain their original shared-world torso sizes:

| Measure | Qwerty | Shift |
| --- | ---: | ---: |
| Scene-root uniform scale | **0.27** (was 0.54) | **0.46** (unchanged) |
| Torso height in game units | **0.16200** | **0.16074** |
| Overall standing height in game units | **0.71280** | **0.65578** |
| Overall height relative to Qwerty | **100%** | **92%** |

Torso heights differ only **0.78%**. Shift is shorter *because of his head*, not because of a reduced torso/limb scale.

The exporter moves and recalculates normals for exactly **9,504** head-joint vertices (dome side, graphite cap, ink and white graphics), while **1,740** non-head vertices are unchanged. It preserves the 16-bone rig, UVs, weights, existing five clips and hidden-weapon attachment behavior. The fallback procedural Shift dome is also restored to a circular X/Z plan instead of a squashed sphere, and its total height is adjusted to roughly match the corrected live silhouette.

## What has and has not been verified

- **Numerically verified while constructing the actual GLB:** 11 perfectly circular shell rings within floating-point tolerance; both standing and torso height ratios; unchanged Qwerty GLB; unchanged Shift non-head geometry. The full output GLB was saved as a GitHub blob and used for both candidate and live Shift paths.
- **New executable regression:** `tests/robot-proportions-s28.test.mjs` checks true per-vertex circularity, exact asset installation, root uniform scales, torso similarity, 92% standing height, correct skin/UVs/animations and actual Three.js GLTFLoader compatibility. `tests/shift-reference-asset.test.mjs` is updated to expect the correct five clips from the now-live S2.7 rig.
- **CI:** the existing `shift-s27-qa.yml` now also triggers for both production robot proportion sources and these tests. Its complete Node/Python/Chromium execution is **not** claimed to be green until a real run completes and is inspected.
- **Visual caveat:** these mathematical checks cannot substitute for a reviewed real game front/side/top camera render of the corrected characters, especially if source art implies a different dome rise. Continue capturing browser evidence rather than silently marking S2.2–S2.7 final.

**Production now uses the corrected Shift GLB**, loaded under the original URL, with the existing graceful procedural fallback. No unrelated Tab model or illustration is modified. Commit, push and merge are mandatory on this owner-requested correction.

## Production WebGL capture gate

`scripts/robot_proportions_browser_qa.mjs` loads the production URLs through the actual game installer. It waits for both models and the complete Shift sequence controller, then pauses the game and resets both skeletons to bind pose before measuring **visible, skinned world-space vertices**. Walking and speaking poses must not be used as standing rulers.

The browser gate captures the pair at equal camera depth, Shift front/side/full-body, a true vertical orthographic top view, moving head/eyes, Qwerty's open/closed talk mechanism, and hidden/deployed/firing/retracted weapon states. It aborts each real production model request separately to verify the procedural fallback. No GLB bytes or character scales are changed by this integration.

Production previously used only the old walk/talk mixer and legacy gun after loading S28. The complete existing five-clip controller and independent six-barrel gun actuator were confined to the S27 localhost route. Production now uses that same validated controller; historical S22 and failed-load fallback paths remain separate. The `s27` runtime flag identifies this controller in existing game combat/muzzle routing, including production S28.

### Local Chromium evidence, 2026-10-26

The following values are recomputed from the loaded mesh in the neutral pose, not inherited GLB accessor bounds:

| Measure | Qwerty | Shift |
| --- | ---: | ---: |
| Standing height | 0.7128000283 | 0.6557760102 |
| Torso height | 0.1619999984 | 0.1607414854 |
| Lowest vertex Y | approximately 0 | approximately 0 |

The measured standing ratio is 0.9199999777. Eleven circular dome rings have maximum radial dispersion 3.9516e-8 **world** units. This differs in units from the earlier model-space exporter measurement above.

The local Chromium run passed neutral-mesh, scale, circle, torso, ground contact, head/eye attachment, Qwerty talk/plate, weapon states and both production request-failure gates. Captures were opened and inspected: the pair is unobstructed, the dome reads as circular from overhead, feet meet the neutral ground plane, and Qwerty's upper shell moves separately from its fixed plate. The deployed gun is visible from Shift's right side. A further combat regression invokes the game's real `fireAt` and `updateActors` functions and requires visible projectiles plus barrel alignment with the target. The weapon is aimed after wrist animation, because the wrist clip alone points sideways rather than toward the target.

The existing large red projectile geometry obscures part of the combat close-up; separate deployment/firing actuator captures show the gun unobstructed. Projectile geometry was not changed in this character correction.

**Remaining artistic acceptance:** the dome's faceted cel shading and eye-border edge offsets remain visible in close-up; owner acceptance is not implied. Browser gates prove the recorded geometry and controller behavior, not a complete reference-art match. S2.2–S2.7 backlog acceptance remains open. CI results must be inspected independently of these local results.
