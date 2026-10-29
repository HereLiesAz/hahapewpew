# T3.3 — Tab child anatomy
Source: `public/assets/art/tab.webp` and `docs/characters/tab-t31-result.md`.
The small child, not a miniature adult, has narrow rounded shoulders under the sleeves,
separately skinned elbow-to-wrist tapers, distinct thumbs/finger arcs, subtler kneecaps,
bare calf transitions, and low rounded flats. The original 20 joints, animation channels,
cardboard image data and all dress/bear meshes remain unchanged. No extra face parts are added.

`scripts/build_reference_tab.py` is the source of the binary; CI regenerates the GLB.
`tests/test_tab_anatomy_t33.py` checks exported joint-attached mesh geometry.
The production Chromium QA script captures full front/side anatomy at game scale.
The check box should only be closed once this binary and images pass and are inspected.

T3.3 deliberately changes both shoe-strap triangles in the shared `Tab/Ink` material, so the obsolete T3.2 checksum of **non-head** ink is replaced by explicit ankle-joint strap tests. The box’s face/edge tests and original printed image hashes remain in force.
