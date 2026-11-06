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

## Later corrective revision and acceptance boundary

After that artifact was generated, PR [#46](https://github.com/HereLiesAz/hahapewpew/pull/46) added lateral hip IK, inverse ankle roll and both-foot sole-up assertions in the real Victoria browser QA. These changes require the **final** post-fix browser run [42132730458](https://github.com/HereLiesAz/hahapewpew/actions/runs/42132730458), not an earlier screenshot, for acceptance. Its workflow was still running when this note was authored. PRs [#43](https://github.com/HereLiesAz/hahapewpew/pull/43), [#44](https://github.com/HereLiesAz/hahapewpew/pull/44) and [#45](https://github.com/HereLiesAz/hahapewpew/pull/45) address curved-world clock coverage, interrupted swing settling and normal touchdown respectively.

**Status: T3.6 remains open.** Before checking it off, verify run 42132730458 completed successfully, inspect its final walk, turn, idle and live-world frames for clothing/hand clipping, and record the actual post-fix measurements. T3.7 side-by-side reference fidelity is a separate acceptance gate.
