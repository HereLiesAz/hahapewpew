# Q1.4 — Qwerty small cylindrical body and compact extremities

Reference inspected: artist's original Qwerty composition and eight 3DAI Studio
Neural4D screenshots (received as a ZIP). Screenshots show useful side and
overall-trio proportions; they are not a substitute for the original designs,
and the generated model's more squared-off head is intentionally not copied.

This deliverable keeps the Q1.4 head-centering correction from commit
`daabab19`: the large head footprint is centered directly above Qwerty's
small cylindrical torso in BOTH horizontal dimensions. The very short neck
is untouched (its vertical mesh extent is under 0.1 model units).

- Arms: each elbow and wrist joint moves inward/up. Wrists are raised by
  0.07 model units and the mechanical clamps expand 1.63x around each new
  wrist center. Their joint pivots, skeleton/IBMs and movement clips stay
  valid.
- Legs: knees and ankles rise slightly to shorten exposed rods; shin
  geometry tapers down to the shoe connection. The planted soles broaden
  1.36x in width and 1.46x in depth, with their lowest points at ground Y=0.
- Unchanged: enormous wide/deep trapezoid, flat white eyes, 2D eyelids,
  stationary thin bottom plate, vertical bouncing head, no mouth.
- No cosmetic texture or invented torso armor is added.

**Candidate asset:** `workbench/qwerty/Qwerty_Q14_compact.glb`. Not
connected to the live game yet; actual runtime swap and WebGL behavior
are separately gated by Q1.8.

**Rebuild:** `python3 scripts/qwerty_compact_limbs.py
workbench/qwerty/Qwerty_Q14_centered.glb
workbench/qwerty/Qwerty_Q14_compact.glb`.

**Verify:** `python3 -m unittest discover -s tests
-p 'test_qwerty_compact_limbs.py'`. The previous/updated geometry was
also inspected in front and three-quarter offline renders. This
does **not** constitute finished game-browser visual validation.
