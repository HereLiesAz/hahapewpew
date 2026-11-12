# Tab — reference-bound skinned character (candidate)
The original `tabshiftqwerty.jpg` artwork is the design authority, not a prompt to redesign the character. Front has one large eye, one smaller eye, steep eyebrows and gritted-teeth print on an actual box; the left side has upside-down maroon THIS END UP lettering and a downward arrow. The four flaps open around shoulders. No visible conventional face, mouth rig or hair underneath. Slim child wearing a dark short-sleeve bodice and worn, dirty and torn gray dress with irregular hem, bare shins and dark rounded flats. One arm bent with a hand at waist, the other carries a small brown bear by the ear.
The separate self-contained file `public/assets/characters/Tab_Reference.glb` includes a 20-bone glTF skin, UV-mapped drapery/limbs, two original cardboard decal PNGs plus three weathered cloth textures, and `Tab_Walk`, `Tab_Idle`, `Tab_Bear_Swing` clips. Generator is `scripts/build_reference_tab.py`. Do not cel-shade Tab as a robot. Existing character code remains the fallback when loading fails.
The asset has been reviewed in standalone render; this feature branch is not an assertion of in-game visual approval. Before merging, inspect the game browser from front and left, check embedded box art orientation and bear hand position, and verify there are no WebGL or animation errors.

T3.2 replaces the solid box core with an open-bottom shell and four thin flaps; see `docs/characters/tab-t32-box.md` for preservation gates and production close-view evidence. This does not grant final model acceptance.


## T3.5 weighted skinning and UV/export

The original Tab GLB geometry was bound entirely to single joints, leaving elbow, knee and sleeve boundaries rigid even though named bones and glTF weights existed. The T3.5 generator now exports normalized two-joint blends near shoulders, elbows, wrists and knees, with a chest-to-spine transition and a *small* three-joint spine/left-hip/right-hip influence near the damaged skirt's lower edge. The original vertices and UV coordinates are not modified. Both cardboard prints and panels stay rigid on `head`; shoes remain rigid on ankle bones, and plush geometry stays on `bear` (child of `hand.R`), preserving the ear grip and existing swing clip. Preserve the deterministic dirt and tears added in T3.4.

The `test_tab_rig_t35.py` suite validates glTF weights/joint indices, inverse binds, UV bounds, printed masks, rigid attachments and multi-joint deformation under controlled bends. `robot_proportions_browser_qa.mjs` captures and measures the live GLTFLoader skinned geometry under knee/elbow pose and after rest-pose restoration. Completion requires that evidence and passing workflow; do not infer owner sign-off for the still-open full fidelity items.

## Replacement decision: Victoria child base

Owner selection (2026-11-05): **Victoria Character Rigged**, by **Rex Mun** on Blendkit:
https://www.blendkit.com/asset-gallery-detail/1fcc4446-1992-48ec-a160-9cd73ee35158/

Use Victoria's professionally modeled, UV-unwrapped and rigged child anatomy **instead of** the current procedural child body. Retain Tab's *existing* dirty, torn gray dress, cardboard-box mask and printing, flaps, bear carried at the ear, and established root scale unless the owner explicitly requests changes. Preserve their art and make the dress fit Victoria's skeleton rather than reconstructing it. Do not substitute another character coincidentally named Victoria.

**Source and distribution gate:** The listing labels the 19,654-polygon, approximately 6.5 MiB model free under Blendkit's **Royalty Free**, **not CC0**, license. Official licensing guidance permits inclusion in games only when the asset is not easily extracted:
https://www.blendkit.com/docs/licenses/
https://www.blendkit.com/docs/licenses/licensing-faq/

This project is a public web app and GitHub repository. A shipped GLB in `public/assets/characters/` is directly retrievable by users. **Do not commit, bundle, host or publish Victoria's raw or repacked geometry under this license without explicit redistribution permission from the rights holder.** Also do not claim the free download is redistribution authorization. The official download is via the Blendkit Blender add-on, not an independently verified unrestricted direct file URL.

