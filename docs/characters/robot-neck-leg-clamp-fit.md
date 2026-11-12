# Robot neck, leg and Qwerty clamp fit (2026-11-12)

## Art direction

The owner explicitly requires both robot necks to be essentially imperceptible, both sets of legs visibly shorter, and Qwerty's tangled-looking arms/hands corrected. Source-art constraints remain `docs/characters/qwerty-fidelity.md` and `docs/characters/shift-fidelity.md`: no conventional tall necks, no human fingers, no added cosmetic machinery, oversized head silhouettes and substantially sized simple hooked clamps.

This change operates **only on loaded robot GLB instances** via `public/robot-proportion-fit.js`. The two validated GLB files, their authored animation clips, UVs, original skeleton pivots, source illustrations and Tab are not rewritten. Source buffers are cloned before any vertex alterations, so a failed GLB load still retains the independently authored procedural fallback. The legacy fallback has not been restyled in this pass and is not claimed to match the new skinned geometry.

## Fit

- Qwerty: lower torso/shoulder mesh 0.085 model units and eye-bearing face/plate 0.170, giving a roughly 0.010-unit model-space gap from torso crown to the stationary bottom plate. Compress the visible neck tube to a very thin connector.
- Qwerty: move only the visible upper-leg mesh (hip groups by 0.075, knee groups by 0.040 model units); preserve the ankle geometry, planted soles, existing animation pivots and original skin bind data.
- Qwerty: collapse the deformed, original wrist triangles without deleting UV/skinning attributes; attach one deliberately modeled two-prong black clamp to each animated wrist bone. Six segments per clamp are used for two clearly separated hooked tines. Motion follows the existing wrist bones; no human fingers or additional animation channel is invented.
- Shift: lower the visible torso and arm meshes 0.035, head mesh 0.055, upper-leg meshes 0.040 and knee meshes 0.018 model units, with ankles unchanged; collapse the visible neck tube to a small connection. X/Z circular dome shape, printed eye masks, concealed minigun and actor root scale remain as previously approved by PR #60.

The compression is confined to geometry under the existing rest joints rather than rewriting GLB inverse-bind matrices, which were found in regression testing to interfere with the established precise mesh-to-road grounding. This deliberately leaves the original animation pivots untouched. Check motion frames for gaps before accepting; static screenshots alone are insufficient.

## Acceptance

`tests/robot-proportion-fit.test.mjs` independently checks source art preservation, head/torso gap, neck thickness, altered upper leg vertex bounds, unchanged ankle surfaces and joints, animation-linked clamps and idempotence. The existing Shift source-geometry, cel-band, eye-overlay, animation and grounding tests remain active. `scripts/robot_proportions_browser_qa.mjs` and `scripts/shift_s27_browser_qa.mjs` must provide actual Chromium stills and motion captures. Do not merge unless these pass and the renders are visually inspected.

No task checkbox is marked complete merely from a proposed shape or from unit tests; owner review of actual renders remains authoritative.

## Unobstructed character evidence

For anatomical reviews, `scripts/robot_proportions_browser_qa.mjs` captures the actual loaded character models against a flat, neutral-grey background with streets, terrain, buildings and props temporarily hidden. Lighting and the real skinned character rigs remain active. The renderer restores every hidden node's previous visibility, original backdrop and fog after each frame, even if capture fails. Measurements and real rendered-road/foot contact checks occur **before** these visibility changes and are not weakened. Wide gameplay evidence from `scripts/shift_s27_browser_qa.mjs` remains available separately. The character screenshots, not road-heavy gameplay frames, are the primary visual acceptance artifacts.
