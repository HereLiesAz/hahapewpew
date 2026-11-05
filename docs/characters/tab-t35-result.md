# T3.5 — Tab skin weights, deformation and UVs

Source geometry: `scripts/build_reference_tab.py`. Production export: `public/assets/characters/Tab_Reference.glb`.

The previous export had a valid 20-bone hierarchy and UV channels but assigned all mesh vertices to a single rigid joint. T3.5 adds falloff-weighted two-bone skinning at shoulder, elbow, wrist, hip, knee and ankle transitions; the bodice eases from chest to spine and the damaged skirt uses bounded spine/left-hip/right-hip weights. Cardboard, face and lettering stay fully bound to `head`, rounded flats to the ankle joints, and the bear remains fully on its own `bear` bone attached under the hand. The hand holding the ear stays rigid and its geometry does not change.

No change to box prints, child proportions, torn cloth topology, original UV coordinates, deterministic grime textures, bone rest transforms or existing three animation tracks. Independent regression verifies weights, inverse binds, textured UV limits, articulation and live GLTFLoader deformations, plus a return-to-rest capture.

The T3.5 acceptance box stays open until the freshly regenerated GLB passes all Python/Node/Chromium checks and the actual screenshots are inspected. T3.6 movement and T3.7 overall game fidelity are different tasks.


Independent PR review checks verified three legitimate T3.5 concerns: upper-arm sleeve cuffs need secondary elbow weights, the rigid shoes must be tested against **both actual ankle indices**, and right/left skirt influence must be checked separately rather than by combined hip weights. Added tests and distal sleeve blending; live browser QA now saves explicit flexed front/side and restored shots for visual deformation review. Existing dirty/torn fabric and original box ink remain untouched.


## GLTFLoader source-name handling

A separate PR reviewer identified a real runtime mismatch: this repository's Three.js GLTFLoader sanitizes periods from `Object3D.name` in `createUniqueName()` while retaining the original glTF node label in `bone.userData.name`. The browser weight sampler now reads the unsanitized `userData.name`; the posed elbow/knee/hip Object3D lookups use verified runtime names (`elbowR`, `kneeL`, `hipL`). This is a browser QA correction, not a change to the exported 20-joint glTF naming contract.


## Export synchronization and verification

The asset workflow committed the new GLB on the feature branch after the generator changed. The intermediate PR check that started before this binary update tested an older GLB and correctly failed source-versus-export and cuff gates. The next PR run must test the regenerated artifact. All 20 joints and the original printed cardboard materials remain unchanged; the right short sleeve's weighting radius is larger because its authored cuff lies farther from its elbow than the bent left sleeve's cuff. Renderer support is pinned to Ubuntu 24.04 for Playwright 1.56.1, which cannot install Chromium dependencies on the newer ubuntu-latest image.


## Acceptance evidence — November 5, 2026

The regenerated `Tab_Reference.glb` completed the Node and Python regression suites plus real Chromium WebGL acceptance in [run 42019090902](https://github.com/HereLiesAz/hahapewpew/actions/runs/42019090902) (passed). Screenshots and metrics are preserved in [artifact 13411556353](https://github.com/HereLiesAz/hahapewpew/actions/runs/42019090902/artifacts/13411556353), especially `robot-proportions/tab-t35-flexed-elbow-knee.png`, `tab-t35-flexed-elbow-knee-side.png`, `tab-t35-skin-restored.png` and `results.json`. Independent review identified the cuff, bilateral hip, shoe-joint and sanitized-browser-name gaps. All were fixed and reviewer threads resolved. Cold GLEE was not available, so do not substitute independent PR review for that distinct check.

The production browser measured right elbow displacement 0.0506753760 world units, hem/skirt displacement 0.0023916545 units under a left-hip bend, and zero positional return-to-rest error at both probes. The renderer captured the posed child and restored source geometry; no visible unexpected bone breaks were found within the T3.5 scope. The long-standing stylized limb geometry and the owner-unapproved cross-character scale are separate open fidelity items, not signed off here.

Enforced invariants: glTF weight/UV normalization and source bone indices (`tests/test_tab_rig_t35.py:23`), elbow/knee/shoulder gradients (:38), independent left/right hip cloth coupling (:53), rigid cardboard, footwear and ear-grip attachments (:76), cuff secondary weights (:100), 20 inverse-bind matrices (:110); original cardboard image hashes, joints and clips (`tests/test_tab_box_t32.py:75`); dirt and physically torn drapery (`tests/test_tab_dress_teddy_t34.py:47` and :60); production caller `public/world3d.js:193-220` loads and animates this asset. The unrelated backlog boxes remain unchanged.
