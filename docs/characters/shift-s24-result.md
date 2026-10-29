# S2.4 — Shift torso, limbs, feet and rest-pose joint alignment

**Historical S2.4 candidate record.** The current production verification is recorded below. The following candidate measurements and implementation notes describe the original S24 export, not the current shallow-wok head.

**Original state:** workbench candidate, **not accepted**. The model stays at `workbench/shift/Shift_S24.glb`; the production character at `public/assets/characters/Shift_Rigged.glb` is unchanged. Merging this candidate is not permission to swap it into the live game. The S2.4 checklist remains unchecked pending actual render/motion tests.

## Reference and proportions

Source of truth: [owner-derived Shift crop](../../public/assets/art/shift.webp), [measured S2.1 contract](shift-fidelity.md), [front-pose comparison](../evidence/shift-s24-full-body.svg), and the incoming `workbench/shift/Shift_S23.glb`. The drawing shows a **small rectangular torso**, thin arms ending in tiny hook clamps, abbreviated legs and **wide wedge-shaped feet**, under a massive low dome.

The original drawing is 378×422 pixels. Its traced bounds are dome y=2–226, torso y=237–348, arm tips near y=329, leg/foot region y=342–390. The GLB source already has torso/foot meshes and 16 bones; it needs restaging rather than decorative mechanical additions. Pixel positions are *approximate* and provide no authority for the unseen side depth.

| Measurement | Source S2.3 | S2.4 candidate |
| --- | ---: | ---: |
| Dome vertical extent (local units) | 0.7442 | **0.7442**, unchanged |
| Torso outline height | 0.5220 | **0.3753** |
| Rest-pose foot minimum world Y | +0.124 (floating) | **0.000** |
| Dome portion of standing height | ~48% | **57.7%** (224/388 traced) |
| Dome / torso height ratio | 1.43 | **1.98** (reference ~2.02) |
| Both foot wedges | Existing dark wedges | **Retained**, raised to floor contact |

## Candidate implementation

Reproducible tool: `scripts/shift_body_s24.py workbench/shift/Shift_S23.glb workbench/shift/Shift_S24.glb`.

The mapping keeps **every X and Z vertex coordinate** unchanged and alters only lower-body Y:
- The spine-weighted torso/inset uses linear remapping from old y=0.374–0.896 to new y≈0.521–0.896.
- Arm, elbow and wrist geometry maps from old y≈0.507–0.794 to new y≈0.584–0.883, preserving the thin two-segment arms and original hook/clamp polygons.
- Hip, knee, ankle and wedge-foot geometry maps from old y≈0.124–0.395 to new y≈0.381–0.541, preserving both foot sizes and profiles.
- A new **common scene wrapper** `Shift.S24.GroundAlign` translates the *mesh and its entire skeleton together* by −0.3811405 Y, landing both foot wedges at Y=0 without changing their depth or width.
- The original 16 bone indices, hierarchy, names, UVs, materials, JOINTS_0, WEIGHTS_0, face artwork and all three animation clips are unchanged. Spine, arm, elbow, wrist, hip, knee and ankle **rest pivot elevations and inverse-bind-matrix Y translations** are adjusted together, so existing animation tracks still rotate about their corresponding rest pivots. Neck/head positions remain unchanged in character-local coordinates.
- Renormalize lower-body triangle face normals after vertical reprojection. No added fingers, long human legs, armor, weapons, facial joints, or new animation channels.

Direct GLB creation accounted for **144 torso, 936 arm and 504 leg vertices** changed; **9,660** other vertices stay fixed.

## Acceptance and verification

- **Reference evidence:** [source-to-mesh orthographic trace](../evidence/shift-s24-full-body.svg). It embeds the original crop, retains the S2.3 dome/eyes, and plots transformed lower-body triangles and the floor-contact line. It is **not** an actual browser render or motion capture.
- **Structural constraints:** `tests/test_shift_body_s24.py` checks the art ratios, grounded wedge-foot vertices, unaltered X/Z and unaffected head/eye positions, 16 joints and identical animation clips, rest joint/IBM consistency, and generator reproducibility.
- **Actual Three.js:** `tests/shift-reference-asset.test.mjs` loads S2.4 using the bundled r180 GLTFLoader, verifies arm/hip/knee/ankle attachments, animation clips, skinned geometry and unshaded white eyes. The existing standalone viewer now also supports `?model=s24`, leaving S2.2/S2.3 options intact.
- **Still outstanding:** Full Python/Node test execution, **actual Chromium front/side/three-quarter screenshots**, walk/talk motion captures and walk-cycle foot collision/contact checks, and a cold independent GLEE review. A mathematical rest contact gate cannot prove *animated* contact. These tools were not executed here, so none is claimed to have passed.

### Reproduction

