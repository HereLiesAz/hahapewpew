# Shift — source-art fidelity contract (S2.1)

**Status:** measured from the owner-derived art crop, not approved as a finished mesh. This completes reference documentation only, not any model or runtime alteration.

## Design authority and source

The owner's original `tabshiftqwerty.jpg` drawing shows Shift in the middle of the trio. The existing [Shift source crop](../../public/assets/art/shift.webp) retains its silhouette and features and is the reproducible in-repository visual evidence. It is a 378 × 422 pixel WebP image (confirmed directly from the VP8X header). The [labeled reference trace](../evidence/shift-s21-reference-trace.svg) embeds those exact source pixels with approximate overlays. Unlike a mesh preview, this trace doesn't reinterpret Shift's design.

Prior `Shift_Rigged.glb`, `shift.glb`, `build_reference_shift.py`, and the procedural character renderer are **candidates**, never an alternative design authority. The crop supplies a front/three-quarter drawing; it does not specify hidden mechanics or exact side/profile depth.

## Measured front-crop landmarks

All coordinates are approximate visual bounds in the **378 × 422** crop, measured from the top-left, with x increasing right and y increasing downward. Outline thickness and the background make these guides, not millimeter-accurate segmentation.

| Feature | Approximate x, y, width, height | Reading |
| --- | --- | --- |
| Graphite dome and black outer contour | 4, 2, 370, 224 | Enormous, wide, low half-dome; gray head inside a thick continuous dark perimeter |
| Small torso | 96, 237, 121, 111 | Little dark-gray block; outlined square inset on front |
| Left flat white eye and dark printed rim | 105, 137, 95, 62 | Angular graphic slopes downward toward the center |
| Right flat white eye and dark printed rim | 245, 134, 98, 63 | Oppositely slanted angular graphic |
| Short arms with hook-shaped clamps | x≈49–238, y≈239–329 | Fine black limbs below head, hands much smaller than dome |
| Short legs and wide wedge feet | x≈94–216, y≈342–390 | Distinct foot wedges, little vertical leg length |

**Reference ratios, recomputed from those approximations:** head/torso width ≈ 370/121 = **3.06**; head/torso height ≈ 224/111 = **2.02**; head/whole standing height ≈ 224/(390−2) = **0.577** (58%). Do not translate pixel bounds directly into world units. The disproportionately oversized dome, not a conventional humanoid head/body ratio, is the primary visual invariant.

## Required reconstruction properties

1. **Dome:** smooth graphite-gray low hemisphere-like housing, a wide dark rim/contour, dramatically larger than the torso. The back and sides remain gray, not an all-black cap; do not turn it into a sphere perched on a block. Profile/depth must be verified separately because this crop cannot measure them.
2. **Eyes:** two immobile, flat white angled quadrilateral graphics set LOW on the front curvature, with thick **fixed black borders**. Conform them to the dome; no pupils, eye sockets, spheres, moving gaze, eyelids, independent blinking, specular lenses or eyebrows. The eye graphics follow only their head.
3. **Torso:** tiny roughly rectangular steel-gray body with one inset square on its front. Keep the torso visibly subordinate to the dome; don't enlarge it for a complicated mechanical assembly.
4. **Limbs:** thin, short black arms with simple hooked clamps; abbreviated legs with dark flattened wedge feet. Don't graft on armored gauntlets or human fingers.
5. **Styling:** Qwerty and Shift take four-band cel shading on opaque materials, and the two white eye graphics remain unshaded. Readability must survive the actual game camera distance.
6. **Weapon:** no minigun is shown externally in this idle artwork. The later S2.5 concealed-gun mechanism must have a completely stowed idle silhouette; the reference does **not** authorize any particular internal design.

**Reject:** a shiny glass visor, tall robot helmet, raised eyeballs, moving eyelids, mouth, teeth, exposed gun at rest, enlarged arms/torso, long legs, extraneous seams/pistons/bolts, or surface weathering that conceals incorrect proportions. No new facial-expression mechanisms.

## S2.1 verification and handoff

Inspected the source crop and traced labeled landmarks from it. Verified the source image's dimensions and retained the original bytes untouched. The ratio arithmetic uses the traced rectangles, not the asset generator's implementation values. No runtime code, GLB, shader, or public website is changed by this sub-step; therefore **no rendered model approval** is implied.

**S2.2 next:** produce candidate front/side orthographic renders compared to this front trace, and explicitly label side-depth assumptions rather than falsely passing unseen geometry. Don't touch the eye-control mechanism until S2.3 or the minigun until S2.5.
