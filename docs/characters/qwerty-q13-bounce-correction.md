# Q1.3 correction — a thick floating shell, not a hinged jaw

The owner's two new reference images supersede the interpretation in the initial Q1.2/Q1.3 candidate. **The trapezoidal upper housing has substantial depth** (rear surface now at z = -1.25; front at +0.30; total depth 1.55 rather than 0.60). Both the movable shell and **stationary bottom plate** extend to the deeper rear face.

**Speech mechanism:** the **entire upper housing lifts straight upward and falls back down** in irregular beats. This is a translation-only track on `skull_upper`; no pitched hinge, mouth, lower jaw, horizontal cut across the face or eye movement. The bottom plate and almost nonexistent neck remain fixed. Flat white eyes and their 2D eyelids ride along with the lifting shell. Idle head rocking was neutralized to keep the closed seal intact.

Candidate only: `workbench/qwerty/Qwerty_Q13_depth_bounce.glb`; the public live character is unchanged. Generator: `scripts/qwerty_depth_bounce.py`; validation: `python3 -m unittest discover -s tests -p 'test_qwerty_depth_bounce.py'`. A front/three-quarter/side matrix of closed, midway and fully lifted poses was rendered and visually inspected against the owner's two images, but this **is not a live-site WebGL approval**. Q1.4 remains the next unchecked task.

The earlier `Qwerty_Q13.glb` with pitched rotation remains in history for provenance but **must not be used as the speaking animation**.
