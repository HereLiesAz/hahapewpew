# S2.5 — Shift's concealed six-barrel gun

## Current production gate

The live S29 Shift uses `public/shift-motion.js`, which attaches the existing concealed gun to `wristR`. Production `world3d.js` installs this controller, routes combat through it and aims its barrel axis at the shot target. The historical isolated-candidate notes below predate that integration. No geometry, GLB, scale, clip or gameplay behavior changes in this acceptance step.

The production Chromium harness now records zero visible weapon meshes when stowed/retracted, six actual rotating barrel meshes, and dedicated deployed/profile/muzzle/spin close-ups. It samples actual rendered barrel vertices before and after the independent rotor update, requires displacement for all six, and requires the hinge, telescoping slide and muzzle axis to stay fixed. Existing real `fireAt`/`updateActors` aiming and projectile checks remain in the same run.

The close-up camera stays near the gun rather than placing a downward-facing view below the road. A blank-image rejection and minimum projected mesh span guard unusable captures; opening the images is still required. Evidence files are `shift-gun-deployed-close.png`, `shift-gun-six-muzzles.png`, `shift-gun-spin-before.png`, `shift-gun-spin-after.png`, and the full-body hidden/deploy/fire/retract views. The CI production-capture step uploads these with per-vertex measurements in `results.json`.

The Node regression independently checks real mesh vertices rather than only a spin counter. All 87 Node tests and 50 Python tests passed locally. The complete production Chromium run passed; deployed, six-tip, before/after-spin and full-body state captures were opened and inspected. Cold independent GLEE review found no remaining defect. CI success must be checked separately after merging. This gate covers concealed idle and independently actuated reveal/spin/retract, not a physically engineered internal packing arrangement or blanket owner approval of every character detail. S2.2, S2.4, S2.6, S2.7 and broader locomotion acceptance remain separate.

## Historical isolated-candidate record

**Original state:** source implementation and candidate viewer are merged for continuity; **visual acceptance remains open**. The live game still uses its original `Shift_Rigged.glb` and existing legacy weapon behavior. This work does **not** swap the production character or change the owner's original artwork.

## Reference boundary

[Shift's original art crop](../../public/assets/art/shift.webp) shows **no visible gun at rest**. The [S2.1 design contract](shift-fidelity.md) therefore requires a completely clean idle silhouette and does not authorize any particular internal barrel compartment. The S2.4 candidate [`Shift_S24.glb`](../../workbench/shift/Shift_S24.glb) retains its compact torso, wedge feet and existing armature.

## S2.5 model and moving parts

`public/shift-weapon.js` exports `attachShiftConcealedMinigun(wristBone)`. It attaches to the existing **`wristR`** bone without altering the 16 original bones, skinned character mesh, UVs, eyes, talk or walk clips. The attached model is real Three.js geometry, not an image or a flat decal.

- **Receiver and rear guard:** compact faceted metal shapes below the right wrist.
- **Deploy hinge:** independently rotating joint `Shift.Weapon.DeployHinge`, folding from −0.80 rad to straight ahead.
- **Telescoping slide:** `Shift.Weapon.TelescopingSlide`, translates −0.145 to 0 model units on the X axis independently of the rotor.
- **Rotor:** `Shift.Weapon.BarrelRotor` contains **six separate cylindrical barrels**, six discrete muzzle tips and a front retainer collar. Rotation is about the barrel's longitudinal X axis, not the hinge axis.
- **Muzzle origin:** `Shift.Weapon.MuzzleOrigin` supplies a deterministic world-space end-point for future in-game firing.
- **Materials:** named Shift materials pass through the existing four-band `celShadeRobot` shader; no emissive eye, glossy visor or new face mechanism.

### States and invariants

| Pose | Visible weapon meshes | Hinge / extension | Barrel rotation |
| --- | --- | --- | --- |
| Stowed (`pose(0,0)`) | **None**: gun group is invisible | Folded and retracted | At zero |
| Part revealed (`pose(.45,.6)`) | Receiver and barrel tips emerge | Interpolated | Can be set independently |
| Fully revealed (`pose(1,.6)`) | All six barrels and housing | Hinge straight, slide out | Independent angle .6 rad |
| Firing | Fully revealed | No additional hinge movement | 28 rad/s until firing stops |
| Retracting | Gradually closes | Slide and hinge return | Stops independently, hidden at zero |

`setDeployed`, `setFiring`, `pose`, and `update` keep the two motions separate. The stowed state uses **visibility**, not geometry shrunk into an impossible tiny space. The art specifies the *absence of a visible weapon*, not a hidden mechanical packing diagram; claims about real-world internal fit are intentionally avoided. The candidate doesn't change the silhouette because the entire gun scene subtree is non-rendering at rest.

## Acceptance harness

The workbench-only viewer `tests/visual/shift-s22.html` selects the S2.4 skinned GLB and attaches the new wrist rig **only for the S2.5 preview**. From a local checkout run `python3 scripts/serve_shift_qa.py` and compare:

- **Stowed:** `http://127.0.0.1:8765/tests/visual/shift-s22.html?model=s24&view=front&weapon=stowed`
- **Revealed:** `http://127.0.0.1:8765/tests/visual/shift-s22.html?model=s24&view=front&weapon=revealed`
- **Spinning:** `http://127.0.0.1:8765/tests/visual/shift-s22.html?model=s24&view=threequarter&weapon=spin&frames=1`

The `window.__shiftQA.weapon` handle exposes `deployment`, `barrelSpin`, `muzzleWorldPosition()`, and deterministic `pose(amount,angle)` for browser screenshot checks. Older S2.2–S2.4 model selectors still work, and the production `world3d.js` **does not** import the candidate weapon.

## Tests and approval boundary

`tests/shift-weapon.test.mjs` exercises the real scene graph using Three.js (zero visible weapon meshes while stowed, exact six barrels, independent hinge/slide/spindle states, barrel spin stopping without retracting, retraction, wrist-following muzzle, invalid update bounds, four-band material conversion and workbench-only runtime isolation).

**Structural checks:** The S2.5 implementation explicitly maintains hidden idle and two independent motions. The tests are written but have not been executed in a full checkout in this chat. **Still required** before checking S2.5 as complete: Node test run, actual Chromium stowed/revealed views and barrel-motion screenshots, and cold independent GLEE review. No rendered screenshot or production validation is claimed.

**Process:** The user explicitly requires a commit, push and merge for every numbered step. The feature **candidate** is merged onto main as source/QA implementation while visual completion stays unchecked. Do not attach the candidate to the public actor or retire the original gun before S2.7 browser acceptance.
