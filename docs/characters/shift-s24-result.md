# S2.4 — Shift torso, limbs, feet and rest-pose joint alignment

**State:** workbench candidate, **not accepted**. The model stays at `workbench/shift/Shift_S24.glb`; the production character at `public/assets/characters/Shift_Rigged.glb` is unchanged. Merging this candidate is not permission to swap it into the live game. The S2.4 checklist remains unchecked pending actual render/motion tests.

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
