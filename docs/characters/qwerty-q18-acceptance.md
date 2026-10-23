# Q1.8 — Qwerty in-game browser acceptance and GLB swap

**Commit scope:** integrate only the already validated `Qwerty_Q16_validated.glb` from the workbench into the shipped Three.js world, with its Q1.7 short-stride/speaking/eyelid/kill-mode controller. No unrelated characters or environment changes.

**Source:** `public/assets/characters/Qwerty_Q16_Validated.glb` is an exact copy of the standalone validated GLB. `world3d.js` calls `createQwertyMotionRig`, which checks for the skinned mesh, joint names, independent eyelid actions, eye material and action clips before hiding any fallback geometry. The existing procedural Qwerty stays visible if GLB loading fails. The previous `Qwerty_Rigged.glb` is retained for history, but no longer referenced by the Qwerty runtime loader.

## Actual Chromium acceptance — isolated branch before main integration

- Browser: headless Chromium / software WebGL, desktop 1280 × 800, against a locally served copy of the **actual game**, not the turntable preview. `#world[data-qwerty-model]` reported **`glb-q16`**. Both other cast GLBs also reported loaded, and the Qwerty eye material was `MeshBasicMaterial`.
- Six direct **WebGL canvas captures**: front, side, three-quarter, speaking, kill mode, and half-lidded eyes. [Comparison contact sheet](../evidence/qwerty-q18-in-game.jpg). The shots show the head and body at game scale within the city, not isolated mesh thumbnails.
- **Head motion:** closed skull Y = **0.055**; talking skull Y ≈ **0.610**; stationary base-plate Y = **0.300** in both cases. Speech lifts the entire upper head vertically, not a moving jaw.
- **Eye states:** neutral = **white**; kill mode = **#ff1616**, on the same two flat discs. The thick black eyelid rims visibly close over each white eye. Both independent lid tracks continue to work.
- **Movement:** exported walk clip becomes `Qwerty_Walk_ShortStride` without changing other bones. The three cast actors remain independent, and spectator orbit still works.
- **Fallback:** the browser intercepted/aborted `Qwerty_Q16_Validated.glb`, then `#world[data-qwerty-model]` remained **`legacy`**, with the page returning HTTP 200 rather than crashing.
- **Performance observation:** a captured frame counted approximately **31,678** rendered triangles on the desktop test scene. This is not a device-wide FPS guarantee.
- Browser capture note: built-in full-page screenshots timed out while the page was animating; the test used a direct synchronous `renderer.render` + WebGL canvas capture after pausing the game. This yielded six real rendered views and diagnostic properties with no page JavaScript errors. It is not a claim of a separately verified post-deployment live URL.

**Automated checks:** `node --check public/world3d.js` and **45 repository Node tests passed** on the staged revision. The former Qwerty asset test was updated to validate the new loader/controller and the 19-bone, six-animation public GLB, instead of string-matching the retired loader.

**Reproduce QA:** run `python3 -m http.server 8765 --directory public`, then visit `http://127.0.0.1:8765/?qwertyQA=front` and use `side`, `threequarter`, `talk`, `kill`, `lids` as alternate values. These query flags work **only** on localhost/127.0.0.1; no QA state is exposed on production hosts.

**Remaining boundaries:** production CDN deployment has not been independently confirmed. The adult NPCs and final New Orleans environmental fidelity remain later backlog items. The 2D source drawing remains the design authority.
