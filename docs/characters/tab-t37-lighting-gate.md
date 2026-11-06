# T3.7 — Tab/robot lighting fidelity gate

**Status: incomplete.** T3.7 remains unchecked until visual reference fidelity, collision checks, and measured browser performance have passed.

## Same-camera lighting regression

The production Chromium QA in `scripts/robot_proportions_browser_qa.mjs` now renders the real three production GLBs in the already established neutral, common-ground trio comparison twice, using the *same* orthographic camera, actor positions, materials, and root scales.

- `tab-t37-trio-dim.png`: the actual world hemisphere and directional lights at dim test intensities (0.12 and 0.10).
- `tab-t37-trio-bright.png`: those lights at the shipped production intensities (1.35 and 2.65).
- `results.json`, `tab-t37-trio-lighting`: both image means and the independently projected height spans of Tab, Qwerty and Shift.

The test asserts that the measured projected height spans are identical and the bright render is observably brighter than the dim render. The *same scene lights are restored in a `finally` block* before all subsequent motion and material tests. Neither the user-facing lighting nor Tab's geometry, animations, costume or teddy are changed. No invented source-approved trio scale is implied: the observed runtime root scales remain provisional under T3.1.

## Acceptance boundary

The captures and measurements must be inspected **after CI**. A perceptual source-art match cannot be established from a brightness difference, and this QA does not yet test frame rate, scene collision, shadow/cloth penetration, or proportions under a shared reference photograph. Do **not** mark T3.7 complete from these two pictures alone.

Source: `docs/characters/tab-t31-result.md` (cropped reference provenance and scale limitation); `docs/ATOMIC_BACKLOG.md` (T3.7 acceptance definition).
