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
