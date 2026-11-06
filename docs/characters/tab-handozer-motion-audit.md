# Handozer animation audition for Tab

**Status: rejected for direct retargeting; original Tab animation remains unchanged.**

This is a structural assessment of the separately supplied `handozer.rar`, **not** the 21-clip TurboSquid girl animation package. No third-party model, textures or animation bytes are committed here, and the archive contains no accompanying redistribution license.

## Inspected source

The archive extracts to `handozer(after anim).fbx`, `handozer(after anim).dae`, `handozer(after anim).3ds`, and two PNG texture maps. The Collada export (`handozer(after anim).dae`) reports:

- One animated sequence rather than separately named walk/idle/pickup clips.
- 97 keyed times, from approximately 0.041667 through 47.08333 seconds.
- 443 animation matrix channels and 443 joint nodes, including a Blender-style control hierarchy (`ORG-`, `MCH-`, `DEF-`, IK/FK controls).
- **77 of 77 `DEF-` (deformation) joint matrix channels show no changing matrix values** across the sampled timeline. All 69 `ORG-` channels are likewise constant; 60 of all 443 matrix tracks move, chiefly rig controls and mechanism bones.

This is a critical retargeting gate. The exported Collada timeline moves controls, not the evaluated deform skeleton required by Tab's simpler glTF joints. An animation retargeter cannot safely treat these control matrices as final skinned-bone transforms; directly copying them could produce static limbs, misplaced feet and severe deformation. The FBX must be evaluated and its deformation-joint animation baked in a compatible 3D application before judging the actual motion. The exact FBX deformation-track behavior has not independently been verified here.

## Comparison with production Tab

Production uses `public/tab-motion.js` on the Victoria-based skinned Tab GLB, with named hip/knee/ankle, spine, arm and teddy joints, child-scale planted steps, and independent idle/turn acting. Its original dirty/torn dress, cardboard face and ear-held teddy must not change.

The Handozer rig contains potentially mappable humanoid joints (`hips`, `thigh.*`, `shin.*`, `foot.*`, `upper_arm.*`, `forearm.*`, `hand.*`), but naming overlap is **not** proof of compatible bind pose, deformation, clip segmentation, proportions or redistribution permission. A purported one-take motion collection is not a replacement for distinct verified child walk/idle clips.

## Required before any runtime integration

1. Obtain explicit animation reuse/redistribution rights and a source file whose evaluated deform bones are baked into each sampled frame.
2. Extract and visually audition each distinct movement from the single take; verify whether any child-appropriate idle or gesture really exists, rather than assuming the advertised girl pack is present.
3. Map local/rest orientations, scale and human knee/sole directions to Victoria's named joints. Keep Tab's right-hand teddy grip intact.
4. Independently test the **skinned shoe and knee geometry**, not just ankle/IK target position, in Chromium side views across complete cycles. Reject backward bending, floating heels, foot sliding and dress/hand clipping.

**Decision:** Do not install, retarget or ship Handozer's unbaked control-rig animation in HahaPewPew. Continue using the tested Victoria gait while awaiting an appropriately baked and licensed animation source.
