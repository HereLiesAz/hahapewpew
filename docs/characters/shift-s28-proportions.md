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
| Lowest vertex Y in grounded QA comparison | -0.0455 | -0.0455 |

The measured standing ratio is 0.9199999777. Eleven circular dome rings have maximum radial dispersion 3.9516e-8 **world** units. This differs in units from the earlier model-space exporter measurement above.

The local Chromium run passed neutral-mesh, scale, circle, torso, ground contact, head/eye attachment, Qwerty talk/plate, weapon states and both production request-failure gates. Captures were opened and inspected: the pair is unobstructed, the dome reads as circular from overhead, Shift feet meet the actual rendered road, and Qwerty's upper shell moves separately from its fixed plate. The deployed gun is visible from Shift's right side. A further combat regression invokes the game's real `fireAt` and `updateActors` functions and requires visible projectiles plus barrel alignment with the target. The weapon is aimed after wrist animation, because the wrist clip alone points sideways rather than toward the target.

The existing large red projectile geometry obscures part of the combat close-up; separate deployment/firing actuator captures show the gun unobstructed. Projectile geometry was not changed in this character correction.

**Remaining artistic acceptance:** eye-border edge offsets remain visible in close-up; owner acceptance is not implied. The shell's per-triangle lighting artifacts are addressed by the S2.2 shading correction below. Browser gates prove the recorded geometry and controller behavior, not a complete reference-art match. S2.2–S2.7 backlog acceptance remains open. CI results must be inspected independently of these local results.


### Rendered road contact correction

The earlier neutral-pose check established feet at Y=0 but did not establish contact with the actual road below it. Shift now samples its ankle-bound skinned foot vertices after animation and raycasts only the streamed ground/road meshes. Root placement adjusts until the lowest supported foot meets that surface; the GLB, body scale, and clips remain unchanged. Skinning bind inverses are refreshed before measurement, including when the actor has moved since the previous render.

In the latest local Chromium run, the actual road at the comparison position is Y=-0.0455 and Shift's lowest rendered vertex is also Y=-0.0455. The game-combat path independently measures effectively zero foot-to-road clearance. The neutral Qwerty comparison is positioned on the same plane for the screenshot only; **Qwerty's production movement mechanism remains unchanged**.

Regression coverage includes walking poses, actor relocation between rendered transforms, a raised surface, absence of a support surface, and the production browser's actual mesh-to-road measurement. Qwerty/Shift neutral standing heights and torso dimensions above remain unchanged by vertical placement.


### S2.2 — continuous dome shading

The S28 exporter stores flat face normals on its non-indexed shell. The production sequence controller now uses the bundled `toCreasedNormals` utility on cloned geometry for `Shift/Dome_Side` and `Shift/Dome_Graphite` only. Coincident shell vertices share smooth normals; the utility retains hard creases at the rim. Four-band cel materials are retained. Neither production GLB is rewritten, and positions, UVs, skin indices/weights, eye graphics, body geometry and clips remain unchanged.

The local production Chromium gate reports **zero normal seams across 2,691 repeated interior shell vertices**. Front, side and true top-down orthographic captures were opened and inspected: the patchwork of per-triangle lighting is replaced by continuous cel bands. The existing geometric, height, torso, road-contact, motion, weapon and request-failure checks passed in the same run. This corrects shading without changing the owner's accepted size correction; it does not assert final reference-art approval of the eye borders or complete S2.2–S2.7 artistic acceptance.

`tests/robot-proportions-s28.test.mjs` checks every non-normal shell attribute and every non-shell attribute against the originally loaded GLB, verifies normalized continuous interior normals, and requires the original geometry buffers to remain untouched. The production browser gate separately inspects the actual installed mesh's shared normals.
