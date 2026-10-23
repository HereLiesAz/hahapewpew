# Haha Pew Pew — atomic production backlog

**Workflow:** One sub-step, one commit, one verification report. This list is a work queue, **not** a claim that any model or scene is already production quality. Source of truth for visual form is the owner's original `tabshiftqwerty.jpg` drawing and subsequent explicit corrections, not generative reinterpretations.

## Rules of completion

1. **Exactly one numbered sub-step per completion commit.** Commit message starts with the ID, e.g. `Q1.2: align Qwerty trapezoid geometry`. If a sub-step touches multiple files, those changes belong together in that one commit. Never declare several sub-steps complete in a catch-all commit.
2. **Keep work isolated.** Documentation/checklists may land on `main`; unfinished geometry or integrations belong on a feature branch. A working intermediate feature commit is not permission to replace the public character.
3. **Acceptance evidence is mandatory.** Record relevant tests, export validation and *actual rendered screenshots* or motion captures where the sub-step affects visuals. A source-code review or green unit test is not a visual check.
4. **No cosmetic substitution.** True-to-reference proportions, topology and behavior precede textures or shader polish. Qwerty and Shift require cel shading; Tab and adults do not.
5. **Update this checkbox in the same commit that completes its sub-step.** If a check fails, leave the box open and explain the blocker. Do not fake screenshots or claim GTA-grade fidelity from simple meshes.
6. **Small timeboxes.** Stop after each completed, verified and committed sub-step; then take the next one. Avoid initiating multiple asset builds or unrelated scene passes simultaneously.

## 1 — Qwerty: accurate model, rig, and talk mechanism

- [x] **Q1.1 Reference contract:** Document the owner's *specific* front silhouette, eye placement, stationary bottom plate, cylindrical torso, near-zero neck, short limbs, oversized clamps/feet, flat eyes/lids, and prohibited additions. **Done when:** a signed-off-from-source visual checklist exists in `docs/characters/qwerty-fidelity.md` (source-derived, not assumed user approval).
- [x] **Q1.2 Outer-head geometry:** Rebuild the GLB trapezoid as one continuous bevel-free-or-minimally-beveled upper housing, with correct top/bottom width, depth and lower eye plane. **Done when:** orthographic front and profile render overlays match the reference silhouette, including no mouth/jaw.
- [x] **Q1.3 Base and hinge:** Keep only the *bottom surface* attached to the short neck; locate a rear hinge so the entire upper trapezoid lifts without splitting the front. **Done when:** closed, half-open and open renders show the exact separation and no visible jaw or lip.
- [x] **Q1.4 Body and extremities:** Build cylindrical body, negligible neck, proportionally short arms/legs, large hand clamps and oversized feet. **Done when:** front/side full-body reference overlays and floor contact check pass.
- [x] **Q1.5 Flat expressive face:** Put white emissive 2D discs low on the front, with independent 2D eyelid overlays; use red for kill mode, no pupils, eye sockets or eyeball geometry. **Done when:** white, red, half-lidded and wide-eyed test renders pass.
- [x] **Q1.6 Rig/export:** UV unwrap where necessary and export a standalone skinned GLB with named joints, valid bind inverses, normalized weights, and individually addressable eye/lid materials. **Done when:** glTF validator and structural rig/UV checks pass.
- [x] **Q1.7 Movement and cel shading:** Build discrete head-flap speech animation, short-stride locomotion and four-band robot cel shader, with face graphics unaffected by light bands. **Done when:** motion capture demonstrates separate walking/talking and all clips close to rest pose.
- [ ] **Q1.8 Browser acceptance and swap:** Load the new GLB on a test route, inspect front, side, three-quarter, talk and kill mode at game camera distance, then enable only after no regressions. **Done when:** browser screenshots/motion check and runtime tests pass; save evidence.

## 2 — Shift: accurate dome robot

