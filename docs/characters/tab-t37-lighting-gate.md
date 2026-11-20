# T3.7 — Tab/robot lighting fidelity gate

**Status: incomplete.** T3.7 remains unchecked until visual reference fidelity, collision checks, and measured browser performance have passed.

## Same-camera lighting regression

The production Chromium QA in `scripts/robot_proportions_browser_qa.mjs` now renders the real three production GLBs in the already established neutral, common-ground trio comparison twice, using the *same* orthographic camera, actor positions, materials, and root scales.

- `tab-t37-trio-dim.png`: the actual world hemisphere and directional lights at dim test intensities (0.12 and 0.10).
- `tab-t37-trio-bright.png`: those lights at the shipped production intensities (1.35 and 2.65).
- `results.json`, `tab-t37-trio-lighting`: both image means and the independently projected height spans of Tab, Qwerty and Shift.

The test asserts that the measured projected height spans are identical and the bright render is observably brighter than the dim render. The *same scene lights are restored in a `finally` block* before all subsequent motion and material tests. Neither the user-facing lighting nor Tab's geometry, animations, costume or teddy are changed. No invented source-approved trio scale is implied: the observed runtime root scales remain provisional under T3.1.

## Production-scene render profile (pending browser evidence)

The same Chromium regression now records 40 measured `WebGLRenderer.render(scene,camera)` calls after eight warm-up draws, using the **real loaded production scene and camera**. Its `tab-t37-production-render-profile` result logs median/p95/min/max JavaScript submit times, renderer draw calls, triangle counts, tracked geometry/texture counts, and framebuffer dimensions. No asset is substituted and no gameplay rendering settings change.

This is explicitly a **headless Chromium SwiftShader CPU-submission benchmark**, not display frame time, GPU time, mobile FPS, total memory consumption, or a performance certification. It asserts that metrics are finite, nonzero and internally ordered; there is intentionally no invented hardware-specific frame budget. Real mobile and desktop device measurements, load/download bytes, and collision acceptance remain open.

## Acceptance boundary

The captures and measurements must be inspected **after CI**. A perceptual source-art match cannot be established from a brightness difference, and this QA does not yet test frame rate, scene collision, shadow/cloth penetration, or proportions under a shared reference photograph. Do **not** mark T3.7 complete from these two pictures alone.

Source: `docs/characters/tab-t31-result.md` (cropped reference provenance and scale limitation); `docs/ATOMIC_BACKLOG.md` (T3.7 acceptance definition).

## 2026-11-12 CI evidence review (T3.7 still open)

