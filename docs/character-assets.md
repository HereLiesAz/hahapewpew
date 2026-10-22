# Character asset contract — original artwork

The project remains an autonomous web-based 3D fishbowl. GTA-like realism is a quality target for sculpt, surface detail, animation and credible scale, **not** permission to redesign the owner's characters.

## Eyes and acting

- **Qwerty:** Two identical flat, featureless white emissive 2-D eye graphics attached to the **upper trapezoid's front surface**. No spheres, eyeball volume, pupils, rotating eyes, or baked reflections. During kill mode the *same two surfaces* glow red. Two independent **2-D dark eyelid overlays**, parented to the upper shell, provide expression; eyelids move, eyes do not. The horizontal split is a real hinge: the top of the trapezoid flaps upward in uneven speech beats; the bottom remains attached to the neck. Eyelids and eyes follow the flapping top.
- **Shift:** Two immobile featureless flat white emissive 2-D eye graphics, conformed to the curved front of the dome. No protruding eye meshes, pupils, tracking, blinking, independent motion or eyelids. They follow the head only because they are mapped to its surface.
- **Tab:** Reference cardboard box, printed face, folded flaps, dress and bear, not a conventional animated human face under the box.

## Files and verification

- `public/assets/characters/Qwerty_Rigged.glb` is a **candidate** self-contained glTF 2.0 actor with a UV-mapped mechanical body, 19 named bones, separate eyelid joints, white emissive eye material, and idle/walk/talk/eyelid animation clips.
- `public/world3d.js` asynchronously loads the GLB, retains the prior actor as a fallback if loading fails, blends animation clips, and switches eyes to red during active attack frames. For inspection, `#world[data-qwerty-model]` reads `legacy` until loading succeeds and `glb` afterward.
- `public/character-models.js` gives the legacy Shift rig UV-mapped curved 2D eye decals, while a separately sculpted final Shift asset is still pending.
- `tests/qwerty-asset.test.mjs` and `tests/shift-eyes.test.mjs` enforce the binary asset and the eye-specific geometry contract.

**This pass is not approval of full visual fidelity.** The realistic sculpt/rig quality gate requires front, side, three-quarter, and full-body browser renders, plus movement/eyelid tests. Tab, Shift, adult NPCs, environmental animation and New Orleans fidelity remain unfinished.