Use `python3 scripts/serve_shift_qa.py` from a checkout; open
`http://127.0.0.1:8765/tests/visual/shift-s22.html?model=s24&view=front`,
change to `view=side` and `view=threequarter`; use `pose=walk&frames=1` and `pose=talk&time=0.24` to inspect motion. The private viewer is local-only and does not replace the live Shift asset.

**Merge policy:** The user explicitly requires every step's candidate work to be committed, pushed, and merged. The S2.4 **implementation candidate** may therefore be merged for continuity while the S2.4 acceptance box stays open until complete evidence is available. The next numbered step S2.5 must not be misrepresented as completed or as production-ready.


## Current production S2.4 verification

The production installer now uses the S29 shallow-wok asset, which retains the S24 lower body through S27/S28. The owner's later instruction preserves the body size and leaves height wherever the wok correction puts it; the original dome/standing ratios above are historical, not current targets. No body, head, root scale or GLB is changed by this verification step.

`scripts/robot_proportions_browser_qa.mjs` now captures the live production model at front, side and three-quarter angles, plus three walking poses. It samples 32 evenly spaced phases over the authored `Shift_Walk` clip using the production sequence controller. For each phase it evaluates every visible ankle-bound skinned vertex, raycasts the actual rendered road beneath that vertex, rejects foot penetration, and requires at least one foot to meet the road. Both knees must change orientation. This adds a browser regression beyond the existing neutral-pose and Node synthetic-plane grounding tests.

The local production Chromium run passed these gates; the three-quarter and walking close-ups were opened and inspected. The complete 85-test Node suite and 50-test Python suite passed. The existing CI production-capture step executes this new gate and uploads the close-ups and per-phase measurements in `results.json`.

**Limits:** the game is paused while authored walking phases are sampled at a fixed road position. These checks establish skinned foot contact on that road, not locomotion distance, stance-foot sliding, slopes, or uneven terrain. They do not establish an exact body match to the perspective source drawing. S2.4 artistic acceptance stays open; no torso or limb redesign is authorized by this verification result.


### Animated contact on inclined support

The follow-up regression exposed a real grounding error: choosing only each foot's lowest world-Y vertex leaves other corners below a rising support plane. The production `createShiftSequenceRig().ground()` now probes all distinct rendered foot positions and applies the greatest required vertical correction. Repeated triangle corners share a probe. No body mesh, joint, clip, character scale or dome dimension changes.

The new Node test drives the actual production controller and live GLB through walking poses on positive and negative support slopes at two actor headings. It independently raycasts every ankle-bound skinned vertex, rejects penetration and requires contact. It fails against the former lowest-vertex implementation and passes with the correction. Existing flat-road, relocation, raised-surface and missing-support regressions remain in place.

This fixes vertical clearance; it does not rotate feet onto slopes, lock a planted foot against sliding, or establish a performance budget. The production browser gait gate continues to inspect the actual flat game road; the inclined planes are synthetic Node test surfaces. S2.4 artistic acceptance and M5.2's broader locomotion work remain open.


## Owner-directed body reduction — live runtime sculpt correction

The owner subsequently requested that Shift's body be **much smaller**, retaining the inverted-wok head and allowing standing height to fall wherever the result naturally places it. The live GLB is preserved as source material. `public/shift-motion.js` now scales the spine-bound torso and arms to **55% of their existing size** in the production skinned rig. The neck scale inversely compensates so the dome, printed eye graphics and head retain their original dimensions, while the head **settles lower** with the compact torso rather than floating at its old height. This follows the owner's instruction to leave final standing height unconstrained. Feet/legs, scene-root scale, UVs, material partitions, clip keys, GLB bytes and hidden weapon mechanism remain intact. This correction is re-applied after test/runtime rest-pose resets. The fallback procedural character matches the compact torso and compensates its unchanged head dimensions.

Regression coverage compares real skinned torso vertices before/after correction, verifies source attribute buffers are unchanged and the head retains its dimensions while naturally settling lower, checks pose recovery and verifies live production relative size through the Chromium QA capture. The completion checkbox remains open pending inspected visual fidelity (especially the body-to-feet articulation) and a passing browser workflow. This is not a claim of artist approval.


### Actual browser-image correction: reconnect torso to hips

Inspecting the production front/side captures from PR #34's first green Chromium run revealed a **visible gap** between the shortened torso and unchanged upper legs. Passing the existing ratio and grounding checks did not detect it. The spine is now re-anchored downward when compacted: its rest-position adjustment is computed from the actual `Shift/Body_Graphite` vertex minimum so the lower torso edge stays at its original hip contact, not the elevated position produced by shrinking about the spine pivot. The separate leg bones, feet, binding, head geometry, original GLB and root scale are unchanged. The procedural fallback's torso anchor is adjusted too. Node regression checks the real skinned body's world-space lower edge; Chromium checks the uppermost hip-weighted vertices overlap or meet the live torso's lower edge. Both gates must pass before this revision is merged or accepted.
