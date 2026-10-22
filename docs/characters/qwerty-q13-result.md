# Q1.3 — Qwerty's fixed base and rear hinge (candidate)

This is one atomic continuation of Q1.2. The Q1.2 silhouette is unchanged.

## Exact change

The Q1.2 GLB contained **two dark underside triangles weighted to `skull_upper`**, overlapping the existing `base_plate` top. This produced a second moving bottom surface. The Q1.3 generator removes those two moving triangles **only**. The thin original surface, weighted entirely to `base_plate`, stays on the body, while the complete front trapezoid, side walls, both white 2D eyes and the 2D eyelids remain attached to `skull_upper`.

The `skull_upper` pivot was already positioned at the back edge of the bottom plate; Q1.3 **retains** that pivot, all 19 bones, the bind matrices, original UVs and all four animation clips. The supplied `Qwerty_Talk_Flap` opens it by rotating the full eye-bearing housing, not a lower jaw. There is no mouth, tongue, teeth or face split.

## Files

- `scripts/qwerty_head_hinge.py` takes `workbench/qwerty/Qwerty_Q12.glb` and emits `workbench/qwerty/Qwerty_Q13.glb`. The script asserts exactly two moving underside triangles existed and that the stationary top plate remains.
- `tests/validate_qwerty_hinge.py` compares the Q1.2/Q1.3 assets, including node/skin/animation integrity and hinge kinematics.
- `scripts/render_qwerty_hinge.py` renders actual Q1.3 GLB triangles through VTK with the named skull joint rotated to three sample poses.
- `docs/evidence/qwerty-q13-hinge.png` shows the closed, partly open and fully open GLB in three-quarter and profile views.

## Verification performed

```
python3 scripts/qwerty_head_hinge.py workbench/qwerty/Qwerty_Q12.glb workbench/qwerty/Qwerty_Q13.glb
python3 tests/validate_qwerty_hinge.py workbench/qwerty/Qwerty_Q12.glb workbench/qwerty/Qwerty_Q13.glb
python3 scripts/render_qwerty_hinge.py workbench/qwerty/Qwerty_Q13.glb docs/evidence/q13-poses
```

The offline visual inspection shows the fixed plate horizontal in all poses and the upper trapezoid moving away from it. Front outline and eye placement are unchanged from Q1.2. In game the live character is **not** replaced; later work Q1.4–Q1.8 still covers limbs, face modes, animations/cel shading, runtime integration and actual browser validation. This is **not** a claim of completed live-site visual QA.