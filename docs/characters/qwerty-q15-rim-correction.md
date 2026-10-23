# Q1.5 correction: thick black eye outlines are the eyelids

The owner's four new close-ups supersede our earlier interpretation. **Both white eyes
must be visibly larger. The heavy black rings around them are their actual 2D
eyelids.** There are NO eyebrow bars, small floating black lids, 3D eyeballs,
pupils or sockets.

Rebuilt candidate: `workbench/qwerty/Qwerty_Q15_rim_eyelids.glb` sourced
from `Qwerty_Q15_eyes.glb`.

- Two equal **white emissive** circles, flat at z=.321, with radius **.325**.
  The prior smaller sizes (.236 and .194) were wrong; 3D perspective can
  provide apparent left/right difference without unequal modeled circles.
- Two surrounding **black** flat circles, radius **.418**, behind white at
  z=.315, giving each a **.093** thick border that reads as the eyelid rim.
- Each corresponding black cap is an *upper semicircle* from that same eye
  silhouette, using the exact same ink-black material. In the neutral
  rest pose it is behind the head surface and therefore not an eyebrow.
  Its own named eyelid bone slides the cap down/forward over the top white
  half. This leaves the clean black horizontal closing edge shown in the
  owner's half-lidded illustration.
- Existing `Qwerty_Left_Lid`, `Qwerty_Right_Lid`, and
  `Qwerty_Suspicious_Lids` clips remain independently addressable.
- White ↔ red kill-mode remains a runtime color override on the *same*
  emissive white discs; never create another eye mesh for kill mode.
- Head, bottom plate, vertical head bounce, compact legs/feet/clamps,
  skeleton, UVs and walk/talk animation data remain unchanged.

Rebuild:
`python3 scripts/qwerty_eye_rims.py workbench/qwerty/Qwerty_Q15_eyes.glb workbench/qwerty/Qwerty_Q15_rim_eyelids.glb`

Tests:
`python3 -m unittest discover -s tests -p 'test_qwerty_eye_rims.py' -v`.

The earlier Q1.5 eye-size/lid-bar design is **superseded**. This is one
corrective Q1.5 commit and does not advance the remaining backlog count.
The GLB remains a **candidate**, not a replacement for the live site.
Rendered geometry preview and glTF/browser acceptance must be kept distinct.
