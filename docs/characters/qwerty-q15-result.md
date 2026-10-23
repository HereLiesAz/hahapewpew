# Q1.5 — Qwerty 2D eyes and independently animated eyelids

Reference: owner's original `tabshiftqwerty.jpg`, especially the illustrated Qwerty close-up. The eyes are **flat circular white graphics**, no pupils, lenses, spheres or eyeballs. The camera-perspective eye on Qwerty's right is slightly smaller (82% of the left), and its thick black outline and corresponding 2D lid are scaled by the same factor. Both eye centers remain at Y=1.87, below the front midpoint.

The white disc surface remains at Z=0.321 (just outside the front head face). The existing white emissive material stays featureless. **Kill mode** is a runtime override to red on that *same* eye material; no separate red eyeballs or texture are introduced. Neither eye moves in its socket.

Original left and right eyelid bones remain distinct. Separate exported clips `Qwerty_Left_Lid` and `Qwerty_Right_Lid` now target only their corresponding bones, while the original two-lid suspicious-expression clip remains available. The neutral lids are hidden behind the head plane; activated lids move forward and down onto the eye surfaces. They are flat 2D geometry, not eyebrows or eyelid volumes.

Candidate: `workbench/qwerty/Qwerty_Q15_eyes.glb`. Rebuild with `python3 scripts/qwerty_eyes.py workbench/qwerty/Qwerty_Q14_compact.glb workbench/qwerty/Qwerty_Q15_eyes.glb`. Check with `python3 -m unittest discover -s tests -p 'test_qwerty_eyes.py' -v`.

**Visual check:** the developer reviewed four orthographic geometry-derived eye states (white, red, left squint, right squint). This does not substitute for the actual Three.js browser acceptance step Q1.8. Q1.5 is an isolated asset step; the live game still uses its current deployed model.
