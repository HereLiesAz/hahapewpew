# Q1.6 — Qwerty validated GLB / bind-space correction

**Candidate asset:** `workbench/qwerty/Qwerty_Q16_validated.glb`. Input:
`workbench/qwerty/Qwerty_Q15_rim_eyelids.glb`.

Q1.4 shifted the head and bottom plate forward by 0.475 units to center
Qwerty's large trapezoid above his cylindrical body. The skin's inverse
bind matrices were left at the previous positions. Although the glTF
validator had **zero errors and zero warnings**, this was a real rig
integrity defect.

The Q1.6 generator `scripts/qwerty_rig_integrity.py` repairs all four
descendant inverse bind matrices (`base_plate`, `skull_upper`,
`eyelidL`, `eyelidR`) and adjusts **840 bound vertex coordinates**
by the compensating offset. Therefore all **19 inverse bind matrices**
now agree with the actual rest skeleton while the visible geometry in
the rest pose is mathematically unchanged. The head remains centered,
and its complete upper shell continues to bounce vertically during speech.

The 8 original material primitives, UV attributes, skin joints/weights,
flat glowing white eyes with thick black animated eyelid rings and red
kill-mode recoloring remain unchanged. All six clips and independent
eyelid tracks are retained.

## Actual validation

- Khronos `gltf-validator@2.0.0-dev.3.10` against this repaired
  standalone GLB: **0 errors, 0 warnings, 46 informational messages**.
  Informational items concern optional buffer-view target hints and
  unused UV coordinates in the deliberately untextured graphic.
- `python3 -m unittest discover -s tests -p
  'test_qwerty_rig_integrity.py' -v`: **4 passing**, including per-vertex
  unchanged rest-pose checks and normalized skin/UV/index verification.
- Repository `npm test`: **41 passing**.

To rebuild:
`python3 scripts/qwerty_rig_integrity.py
workbench/qwerty/Qwerty_Q15_rim_eyelids.glb
workbench/qwerty/Qwerty_Q16_validated.glb`.

**This completes Q1.6 asset structure, not Q1.7 cel/animation quality
or Q1.8 live-game/browser acceptance.** Qwerty remains on the workbench.