Inspected the actual PNG images and `robot-proportions/results.json` from [Shift S2.7 visual QA run 43277635374](https://github.com/HereLiesAz/hahapewpew/actions/runs/43277635374), artifact `13970494026`, on merged PR #57's head SHA `203a7ec37005832eb1ec99d5fc38b94a78cd024f`.

- `tab-victoria-front.png` and `tab-victoria-side.png` show the fitted, fully textured outfit, rounded flats and hanging teddy in front and profile; these still images do not establish animated cloth/leg contact or approve likeness against the source illustration.
- `tab-t37-trio-bright.png` and `tab-t37-trio-dim.png` show the same three actors and camera. Their reported mean pixel values are 130.48210416666666 and 119.3343125, respectively; these are image brightness statistics, not an art-direction verdict.
- The reported projected heights are Tab 756.0173922582753 px, Qwerty 320.8246725370154 px, Shift 149.20479627276896 px. The visibly dramatic cross-character size difference is **not approved** by the source-art scale contract (T3.1). No checkbox is changed here.
- The headless Chromium SwiftShader render profile recorded 40 samples after 8 warm-ups: 281.25 ms median JavaScript submit, 395.1000000000058 ms p95, 644 draw calls, 41,212 triangles, 1,384 tracked geometries, 32 textures, and 1600 × 1000 framebuffer. These figures come exclusively from the artifact's `tab-t37-production-render-profile` entry; they are not measured real-device frame times or mobile FPS.

**Remaining acceptance blockers:** source-approved trio/box proportions; motion-frame inspection for bear/hand, shoes and torn cloth; collision and penetration tests; real-device performance and memory budgets. Passing browser CI does not close T3.7.

## Tab blouse silhouette revision (2026-11-19)

The isolated Victoria front and side captures from the prior character QA still showed a nearly straight torso tube with two similarly cylindrical sleeves. The new runtime-only tailoring retains the original textured, skinned blouse and skirt, but gives the upper bodice a shaped waist-to-bust profile with shallow diagonal cloth darts. Both sleeves now follow their true sloping joint axes and use a gathered upper-shoulder swell, upper-arm taper and modest flared cuffs. Deformations taper smoothly to the original hem and neckline, preserving seam continuity and the original authored smooth normals, UVs, anatomy, clothing material and hand-held bear. No change applies to Tab_Reference.glb: only the explicitly loaded Victoria candidate is tailored. A separate unit test compares physical sleeve and bodice silhouette widths against independently specified visual targets. Full ground-free Chromium front/side/motion review remains the final visual acceptance gate; a green unit test does not automatically approve Tab's costume.

## Tab bodice reference correction (2026-11-20)

The source illustration shows a dark, short-sleeved, near-straight bodice with a modest taper into the contrasting waist seam. Its upper cloth has only a few elongated folds, not a pronounced bust or puff sleeves. The earlier runtime fit deliberately exaggerated both, contrary to the illustration. The Victoria-only runtime fit now limits bodice width/depth variation, uses low-amplitude longitudinal crease relief, and tapers sleeves subtly with a restrained cuff. Original skirt, waistband, character scale, box, skin, bear, rig and animation clips are untouched.

`tests/tab-motion.test.mjs` now rejects inflated bust and puff-sleeve dimensions on an independently specified synthetic garment. These assertions are a geometry regression, **not** evidence of visual acceptance. The actual loaded Victoria GLB still needs ground-free front and side Chromium captures reviewed against the user's artwork before declaring the costume matched.

## Structural blouse visual failure and corrective trial (2026-11-20)

PR #67 passed its browser regressions but the **actual** `tab-victoria-front.png` and `tab-victoria-side.png` from run 44686942640 showed a nearly black, straight tube-like upper garment and stiff detached-looking sleeves. The second live render from run 44688752357 (commit `a442137aef0958717460042c1092ab7204b8930c`) recovered some cloth visibility but still failed the garment silhouette: the sleeve caps looked separate from the bodice. PR #67 was merged externally before this visual gate passed; **do not treat that merge as reference approval**.

This draft correction increases genuine mesh pleat relief along the upper cloth, tapers the sleeve ends and recalculates normals from the deformed surface. Since the source is unindexed UV-split triangle soup, coincident vertices share averaged normals without welding UV boundaries. The new test checks substantial nonuniform cloth relief and finite normals, in addition to the unchanged hem, skirt and source-fallback tests.

**Acceptance remains open.** Compare fresh actual production-GLB neutral-background front/side and motion captures against the provided illustration and photograph. Specifically reject a three-cylinder bodice/sleeve silhouette or obvious triangulated shading. Do not mark T3.7 complete from a CI success alone.

### Live rendering follow-up

The Chromium run for the first structural trial on draft PR #68 passed, but its real front/side images still showed almost no visible folds. Surface-normal and geometric variations were hidden by the dark blouse. The amended draft retains the 3D pleats and adds a Victoria-only local-coordinate fabric-shadow modulation to the cloth's ambient component, leaving lighting on other materials and actors unchanged. The effect follows the existing skinned vertices and is limited to the front upper bodice. This is still a candidate, not acceptance. Browser compilation and the captured front/side images must pass visual inspection; never substitute synthetic shader assertions for the GPU result.

### Reference silhouette follow-up, 2026-11-20

Inspected the production-GLB Chromium images in workflow run [44694319720](https://github.com/HereLiesAz/hahapewpew/actions/runs/44694319720), notably `tab-dress-front.png`, `tab-victoria-front.png`, and `tab-victoria-side.png`. The latest preceding candidate still failed visually: two hard, regularly spaced upper-bodice stripes and sleeve volume detached from the upper arm. The photographed source and original illustration instead require softer, less regular creases and narrow short sleeves with broader shoulder roots.

The next draft pass shortens only the runtime Victoria sleeves along their existing arm axes, increases the root radius for shoulder coverage, and tapers to a smaller cuff. It narrows shader shadows to faint, curved upper-bodice folds instead of ink-like full-height stripes. Original skirt, bear, printed box, joint rig and fallback remain outside the edit. Acceptance still requires a fresh captured **front and side** from the new commit, not only passing tests.

### Post-correction visual inspection: still rejected

Workflow [44697396041](https://github.com/HereLiesAz/hahapewpew/actions/runs/44697396041), artifact `14611792889`, passed the full regression and actual Chromium QA. Opened the new `robot-proportions/tab-dress-front.png` and `tab-dress-side.png` in the artifact. The amended sleeves are shorter and narrower, and the neckline stripes less severe, but the blouse is still too rigid and the shoulder/sleeve joins remain visibly distinct. **Do not merge draft PR #68 on the strength of this CI success.**

Next correction must replace the disconnected shoulder/bodice topology with a continuous fabric surface around the shoulder and underarm; more sleeve radius adjustments or decorative shader creases alone are not sufficient. Preserve the existing photographed/artwork silhouette, waist seam, child proportions, skirt, bear, rig and GLB fallback. Resume visual comparison after a genuine topology fix.