- [ ] **S2.1 Reference contract:** Measure the dome-to-body ratio, small torso/limb and foot positions against the original drawing. **Done when:** labeled reference tracing and prohibited redesign details are documented.
- [ ] **S2.2 Dome silhouette:** Create a true rounded dome with correct rim and depth, not a sphere perched on a toy block. **Done when:** front/side orthographic silhouettes pass.
- [ ] **S2.3 Immovable graphic eyes:** Attach two flat white 2D eye surfaces to the dome curvature at the correct angles; no eyeballs, eyelids or tracking. **Done when:** eye shape/location remain fixed in head coordinates through movement.
- [ ] **S2.4 Torso, arms, legs and feet:** Rebuild compact proportions and leg joints from the reference. **Done when:** full-body compare and foot contact checks pass.
- [ ] **S2.5 Hidden minigun:** Model the concealed weapon and separately actuated reveal/spin mechanism without altering idle silhouette. **Done when:** stowed/revealed poses and barrel rotation checks pass.
- [ ] **S2.6 Cel material and GLB rig:** Prepare named bones/UVs and consistent banded material; keep white eyes emissive and unshaded. **Done when:** glTF structural checks and robot shading samples pass.
- [ ] **S2.7 Animate and accept:** Export idle/walk/turn/weapon sequences and inspect in an actual game browser. **Done when:** recordings, joint movement and fallback tests pass before replacing Shift.

## 3 — Tab: child, box and bear

- [ ] **T3.1 Reference measurements:** Lock child-to-robot scale, pose, dress hem, exposed limbs, hand shapes, bear and exact box proportion. **Done when:** annotated front reference checklist exists.
- [ ] **T3.2 Box mask:** Model hollow cardboard panels, folds, flaps, printing and drawn expression; avoid introducing conventional facial animation. **Done when:** front/side and edge-fold views compare to the reference.
- [ ] **T3.3 Human anatomy:** Sculpt believable *child* shoulders, knees, hands and feet under the box without adult proportions. **Done when:** anatomical silhouette and range-of-motion review pass.
- [ ] **T3.4 Dress and teddy:** Build separate dress topology with correct drape and a faithfully shaped teddy carried at the hand. **Done when:** bear placement and dress silhouette match the source from several angles.
- [ ] **T3.5 Rig, skinning and UVs:** Skin body/dress to a humanoid hierarchy, rig hand grip and export mapped assets. **Done when:** weight, deformation and glTF checks pass.
- [ ] **T3.6 Locomotion/acting:** Add child-sized steps, pauses, gestures, bear hold, idle look and plausible turns. **Done when:** captured clips show no foot sliding or dress/hand clipping.
- [ ] **T3.7 Browser fidelity gate:** Inspect Tab next to both robots at actual game scale and varied lighting. **Done when:** side-by-side reference screenshots, performance and collision checks pass.

## 4 — Adult NPCs: credible human assets

- [ ] **A4.1 Provenance/licensing:** Select legally reusable, realistically proportioned rigged adult base assets and record exact licenses and attribution requirements. **Done when:** downloadable source, license text and suitability evidence are recorded.
- [ ] **A4.2 Quality audition:** Render candidate face/hair/hands/clothing close-ups and reject low-poly or mannequin-like meshes. **Done when:** audited comparison images and clear pass/reject notes exist.
- [ ] **A4.3 Character variety:** Author at least four visibly distinct adult survivor looks covering plausible builds, ages and clothing appropriate to the story. **Done when:** silhouettes and clothing sets are independently distinguishable.
- [ ] **A4.4 UV/PBR optimization:** Preserve valid UV maps, normals and material slots while optimizing for web delivery. **Done when:** texture/UV integrity and download budgets are measured.
- [ ] **A4.5 Skeleton validation:** Standardize retargetable humanoid bone map and correct skin weights for hands, elbows, knees and shoulders. **Done when:** pose deformation and glTF validation pass.
- [ ] **A4.6 Locomotion and reactions:** Integrate walk, run, flee, crouch, scavenge, hide and reaction animation states. **Done when:** animation transition clips show no snapping.
- [ ] **A4.7 Spawn and cull:** Replace current primitive adult NPC creation with pooled GLB instances and bounded LOD/culling. **Done when:** adults display and react in-browser across chunks with stable memory/fps.

## 5 — Animation, interaction and autonomy

