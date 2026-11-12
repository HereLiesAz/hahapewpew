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


## Victoria lower-calf / false-ankle repair (PR #55)

**Source-level defect:** `scripts/assemble_victoria_tab.py` previously classified the source `DEF-shin.L.001` and `DEF-shin.R.001` *lower-shin skin* as Tab's `ankle` joints. Only `DEF-foot` and `DEF-toe` belong to the ankle. This made the ankle deform the lower half of each calf while the visible shoe still met the ground, creating a false high ankle / digitigrade silhouette. Gait tuning and contact-IK tests could not detect this weight-mapping error.

The Victoria source's two shin deformation sections now both map to their corresponding `knee` joint; actual foot and toe deformation stays on the corresponding `ankle`. The same source transfer explicitly aligns the original thigh and shin rest axes to Tab's real hip, knee and low ankle pivots using the official model's inverse-bind skeleton matrices. The dirty/torn dress, box printing, bear, shoes, original fallback and skeleton node count remain unchanged.

Independent inspection of the source-rebuilt, still-unmerged GLB found these *per-leg* geometric ranges in rig units:

| Dominant skin influence | Before correction | Corrected candidate |
| --- | --- | --- |
| Ankle: maximum vertex height | approx. 0.391 | approx. 0.167 |
| Knee: lowest shin vertex height | approx. 0.468 | approx. 0.137 |
| Anatomical ankle bind height | 0.145 | 0.145 |

These are decoded geometry observations, not art-derived scale targets. `tests/test_tab_victoria_integration.py` now rejects any ankle-controlled body vertex above the independently defined low-foot band and requires the knee-controlled shin to reach down to the real ankle. `scripts/robot_proportions_browser_qa.mjs` verifies the same bone/skin boundary in the actually loaded production GLB, alongside full motion and side renders.

**Acceptance pending:** the final branch-head Chromium WebGL captures must be visually inspected, automated GLB tests must pass against the committed *new binary*, and PR review findings resolved. The pre-fix screenshots and old T3.6 contact-only results do **not** prove the lower-leg anatomy was correct.
