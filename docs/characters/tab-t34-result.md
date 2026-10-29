# T3.4 — asymmetrical cloth and ear-held teddy

Design authority: `public/assets/art/tab.webp`, `docs/characters/tab-t31-result.md`.
The skirt keeps a narrow waist but now has fuller nonuniform pleats,
a raised left hem, a lower right hem and independent longitudinal fabric
fold panels. The source image, sleeve geometry and face mask are unchanged.

The teddy's *left ear* is moved back into contact with the existing right-hand
fingers; the sewn cloth and limbs hang freely. Its materials gain minimal
stitched shadow seams. The teddy remains skinned to `bear` under `hand.R`
so the existing swing clip continues to animate the grip; no separate prop
or floating accessory has been introduced.

Regression: `tests/test_tab_dress_teddy_t34.py` checks the exported
hem silhouette, separate fold mesh, ear-to-hand proximity, lower hanging
body, rig, textures and all animation clips. The production browser QA
captures `tab-dress-front`, `tab-dress-side`, `tab-bear-grip`.
Approval requires the current GLB, passing tests and inspected game captures.

The T3.2 hash gates for dress and bear were intentionally retired because
their old byte-for-byte constraints conflicted with these two requested
production steps. Its hollow box topology, head-joint bounds, printed image
hashes and source-regeneration checks remain active.

The original T3.2 composite GLB-metadata SHA included a skin accessor *index*, which legitimately moved when the teddy gained a previously unused material primitive. The test now checks the stable 20-joint hierarchy, bone names and three clips directly; print-image byte hashes remain enforced.


## Owner correction — dirt and damage, not fashion asymmetry

The dress in the original illustration is **dirty and torn**, with a worn, irregular hem. The previous cleaner high-low skirt was an inaccurate interpretation. The generator now bakes reproducible earth/soot smears, fading and abrasions into three independently UV-mapped cloth materials. Irregular ragged hem notches, two actual openings formed by removing mesh triangles and frayed threads are geometry, not painted tears. Cloth folds share the damaged profile rather than floating over it. The 20-joint skeleton, original cardboard images/printing, existing animations and anatomy remain unchanged. The teddy now slumps outward about its original ear grip; its eye ink lies flat.

Tests verify missing triangles and fray geometry, stains in exported embedded textures, unchanged face/side texture bytes, bone and clip stability, and ear-to-hand proximity. The GLB must be regenerated and real production browser captures examined. Source reference remains the owner-provided image, not fabricated back views or aesthetic approval.

### Regeneration and visual gates

The source-of-truth generator exports `public/assets/characters/Tab_Reference.glb` with `Dress_Main`, `Dress_Dark` and `Dress_Light` embedded dirt textures, a separate `Dress_Dirt` fray material, and the original two cardboard prints unchanged. PR CI must execute against the regenerated GLB commit rather than the preceding generator-only commit; comparing source and stale binary is not a valid test result. The actual scene captures (front, side, hem, grip and walk) remain the acceptance evidence. Absent a verified cold GLEE pass, do not represent its review as completed.


## T3.4 verification — 2026-10-29

The regenerated `Tab_Reference.glb` on PR #37 passed Node and Python regression suites and production Chromium [workflow 40941489489](https://github.com/HereLiesAz/hahapewpew/actions/runs/40941489489), including the same-scene animation/fallback and reference-trio captures. Persistent run evidence was uploaded as artifact [12927009046](https://github.com/HereLiesAz/hahapewpew/actions/runs/40941489489/artifacts/12927009046) (`shift-s27-browser-evidence`). The captures inspected were `robot-proportions/tab-dress-front.png`, `tab-dress-side.png`, `tab-bear-grip.png` and `production-trio-reference.png`.

Front and side captures show mottled grime, genuine gaps, frayed threads, jagged torn hem and retained drape. The teddy is attached at its left ear and hangs outward; the original face and shipping text are unchanged. This closes the **T3.4 reference-driven dress/teddy correction**, not the open T3.1 cross-character scale, T3.2 mask fidelity, T3.5 skin/UV deformation, T3.6 acting or T3.7 broader browser-fidelity acceptance. The source does not depict the rear view, so no unseen backside matches are claimed. No separate cold GLEE run was available; this record must not be misrepresented as one.
