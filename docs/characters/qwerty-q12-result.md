# Q1.2 — Qwerty outer-head geometry (candidate; NOT deployed)

**Original reference:** `tabshiftqwerty.jpg` provided by the owner. This sub-step addresses the geometry of the **single uninterrupted upper trapezoid**, not Qwerty's stationary bottom plate mechanism (Q1.3), body proportions (Q1.4), final eye/lid expressive behavior (Q1.5), or runtime integration (Q1.8).

## Geometry revisions

- Kept the existing 19-bone skinned skeleton and four clips in the source candidate.
- Reduced upper-head height from **1.64 m to 1.46 m** while retaining maximum width **2.52 m**, so the full front silhouette has width:height **1.726** instead of **1.537**. The original artwork's outer head silhouette is approximately **1.78** (estimated from the drawing, not surveyed).
- Preserved its top-wider-than-bottom form (top half-width 1.26 m, bottom half-width 1.07 m).
- Rebuilt the face as **one 4-corner surface**. No mouth, central face seam, jaw, lip or extra vents.
- Preserved a **0.60 m** body for the enclosure's side depth with dark sides and black perimeter ink; kept the black eye outlines that were mistakenly removed in the first offline revision.
- Left the stationary bottom plate and all non-head meshes, bones and animation clips untouched. The revised model is a workbench candidate, not a public character swap.

## Evidence and reproducibility

- `workbench/qwerty/Qwerty_Q12.glb`: self-contained Q1.2 **candidate** binary, deliberately not used by the live game.
- `docs/evidence/qwerty-q12-silhouettes.png`: actual offline geometry renders: previous front, revised front, revised three-quarter, revised profile. The artwork was also inspected directly; the evidence figure does not claim to be a screenshot from the live website.
- `scripts/qwerty_head_geometry.py`: deterministic generator accepting two arguments: path to current `public/assets/characters/Qwerty_Rigged.glb` and desired output.
- `tests/validate_qwerty_head_geometry.py`: checks uninterrupted front, aspect ratio, shell thickness, lower white eyes, skeleton, clip preservation, triangle indices and skin weights.
- `scripts/render_qwerty_head.py`: reproduces the four-view image using VTK and Pillow.

### Verified commands (run in a repository checkout)

```sh
python3 scripts/qwerty_head_geometry.py public/assets/characters/Qwerty_Rigged.glb workbench/qwerty/Qwerty_Q12.glb
python3 tests/validate_qwerty_head_geometry.py
python3 scripts/render_qwerty_head.py
```

Dependencies: `numpy` for build/test, plus `vtk` and `Pillow` to render. The generated asset loaded successfully with `trimesh` and passed the scripted structural checks. Q1.3 is next: the stationary *bottom surface* and rear pivot must be checked throughout Qwerty's flap cycle.

**Do not declare visual final approval or GTA-grade quality from these renders.** This is the narrow Q1.2 silhouette gate only.
