# HAHA PEW PEW — character assets

Three standalone glTF 2.0 model assets: `public/assets/models/tab.glb`, `shift.glb`, and `qwerty.glb`. Each contains a named hierarchical armature, inverse bind matrices, UV-mapped meshes, PBR albedo textures, and skin indices/weights. Tab has blended elbow and waist weights; the machines have rigid mechanical joints.

## Original reference and materials

Tab retains her printed cardboard face, layered dress, hands, shoes, and bear. Shift has a scratched dome, recessed visor, machined joints and multi-barrel weapon. Qwerty has a trapezoidal metal enclosure, lens housings, service vents and jointed limbs. Distressed cardboard, cloth, skin, metal, rubber and glass have distinct UV textures.

## Rebuild and audit

The deterministic editable source is `scripts/make_assets.py`. Run `python3 -m pip install numpy pillow`, then `python3 scripts/make_assets.py` and `python3 tests/validate_sculpt_assets.py`. The runtime uses `public/sculpt-loader.js` and preserves the previous meshes until all three assets load. The assets have been geometry-rendered offline and their weight totals and glTF structure checked.

## Fidelity boundary

**These are authored procedural surface meshes—not hand-sculpted, GTA-grade production assets.** They can be imported into Blender for further sculpting, topology refinement, normal/roughness baking and professional weight painting. Do not pass the offline model render off as live Three.js proof. Browser WebGL/animation and Cloudflare deployment need their own checks.

## Character/system invariants

Walking remains autonomous. Existing dialogue and spectator camera are untouched. The character replacement is all-or-nothing; three valid assets must decode before swapping the active rigs. No third-party runtime model hosting or authentication.
