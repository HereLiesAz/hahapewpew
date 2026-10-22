# Qwerty — original-art fidelity contract (Q1.1)

**Status:** reference requirements transcribed and checked against the user's original image; **no model approved and no owner sign-off inferred.** This sub-step freezes *requirements*; the following sub-steps implement and render the geometry.

## Reference provenance

- Primary: the owner's original full composition `tabshiftqwerty.jpg` (1290 × 1000 source image supplied in this conversation). Qwerty stands on the **right** beside the dome-headed Shift and box-headed Tab.
- Close-up used to inspect small features: `reference_crop.png`, cropped from that original, not a newly invented design.
- Follow-up requirements from the owner override ambiguous pixels. In particular, Qwerty's head flap, cylinder body and cel shader are explicitly specified.
- Existing `public/assets/characters/Qwerty_Rigged.glb` and `public/assets/models/qwerty.glb` are *candidates*, **not** fidelity references; older procedural work had inaccurate face, proportions and surface detail.
- Repo's `public/assets/art/qwerty.webp` may assist orientation, but the original composition and later user corrections govern conflicting geometry.

## Non-negotiable shape / proportion checks

| Part | Owner's design: MUST | Reject |
| --- | --- | --- |
| Head | Huge, shallow, trapezoidal dark-gray housing with a black outline and a visible narrower side plane; flared upper edge; front face uninterrupted at rest | Squared-off box, heavy bevels, eyebrows, vent grille, facial seam, long neck |
| Speaking mechanism | **Only the thin bottom surface** remains on the body. The entire upper trapezoid (with both eyes and 2D lids) hinges/lifts up and drops closed in exaggerated uneven South Park Canadian-style beats | Movable *lower jaw*, separate mouth, cut through front face, interior teeth/tongue |
| Eyes | Two flat, featureless luminous **white** circular decals on the trapezoid front, placed substantially lower than rejected iterations; thick dark outlines. Same surfaces turn luminous **red in kill mode** | Spherical eyeballs, recessed lenses, pupils, reflected iris, moving gaze, high-mounted eyes |
| Eyelids | 2D overlays over the eyes, independently controllable for Qwerty's emotions; not visible in neutral original pose | Bulbous modeled brows, 3D eyelid volumes, moving whites |
| Neck | An *extremely short* narrow black connection immediately beneath stationary bottom plate | Visible tall column, neck rings, mechanical assembly |
| Torso | Very small **cylindrical** charcoal/dark-gray body with an inset front rectangular panel approximating the drawing | Square toy block, bulky armored chest, torso wider than design |
| Arms | Two very short thin dark limbs emerging low from torso, ending in visibly substantial hooked **clamps** | Long robotic arms, hand mittens, human fingers, microscopic grips |
| Legs / feet | Very short thin dark legs below cylindrical torso; relatively large flattened dark feet | Tall stilts, complex knee armor, tiny pointed boots |
| Finish | Graphic **cel shading** for Qwerty and Shift; preserve hard silhouette/outlines and flat unlit eye whites/reds | PBR wear disguising wrong forms, realistic lenses, cosmetic detailing unsupported by source |

## Frame-by-frame visual acceptance guide

1. **Front neutral:** head covers the dominant visual area; two outlined white circles sit low on the uninterrupted trapezoid. No visible mouth or upper/lower face seam.
2. **Left three-quarter:** left side of housing reads as a shallow separate plane, not a thin billboard; face retains trapezoidal edges and low flat eyes.
3. **Full body neutral:** the cylinder is small compared with the head. Neck is barely present. Clamp span/foot silhouette are conspicuous despite shortened limbs.
4. **Talking:** bottom is stationary atop tiny neck and cylinder; entire eye-bearing trapezoid lifts, leaving a gap **between bottom plate and housing**. No mouth graphic appears.
5. **Kill mode / lids:** eyes switch only white ↔ red; separate 2D eyelid graphics can cover portions of each eye without detaching or distorting their circular base.
6. **Cel-shaded lighting:** hard discrete body bands; eye whites remain uniform, and outlines/side-plane visibility hold in outdoor sun and shade.
7. **Game distance:** exact features still read from standard spectator follow camera, not just an enlarged turntable.

## Source-to-geometry comparison notes

- The original picture shows Qwerty's head spanning **multiple torso widths**. More machinery or higher polygon count must not change that ratio.
- Perspective and composition make pixel-perfect 3D scale extraction unreliable; the artist's verbal corrections are controlling when approximate drawing measurements conflict.
- The source drawing shows a still, closed head. The speaking motion is specified in conversation and must be evaluated in additional opened poses without altering the closed silhouette.
- This document deliberately **does not invent hidden back panels, bolts, mouth parts, or complicated mechanical fingers**.

## Q1.1 completion evidence

Reference inspected directly and requirements transcribed from both the original drawing and subsequent owner corrections. Checklist covers shape, moving/stationary pieces, low flat eyes, two-dimensional lids, cylindrical body, tiny neck, short limbs, clamps/feet and cel shading. Next step **Q1.2** is geometric reconstruction and orthographic silhouette comparison; it is not considered complete here.
