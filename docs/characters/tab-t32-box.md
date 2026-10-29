# T3.2 — hollow cardboard correction

The production `public/assets/characters/Tab_Reference.glb` previously used a solid
cuboid under its printed surfaces and had three opening flaps. The generator now
uses five closed slabs, each 0.008 model units thick, leaving the lower opening
clear. The front, side and top outside dimensions remain unchanged. The existing
front flap is retained; left and rear flaps gain edge faces and a fourth thin flap
opens on the right. All four are rigidly weighted to the existing head bone.

This is a topology correction, not final artistic acceptance of T3.2. The current
front width/height, flap angles and hand-painted expression still need fidelity
review against `public/assets/art/tab.webp`; the unseen fourth flap is a box
construction inference, not a measurement extracted from that drawing. The source
shows the asymmetric printed eyes, eyebrow strokes, teeth bars and upside-down
side shipping print. Their existing embedded PNG bytes are preserved here.

## Preservation and regression evidence

`tests/test_tab_box_t32.py` intersects the actual exported shell with a vertical
ray through the cavity: it reaches the two roof faces, with no bottom face.
It checks inner/outer wall surfaces, four independently closed flap slabs and
reproduction of every exported vertex attribute. SHA-256 gates retain the
pre-correction dress, skin, shoes and teddy attribute bytes; rig, animation and
material metadata and the two printed PNGs are also locked to their original
hashes. This is a targeted structural regression, not an external glTF validator.

No robot asset or character root scale changed. Tab stays at the provisional
0.66 root; Qwerty remains 0.27 and Shift 0.46. The unresolved intended
cross-character scale is recorded in `tab-t31-result.md`.

## Production browser evidence

The existing production Chromium harness loads the real game asset path and now
captures 1600×1000 `tab-box-front.png`, `tab-box-side.png`,
`tab-box-threequarter.png` and `tab-box-fold.png`, alongside the full Tab and
common-camera trio images. Cameras frame actual rendered material vertices, not
an assumed head size. The fold camera stays close enough to remain above the
road. The body stays visible; it is not removed to manufacture a clear cavity.
The ray regression supplies the unoccluded opening check.

Local validation: 92 Node tests and 55 Python tests passed. Final production
Chromium results are recorded in `results.json` in the workflow artifact; inspect
the workflow result before treating those browser gates as passed. Final shape,
cardboard appearance and print fidelity remain open; T3.2 is not checked off.
