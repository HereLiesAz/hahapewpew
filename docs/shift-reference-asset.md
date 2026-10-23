# Shift — original-art reference GLB

Candidate asset on `feature/shift-reference-rig`, intentionally **not** auto-merged to main.

Shift's original reference is `tabshiftqwerty.jpg`: a disproportionately wide, low-edged graphite dome, two angular white eye graphics set low on that dome, a tiny rectangular body with a square inset, short black stick limbs, tiny clamps and wedge feet. No pupils, sockets, eyelids, blinking, moving eyes, teeth, mouth or facial expression rig.

`scripts/build_reference_shift.py` deterministically exports a self-contained UV-mapped glTF 2.0 asset with 16 named bones and Shift_Walk, Shift_Idle, Shift_Talk animation clips. Eyes are fixed white emissive decals skinned to the HEAD BONE; only the entire head may tilt. No texture image maps; the game applies cel shading to opaque surfaces.

The runtime loads the GLB asynchronously and keeps the existing geometry as fallback until the file and required bones/clips are present. Shift's existing gun follows the right-arm bone after the swap. Review render: locally inspected front, three-quarter and profile from VTK before staging.

Quality gate before merge: inspect rendered frame and movement in a Chromium browser, verify both eyes remain in contact with the dome at each camera angle, and confirm gun firing still works. Node tests alone are insufficient.