- [ ] **M5.1 Shared locomotion states:** Build explicit idle/walk/run/turn action controller in place of unconditional sinusoidal swing. **Done when:** transitions are testable and update-rate independent.
- [ ] **M5.2 Grounding:** Calculate step phase, stride and slope/road alignment for each character. **Done when:** foot-slide checks pass on several surfaces.
- [ ] **M5.3 Qwerty speech coupling:** Tie flap beats and eyelid poses to the displayed dialogue-page interval without TTS or invented mouth animation. **Done when:** speaking, pause and cancel clips line up with bubbles.
- [ ] **M5.4 Shift combat behavior:** Add weapon reveal/aim/fire/spin/retract with distinct safe idle pose. **Done when:** separate test scenarios never leave the weapon stuck visible.
- [ ] **M5.5 Tab behavior:** Add bear-aware gestures, lagging/catching up, response to threats and moments of quiet. **Done when:** short scripted cases produce correct independent reactions.
- [ ] **M5.6 Survivor AI:** Implement navigable waypoint choices and flee/hide/scavenge/observe behaviors rather than only walking along X. **Done when:** reproducible encounter simulations pass.
- [ ] **M5.7 Camera and collision:** Prevent character/building intersections and keep spectator framing/caption placement legible in motion. **Done when:** recorded follow/explore walkthroughs and collision tests pass.

## 6 — Devastated New Orleans: recognizable lived-in districts

- [ ] **N6.1 Street/district plan:** Define rough French Quarter, CBD, Garden District, Mid-City, cemetery, industrial and flood-zone placements and road connections. **Done when:** traversable coordinate map and route tests exist.
- [ ] **N6.2 French Quarter detailing:** Author varied building widths, shutters, wrought-iron galleries, courtyards and street-level storefronts. **Done when:** close and wide browser views read recognizably as the Quarter.
- [ ] **N6.3 Residential blocks:** Add shotgun and raised houses, porches, fences, driveways and varied lot setbacks. **Done when:** distinct neighborhood streets pass repeated-chunk inspection.
- [ ] **N6.4 Civic landmarks:** Improve the Superdome, CBD skyline and selected recognizable junctions without falsely claiming geographic survey accuracy. **Done when:** long-range silhouette comparisons pass.
- [ ] **N6.5 Streetcar infrastructure:** Build rails, overhead wires, stops and historic corridor features; avoid traffic conflicts. **Done when:** continuous rails and junction tests pass.
- [ ] **N6.6 Cemeteries and green space:** Add above-ground tomb families, paths, live oaks and characteristic vegetation. **Done when:** district screenshot comparisons and collision tests pass.
- [ ] **N6.7 Catastrophe variants:** Differentiate flood lines, debris drifts, collapsed infrastructure, burned structures and relatively intact refuges. **Done when:** damage follows explicit district rules, not identical random rubble.
- [ ] **N6.8 Street life and optimization:** Add restrained survivors, wrecks, scavenger activity, sound/lighting cues and LOD budgets. **Done when:** representative downtown and neighborhood fly-throughs hold performance targets.

## 7 — Final integration and visual quality assurance

- [ ] **V7.1 Visual test scene:** Create isolated reference-neutral turntable page for every GLB, pose and material mode. **Done when:** screenshots are reproducible by a one-command browser test.
- [ ] **V7.2 Protagonist review:** Capture front/side/three-quarter/back views and all special eye/talk modes for Qwerty, Shift and Tab. **Done when:** discrepancies logged and blocking ones fixed.
- [ ] **V7.3 NPC review:** Review adult face/hair/hands/deformation with varied outfits and reaction clips. **Done when:** close-up screenshots and weight-penetration checks pass.
- [ ] **V7.4 World review:** Traverse representative New Orleans districts and desolate outskirts at street level and from the spectator camera. **Done when:** image set covers all zones and missing geometry is recorded.
- [ ] **V7.5 Mobile budget:** Measure loading bytes, frame times, memory and texture usage on mobile-like and desktop browser settings. **Done when:** stated performance budgets are met or documented blockers remain open.
- [ ] **V7.6 Behavior and regression:** Exercise AI dialogue fallback, navigation, pausing, camera, collisions, loading failure and scene streaming. **Done when:** automated suite and scripted browser runs pass.
- [ ] **V7.7 Production verification:** Merge *approved* feature work, confirm published commit matches production and take a fresh live-site screenshot. **Done when:** deployment SHA and visual comparison are both verified.

## Completion ledger

Each completed checkbox should be committed together with its deliverable and have its commit ID recorded in this ledger if known. A test-branch commit is not automatically a production deployment. The earlier procedural assets are **candidates**, not retroactive completion of any step above.
