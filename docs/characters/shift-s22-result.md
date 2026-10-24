# S2.2 — Shift dome silhouette: isolated candidate

**Status:** S2.2 remains open. Candidate committed to `main` by explicit user request on October 24, 2026 at [`a8b0585`](https://github.com/HereLiesAz/hahapewpew/commit/a8b0585e5b51e5f8d0708fd8e7a57a936f604da6), **not** installed in production. No runtime model replaced; no visual approval inferred.

## Inputs and decision

- Art authority: `public/assets/art/shift.webp` and [S2.1 trace](shift-fidelity.md). Its approximate boxes show a **370 × 224**-pixel dome and **121**-pixel-wide torso. Those are visual estimates, not photogrammetric ground truth.
- Binary baseline: `public/assets/characters/Shift_Rigged.glb`. Direct inspection of its `Shift/Dome_Side` positions gave a dome bounding width of **1.446**, height **0.69789**, depth **0.700** in current model units; the torso's `Shift/Ink_Outline` width is **0.402**. The supplied crop cannot establish model depth.
- The original `scripts/build_reference_shift.py` remains historical authoring code; the published GLB was later hand-inspected/edited. To avoid re-exporting a different rig, the narrow-scope, deterministic patcher `scripts/shift_dome_s22.py` starts from the **actual current GLB** instead of recreating it from older generator assumptions.

## Candidate geometry

`workbench/shift/Shift_S22.glb` adjusts **only** vertices bound to Shift's existing `head` joint. A previous uniform X/Y scaling produced a **pointed helmet**, despite correct bounding-box ratios. The revised model now remaps the original eleven dome rings onto a broad **elliptical arc**, with radius proportional to √(1 − normalizedHeight²); the existing 0.700-unit depth remains untouched. Depth coordinates are left unchanged until profile reference is available. Head ink and existing flat eye geometry follow the housing; face normals are recalculated from deformed triangles, and they do not gain animation, lenses or eyelids.

| Measured quantity | Baseline GLB | S2.2 candidate | Reference-guide target |
| --- | ---: | ---: | ---: |
| Dome width | 1.446 | **1.229256** | torso width × (370/121) |
| Dome height | 0.69789 | **0.744198** | width × (224/370) |
| Dome width / torso ink width | 3.597 | **3.058** | **3.058** (approx.) |
| Dome width / height | 2.072 | **1.652** | **1.652** (approx.) |
| Dome depth | 0.700 | **0.700** | Unknown; deferred |

[Orthographic mesh projections](../evidence/shift-s22-ortho.svg) show the owner-derived crop, front candidate and side candidate with the old contour dashed in brown. **These projections are computed from the source GLB mesh vertices, not a WebGL browser screenshot**. The side view only proves that existing depth was retained; it does not certify profile fidelity.

## Boundaries preserved

- **9504 head-bound vertices** across dome front (2160), dome side (3600), head ink/rims (2016) and eye graphics (1728). The only modified binary attributes are those vertices' POSITION and normalized NORMAL.
- Existing head-bone association, 16-joint skeleton, UVs, JOINTS_0, WEIGHTS_0, animation names/clips, torso, arms, legs, hidden weapon and remaining meshes remain unchanged.
- Source `Shift_Rigged.glb`, in-game model loading and Qwerty/Tab remain untouched. The side ratio is not invented from source art.
- The eye graphic's *relative* location remains unchanged for this pass; separate S2.3 may correct its placement after reviewing the candidate.

## Verification

1. GLB byte-header/chunk lengths, 16-joint head association, material-specific vertex counts, vertex bounds and head-normal renormalization checked against the original binary.
2. The first bounding-box-only candidate was **rejected after software rasterization** showed a pointed cap. The revised candidate's per-ring curvature is now checked numerically, and the test suite explicitly rejects narrow upper shoulders.
3. This session has **not** run the Python tests or compiled the candidate generator in a repository checkout; the regression checks are authored but unexecuted.
4. A full repository-side test and **Chromium browser screenshot** have **not** been executed in this session. Run `python3 -m unittest discover -s tests -p 'test_shift_dome_s22.py'` from a checkout containing both source and candidate, then render with the actual GLTFLoader in browser and compare front/side views. Check for near/far occlusion, eye attachment and game-distance silhouette before accepting.
5. Cold GLEE adversarial review was unavailable. The user explicitly directed that this **candidate-only** commit be pushed to `main` despite this pending gate. This does **not** mark S2.2 complete or authorize replacing the live Shift asset. Cold GLEE review and actual Chromium browser QA remain prerequisites for acceptance.

The source drawing governs visible shape; the numerical outline trace alone cannot grant owner approval.

## Adversarial correction

A software-rasterized view of the first S2.2 candidate showed a **tall, pointed dome**, even though width/height ratios passed. The eleven-ring elliptical correction broadens the shoulders and was intentionally kept isolated from production. The SVG evidence must not be mistaken for a Chromium screenshot or a final visual approval.

## Shift loader name verification (S2.2 follow-up)

The raw GLB node is `arm.R`, while the existing runtime intentionally calls `getObjectByName('armR')`. **This is not a bug:** the bundled Three.js r180 `GLTFLoader.createUniqueName()` passes node names through `PropertyBinding.sanitizeNodeName()`, which removes dots before installing the hierarchy. Do not change the lookup to `arm.R`. The new Node regression in `tests/shift-reference-asset.test.mjs` loads both GLBs using **the actual bundled loader**, checks the sanitized bone name, checks skinned meshes and independent white eye material, and steps the animation mixer.

This regression was **added but not executed** in this chat: a network-disabled shell cannot clone the GitHub checkout, and the connected repository interface cannot run commands. It belongs in the normal `npm test` suite. The existing `getObjectByName('armR')` is still read-only and production remains unchanged.


## Isolated browser acceptance route

A self-contained QA page and script were added under `tests/visual/shift-s22.html` and `tests/visual/shift-s22-preview.js`. Serve the **repository root** (not `public/`) using `python3 -m http.server 8765`, and open:

- `http://127.0.0.1:8765/tests/visual/shift-s22.html?view=front`
- `http://127.0.0.1:8765/tests/visual/shift-s22.html?view=side`
- `http://127.0.0.1:8765/tests/visual/shift-s22.html?view=threequarter`
- `http://127.0.0.1:8765/tests/visual/shift-s22.html?view=front&pose=walk&frames=1`
- `http://127.0.0.1:8765/tests/visual/shift-s22.html?view=front&pose=talk&time=0.2`

The page loads only `workbench/shift/Shift_S22.glb`, applies the actual four-band Shift cel renderer, checks the real r180 sanitized `armR` joint and three animation clips, then exposes `document.body.dataset.shiftReady` and `window.__shiftQA` for browser automation and screenshot capture. It cannot modify the live website or the installed model. **These browser sessions have not been executed in this chat**; acceptance stays open until actual Chromium screenshots and movement inspection are recorded.


## Main-branch handoff — October 24, 2026

`main` includes the isolated `workbench/shift/Shift_S22.glb` candidate, generator, tests, source comparison, and stand-alone browser viewer. The active loader at `public/world3d.js:126` still requests `/assets/characters/Shift_Rigged.glb`; the published character and gameplay are unchanged. As checked immediately after the push, the new commit had **no reported workflow runs or commit statuses**; this does not constitute a passing test result.

**Remaining S2.2 gates:** execute the Python candidate build/verification test, Node runtime loader test, and actual Chromium front/side/animation captures against `tests/visual/shift-s22.html`; perform independent cold GLEE review. Keep the S2.2 checkbox unchecked until evidence proves the original-art silhouette and confirms there are no visual/runtime regressions. Do not proceed to S2.3 or silently substitute the workbench GLB before S2.2 is accepted.

## In-game S2.2 acceptance route (isolated feature branch)

The `feature/shift-s22-in-game-qa` branch adds a **loopback-only** `shiftQA` query to the actual 3D game loader. Run `python3 scripts/serve_shift_qa.py` from the repository checkout and open `http://127.0.0.1:8765/?shiftQA=front`; supported variants are `side`, `threequarter`, `back`, and `talk`. Only loopback selects `/workbench/shift/Shift_S22.glb` and sets `#world[data-shift-model="glb-s22"]` on successful load. Any non-loopback host continues requesting `/assets/characters/Shift_Rigged.glb`. The existing failure fallback stays unchanged.

`window.__shiftQA` exposes the active game camera, cast, scene and renderer **only during the loopback test**, allowing direct WebGL captures at game scale. The route is acceptance tooling, not evidence that the candidate has passed visual review. The branch is intentionally kept off `main` until cold GLEE review and browser checks finish.

### Local QA server mapping

The game uses absolute asset paths such as `/boot3d.js`, while the candidate lives outside `public/`. The stock `python3 -m http.server --directory public` would make the workbench GLB inaccessible, and serving the repository root directly would make the game assets inaccessible. `scripts/serve_shift_qa.py` solves this with a **127.0.0.1-only** server: `/` and standard asset URLs map to `public/`, only `/workbench/shift/` and `/tests/visual/` expose non-public QA files, and `/public/` resolves vendor imports from the standalone visual test. Traversal escaping those roots is blocked and directory listings are disabled. `tests/test_shift_dome_s22.py` includes path and traversal regressions.

This is local testing infrastructure only. It does not change the deployed Cloudflare Worker or publish the candidate GLB as a production asset.
