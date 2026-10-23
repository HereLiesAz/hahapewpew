# Q1.4 alignment correction — torso centered under the full head footprint

The owner's correction is spatial, **not just a front-view alignment**. The
Q1.3 depth expansion changed Qwerty's head footprint from z=-0.30..0.30 to
z=-1.25..0.30, moving its midpoint to z=-0.475 while the cylindrical torso
remained centered at z=0.

Move the entire **base_plate bone** (and its child upper skull, white eye
graphics and 2D eyelids) forward by z=+0.475. The head now spans
z=-0.775..+0.775 and is centered precisely above the cylindrical body, with
no x displacement. The neck stays extremely short and centered.

This is **a partial Q1.4 correction, not completion of the entire body/limb
task**. No topology, vertex coordinates, UVs, skin weights, materials, joints,
limb animations or speaking animation buffers change. The bottom plate
stays fixed while the upper housing bounces vertically.

Generator: `python3 scripts/qwerty_center_head.py workbench/qwerty/Qwerty_Q13_depth_bounce.glb workbench/qwerty/Qwerty_Q14_centered.glb`.
Validation: `python3 -m unittest discover -s tests -p 'test_qwerty_center_head.py'`.
The candidate belongs in `workbench/qwerty`; **the public model and live site
are unchanged**. Q1.4 remains unchecked pending proportions of limbs,
clamps, feet and final full-body review. The offline rest-pose side,
three-quarter and overhead geometry comparison was inspected; browser
animation still requires a separate acceptance gate.
