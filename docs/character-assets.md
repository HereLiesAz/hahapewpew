# Character asset contract — original artwork

The project remains an autonomous web-based 3D fishbowl. GTA-like realism is a quality target for sculpt, surface detail, animation and credible scale, **not** permission to redesign the owner's characters.

## Eyes and acting

- **Qwerty:** Two identical flat, featureless white emissive 2-D eye graphics attached to the **single uninterrupted trapezoid front surface**, set below its midpoint. No spheres, eyeball volume, pupils, rotating eyes, or baked reflections. During kill mode the *same two surfaces* glow red. Two independent **2-D dark eyelid overlays**, parented to the upper shell, provide expression; eyelids move, eyes do not. There is **no mouth, chin, jaw, or horizontal facial split**: the entire trapezoid shell lifts at a rear hinge in uneven speech beats, while only its thin bottom surface remains attached to the body. Eyelids and eyes follow the flapping top.
- **Shift:** Two immobile featureless flat white emissive 2-D eye graphics, conformed to the curved front of the dome. No protruding eye meshes, pupils, tracking, blinking, independent motion or eyelids. They follow the head only because they are mapped to its surface.
- **Tab:** Reference cardboard box, printed face, folded flaps, dress and bear, not a conventional animated human face under the box.

## Files and verification

- `public/assets/characters/Qwerty_Rigged.glb` is a **candidate** self-contained glTF 2.0 actor with a reference-proportioned cylindrical body and compact black limbs, 19 named bones, separate eyelid joints, white emissive eye material, and idle/walk/talk/eyelid animation clips. The model uses flat graphic colors; surface textures and weathered-metal effects are intentionally absent.
- `public/cel-robots.js` gives **both Qwerty and Shift** four-band cel shading on their opaque body/head surfaces, while their two-dimensional white eyes stay unshaded and Qwerty's eyes turn red in kill mode. Tab and adult humans are not cel-shaded.
- `public/world3d.js` asynchronously loads the GLB, retains the prior actor as a fallback if loading fails, blends animation clips, and switches eyes to red during active attack frames. For inspection, `#world[data-qwerty-model]` reads `legacy` until loading succeeds and `glb` afterward.
- `public/character-models.js` gives the legacy Shift rig UV-mapped curved 2D eye decals, while a separately sculpted final Shift asset is still pending.
- `tests/qwerty-asset.test.mjs` and `tests/shift-eyes.test.mjs` enforce the binary asset and the eye-specific geometry contract.

**This pass is not approval of full visual fidelity.** The final reference-fidelity gate requires front, side, three-quarter, and full-body browser renders, plus movement/eyelid tests. Tab, Shift, adult NPCs, environmental animation and New Orleans fidelity remain unfinished.
