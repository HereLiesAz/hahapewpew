# T3.5 — Tab skin weights, deformation and UVs

Source geometry: `scripts/build_reference_tab.py`. Production export: `public/assets/characters/Tab_Reference.glb`.

The previous export had a valid 20-bone hierarchy and UV channels but assigned all mesh vertices to a single rigid joint. T3.5 adds falloff-weighted two-bone skinning at shoulder, elbow, wrist, hip, knee and ankle transitions; the bodice eases from chest to spine and the damaged skirt uses bounded spine/left-hip/right-hip weights. Cardboard, face and lettering stay fully bound to `head`, rounded flats to the ankle joints, and the bear remains fully on its own `bear` bone attached under the hand. The hand holding the ear stays rigid and its geometry does not change.

No change to box prints, child proportions, torn cloth topology, original UV coordinates, deterministic grime textures, bone rest transforms or existing three animation tracks. Independent regression verifies weights, inverse binds, textured UV limits, articulation and live GLTFLoader deformations, plus a return-to-rest capture.

The T3.5 acceptance box stays open until the freshly regenerated GLB passes all Python/Node/Chromium checks and the actual screenshots are inspected. T3.6 movement and T3.7 overall game fidelity are different tasks.