**Pending prerequisites:** Obtain the actual Victoria source file through the authorized provider; inspect bone names, bind pose, mesh partition and shape; secure permission covering extractable public web-game delivery and source distribution (or a separate distribution arrangement that legally satisfies Blendkit's terms). Only then create a distinct feature branch, retarget the preserved dress/box/bear, add source-based tests, inspect front/side/motion captures, and swap the production loader after acceptance. Until then leave `Tab_Reference.glb`, `build_reference_tab.py`, existing animations and the T3.6 checklist unchanged. This is a sourcing decision, **not** a completed integration.

## Victoria child body replacement (2026-11-05)

The owner selected Rex Mun's fully built [Victoria Character Rigged](https://www.blenderkit.com/asset-gallery-detail/1fcc4446-1992-48ec-a160-9cd73ee35158/). `Tab_Victoria.glb` is a **separate** 20-joint candidate assembled from Victoria's skinned, UV-textured 6,438-vertex child body using `scripts/assemble_victoria_tab.py`; it keeps the original 16 Tab costume/prop primitives, including **dirty, physically torn dress, charcoal-colored material folds, printed box/flaps, bear, shoes**, originally geometry- and UV-identical. PR #57 deliberately fits selected clothing, shoes and teddy-pivot geometry to Victoria while preserving UVs, grime art, torn topology, and box artwork hashes. The original `Tab_Reference.glb` remains unchanged as the runtime fallback. The browser prefers Victoria when its complete GLB and the three Tab animation clips load; `data-tab-source` distinguishes `victoria` from `reference`.

Model provenance: Blenderkit revision `58d886e3-672a-4e41-b0ff-2d9b27cd130a`, source GLB SHA-256 `ba3853fe4c68f613a69240c4de782b931b9730adfd94049242afd2e94ed89eca`, Blenderkit royalty-free. The source is downloaded and decoded from official public metadata only by `.github/workflows/tab-victoria-source.yml`. Repacking the child body into the application does not transfer its copyright. Preserve attribution. The model's leg rest transforms were realigned to Victoria's anatomy; T3.6 separate locomotion and acting acceptance remains open. Neither this selection nor source loading constitutes sign-off on overall source-art fidelity.

Verification: `tests/test_tab_victoria_integration.py` asserts upstream identity, source hash, original outfit/props and image bytes unchanged, genuine textured child vertex and face counts, normalized 20-joint skin and leg binds; `scripts/robot_proportions_browser_qa.mjs` checks that the production page loads the actual child body and records front and side frames before final visual acceptance.


## Victoria sleeve and palm fitting correction

The first production Tab/Victoria render showed anatomically stretched hands and unwanted body geometry protruding through the dirty/torn dress and cardboard box, even though structural GLB tests and browser load checks passed. The body transfer applies a separate wrist-anchored, near-rigid hand transform (instead of stretching fingers with the long forearm) and omits covered head, neck, torso and upper-thigh *body* triangles. The 16 original costume/prop mesh partitions and their vertices, material maps, bone bindings and images are unchanged. This is the reason for preserving a two-stage source retarget: anatomy may move, while the owner's established art must not.

Regenerate via `.github/workflows/tab-victoria-source.yml`; verify `tests/test_tab_victoria_integration.py`, the main WebGL QA, and the `tab-victoria-front.png`/`tab-victoria-side.png` screenshots. This correction addresses first-pass fit artifacts, not the separate T3.6 locomotion and T3.7 art-direction approvals. The historic source redistribution concern in the replacement-decision section remains a licensing question, not a runtime failure.

## T3.6 authored locomotion controller (pending browser acceptance)

A runtime `createTabMotionRig` controller in `public/tab-motion.js` preserves the three shipped GLB clips without rebuilding the reference mesh. The old loop advanced `Tab_Walk` constantly while the independent root traversed the street, which could not maintain planted feet. The new motion computes stride phase from actual root distance, uses short child steps with a grounded stance and two-joint knee solving, keeps the bear on the right-hand joint, lets the rigid cardboard box look around, gradually turns the character, and briefly pauses Tab independently of the robots. Original dress, dirt/rips, textures, GLB skin and props are unmodified. Real world-space ankle contact, swing clearance, reference-frame restoration and posed front/side screenshots form the acceptance gate. The separate M5.5 threat/reaction behavior is intentionally not conflated with this animation pass.


### T3.6 planted-turn lateral IK correction (verification pending)

The first two-bone controller converted each world contact to Tab-root coordinates but
solved only its vertical and forward components. When the root turned during a
pause, the solver ignored the contact's lateral offset and the shoes followed
the body sideways. The existing solver now rotates each hip laterally before
resolving knee flexion, accounting for the complete local contact vector;
`ZXY` applies hip abduction after sagittal bending. World anchors and the
separate interrupted-swing settling behavior remain in place. A contact beyond
anatomical reach may still be replanted rather than extending the leg through
its joint limits. The ankle counter-rotates hip roll after knee flexion so the shoes do not
bank away from the ground. Production-scale fixture and Chromium GLB QA
measure actual left/right ankle positions and world-space sole-up vectors
through a planted turn. This change is not final T3.6 acceptance until those
checks and rendered captures pass.

## Victoria outfit, footwear and teddy fit (PR #57)

The original Tab_Reference.glb fallback is unchanged. Four production Victoria defects motivated the following scoped fixes:

- Skirt: Previously 14% lower-hem combined hip influence left the dress nearly stationary as the thighs moved. The candidate increases its bilateral hip weighting toward the hem and removes fully covered upper-thigh faces. The existing ragged hem, tears, fray, fabric art, UVs, and skirt topology remain.
- Flats: The original shoe upper ended near Y=0.102, below Victoria's foot reaching Y=0.167. Raised vamp geometry encloses the foot while preserving the Y=0 ground-level sole and existing toe silhouette.
- Teddy: The existing bear bone rotated below and outside the hand-held ear. Its pivot and inverse bind now center the swing at the gripped ear in the existing right-hand hierarchy. The teddy mesh and sewn materials are unchanged.
- Blouse: Both old two-ring sleeve cylinders are replaced by seven-band, 20-segment tapered cloth meshes (840 skinned vertices per sleeve). The fitted rings form rounded caps, cuff flare and subtle fabric folds; the bodice receives modest tailoring. New UVs are limited to the replacement sleeves; printed cardboard, original texture images, and exposed bare arms remain intact. Post-fit normals are recalculated from actual surface triangles.

Source of truth: scripts/assemble_victoria_tab.py. Source rebuild: .github/workflows/tab-victoria-source.yml. Tests/test_tab_victoria_integration.py asserts actual material geometry and rig bindings; scripts/robot_proportions_browser_qa.mjs independently measures loaded cloth articulation, shoe coverage, the held bear pivot, and existing walking/turning invariants.

Acceptance pending: full post-regeneration Chromium captures and side/front motion frames must be inspected before claiming visual completion. The changes are limited to the Victoria candidate, not the untouched reference fallback.
