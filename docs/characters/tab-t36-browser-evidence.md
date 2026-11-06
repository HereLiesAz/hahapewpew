# T3.6 — Tab locomotion and acting: browser evidence

Production subject: Victoria-based Tab with the existing torn/dirty dress, cardboard mask and right-hand teddy. Implementation: `public/tab-motion.js`; deterministic skeletal tests: `tests/tab-motion.test.mjs`; actual WebGL QA: `scripts/robot_proportions_browser_qa.mjs`.

## Verified browser run (intermediate revision)

[Chromium run 42131735550](https://github.com/HereLiesAz/hahapewpew/actions/runs/42131735550) completed successfully, including `npm test`, the Python GLB suite and the actual production-scene browser captures. [Artifact 13464517415](https://github.com/HereLiesAz/hahapewpew/actions/runs/42131735550/artifacts/13464517415) contains `robot-proportions/results.json`, walk-front and walk-side, pause, turn, live-world images, 42 PNG motion frames and `tab-t36-walk-pause-turn.mp4`.

I inspected the extracted screenshots and six representative movie frames. In those captures Tab retains her box, distressed dress, teddy grip and recognizable human legs while walking, stopping and turning; no obvious new gross body or prop intersection is apparent at those views. This visual sample is **not** a comprehensive cloth-to-hand collision proof.

The report's independent browser measurements were:

| Production-browser observation | Measured value |
| --- | ---: |
| Left planted-foot displacement | `2.498001805406602e-16` world units |
| Right planted-foot displacement | `4.871083751574258e-16` world units |
| Max ankle reach error | `3.2487068343022356e-16` world units |
| Pause horizontal displacement | `0` world units |
| Turn angle | `0.892667022353796` radians |
| Teddy joint remains under right hand | `true` |
| Live world clock advanced | `5.999999999999985` seconds |
| Live lateral lane excursion | `0.19595943231163948` world units |
| Live traveled distance | `7.539345382413173` world units |
| Live gait reach corrections | `0` |

These figures come from the artifact's `robot-proportions/results.json`, not an inferred animation or a concept image. Near-zero numbers are floating-point measurements, **not** claims of physical subatomic precision. The browser report also records `passed: true` and an empty `errors` list.

## Final production-browser acceptance — 2026-11-05/06

The final post-fix [Chromium run 42132730458](https://github.com/HereLiesAz/hahapewpew/actions/runs/42132730458) completed **successfully** at PR #46 head `c200cc5170af675cf46b9a8749edd25aba3d0c08`, with Node regressions, Python model tests, actual Three.js production-scene captures and video encoding all green. [Artifact 13463854730](https://github.com/HereLiesAz/hahapewpew/actions/runs/42132730458/artifacts/13463854730) contains the final `robot-proportions/results.json`, walk/side/pause/turn/idle/live-world stills, **42 motion PNGs** and `tab-t36-walk-pause-turn.mp4`. I extracted and inspected all 42 frames, plus the six named stills. The captured views show child-sized alternating steps, a stationary pause, progressively turned body and level shoes, retained bear grip, and intact box and torn dress. No **new visible** hand/dress penetration or prop detachment appeared in those views. This is scoped rendered acceptance, not a claim of exhaustive mesh-collision proof.

The final artifact's report contains `passed: true`, `errors: []` and these independent measurements:

| Final production observation | Value |
| --- | ---: |
| Left/right stance slip | `2.498001805406602e-16` / `4.871083751574258e-16` world units |
| Planted-turn lateral shoe displacement | `2.2887833992611187e-16` world units |
| Planted-turn target reach error | `9.309503074677274e-17` world units |
| Minimum world-space sole-up dot product | `1` |
| Hip lateral abduction | `0.190732920979294` radians |
| Teddy still parented to hand | `true` |
| Live simulated interval | `5.999999999999985` seconds |
| Live curved-lane excursion | `0.19658101713936638` world units |
| Live root distance | `7.541666742770786` world units |
| Live emergency leg-reach corrections | `0` |

The negligible residuals are machine floating-point error, not physical-world accuracy. The production call site is `public/world3d.js` (`createTabMotionRig` and the live per-frame `rig.asset.update`), independent of the test fixture. The shipped Victoria dress/box/bear GLB and original reference asset were not modified by the locomotion fixes. PRs #43–#46 are merged, and the sole-roll finding on #46 is resolved.

**T3.6 accepted and checked off** using the final Chromium evidence and independently inspected rendered frames. A separate cold GLEE run was unavailable and is not claimed. T3.1–T3.3 source-art fidelity, T3.7 trio scale/lighting/performance, and broad collision behavior remain distinct, unaccepted tasks.
