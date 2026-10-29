# T3.1 — Tab original-art reference contract (child, box and bear)

**Status:** source contract reconciled with current production; T3.1 remains open for the intended cross-character scale. This is not model acceptance. The canonical [Tab image](../../public/assets/art/tab.webp) is **454 × 959 pixels** (WebP VP8X, source blob `1f08d4b80c3b74874f964403587d88f89d5b11d7`). The art crop is the design authority. See [annotated drawing](../evidence/tab-t31-reference.svg) and machine-readable [17-region trace](tab-t31-trace.json).

The bounding polygons are **approximate hand traces** (roughly ±5–15 source pixels for hairline contours and moving cloth folds). They are not a substitute for owner-approved side/rear designs, actual rig deformation inspection, or cross-character height calibration. This step records what the illustration shows; it does not invent missing views.

## Form and exact design language

| Part | Visible source bounds and relation | Non-negotiable form |
| --- | --- | --- |
| Box | Front face: polygon `(145,5) → (333,18) → (322,214) → (142,220)`; left printed side `(62,13) → (145,5) → (142,220) → (46,197)` | Hollow angular **cardboard box** obscures the entire child's head; not a rounded helmet, smooth cube, or a fleshy face |
| Flaps | Front quadrilateral `(142,217) → (320,213) → (366,268) → (165,276)`; left shoulder flap extends to y≈313 | Real thin cardboard panels folded **outwards**, with visible edges and thickness; preserve asymmetric angles |
| Face print | Larger ring eye x≈180–244, y≈55–124; smaller eye x≈254–307, y≈70–129 | Unequal, circular **printed** eyes with dark center dots; thick uneven eyebrows and gritted-tooth grid x≈178–297,y≈141–198. **No moving eyeballs or conventional mouth rig** |
| Left print | Printed side x≈65–135,y≈30–184 | `THIS END UP` is **upside down** from the viewer's orientation, with a downward arrow. Preserve placement and inversion, not a cleaned-up shipping label |
| Torso | Dark short-sleeve bodice from ~y272–377 | Slim child shoulders and arms, black/dark graphite short sleeves, visible cloth creases—not a toy plastic torso |
| Left arm/hand | Bent forearm extends far to image x≈3; visible hand at waist around x112–188, y381–450 | Exposed skin, distinct **fingers**, left hand braced at waist; not a mitten or freely dangling arm |
| Right arm/bear | Right arm tracks down near x282–350 from y≈268 to ≈535 | Opposite arm hangs naturally; right hand carries the bear near one ear; bear is **not** floating or held by its belly |
| Dress | Asymmetric skirt silhouette x≈131–371, y≈350–720; hem rises to ~y650 on left and hangs lower right | Draped gray/charcoal cloth with tall irregular shadow folds, modest volume and a nonuniform hem—**no stiff symmetric skirt cone** |
| Bare shins and shoes | Left exposed shin ~x150–207,y661–919; right ~x235–309,y709–926; shoes end at y≈955 | Anatomically credible **child-sized knees, calves and hands**, bare shins and rounded **dark ballet flats**, no boots or adult platform feet |
| Teddy | x≈338–444, y≈526–734 | Small brown plush bear with two ears, contrasting muzzle, short rounded limbs, hanging from the child's hand at one ear |

## Source-derived ratios

The front box face is about **191px wide × 215px tall** (ratio ≈0.89). The large eye's traced width is ≈64px versus ≈53px for the small eye (ratio ≈1.21). The teddy is ≈208px tall against an explicitly traced ~952px standing span (top y=3 to sole y=955; ≈22%). The dashed guides in the annotation and `normalizationBasis` in the trace record that denominator. The front-face dimensions come from the polygon bounds, not an assumed square box. Printed-face offsets, flap quadrilaterals, asymmetric skirt hem and independent hands/legs are higher-priority than chasing these approximate percentages to subpixel precision.

**Absolute Tab-to-Shift/Qwerty scale is not derivable from three individually cropped WebPs.** The current game depicts Tab as taller than either robot, but this is a *provisional runtime scale*, not a source measurement. A calibrated browser comparison can record those existing models; it cannot establish the owner's intended proportions. Preserve their current sizes until common-scale source art or an explicit owner ratio supplies that missing authority. Do not normalize the characters to equal height or revive Shift's superseded 92% height target.

## Required implementation tests in later steps

**T3.2:** Match both box faces, sideways inversion of lettering and front/side flap edges under actual lighting. Keep face art embedded and immobile; do not replace it with floating eyeballs or animated teeth.

**T3.3:** Compare shoulders, bent left elbow, natural wrist/fingers, child shins and rounded flats. The head remains fully obscured. Reject adult anatomical proportions or stiff plastic skin.

**T3.4:** Use separate cloth topology and independent draped folds for the nonuniform hem; verify the teddy hangs by its ear from the right hand with no wrist/gap clipping through walk/idle.

**T3.5–T3.7:** Preserve usable UVs, body/dress/hand skin and animation clipping. Review front/side/three-quarter screenshots, genuine same-camera Tab/Shift/Qwerty scale, dress-bear collision and ground contacts in Chromium before replacing a production actor.

**Evidence limitations:** This trace covers one illustrated camera angle. Rear box printing, hidden torso anatomy, clothing back seams, bear rear geometry and absolute world dimensions are not established. The separate reference-bound 20-bone Tab GLB at [`Tab_Reference.glb`](../../public/assets/characters/Tab_Reference.glb) is an implementation **candidate**, not automatically accepted because of this documentation.

The Node test `tests/tab-reference-contract.test.mjs` verifies the source Git blob hash, exact original bytes embedded in the annotation, dimensions, contract bounds, basic spatial relationships, explicit ratio derivations and preserved runtime scales. It cannot establish aesthetic approval of a rendered model.

**Workflow:** This T3.1 contract is a separately committed, pushed and merged numbered step, as required. Mark `T3.1` complete only once the source tracing, review and unresolved cross-scale limitation are explicitly reconciled; the model's other backlog steps remain unchanged.


## Current production reconciliation

Qwerty remains uniformly scaled to 0.27, Shift to 0.46 and Tab to 0.66. Shift's shallow inverted-wok profile and resultant standing height supersede the old 92% target. This step changes no live model, root scale, animation, material or gameplay behavior.

The production browser harness waits for the actual Tab, Qwerty and Shift assets, stops their mixers and resets their skins to neutral pose. It places their roots at equal camera depth and aligns their measured visible-mesh minima to one common road-derived plane for QA only. It then captures `production-trio-reference.png` through one orthographic camera and `tab-reference-front.png` as a close-up. Heights come from actual visible skinned vertices; projected height ratios must match the world-space ratios. This is comparison placement, not a change to production grounding or a claim that the reference art establishes those sizes.

The original combined drawing was not located in repository history or the available file search. The three separate crops therefore remain the available source evidence. The current trace supplies source-bound box, expression, dress, hands, legs and bear landmarks; it does not supply a shared pixel scale, unseen side/back details or a physical height in metres. The scale policy is machine-readable and preserves existing runtime values without calling them source-approved.

**Remaining T3.1 acceptance issue:** lock the intended child-to-robot scale from common-scale source evidence or an explicit owner ratio. The checkbox stays open. T3.2 and later model gates remain separate; this contract does not accept the current Tab model's anatomy, drapery, hands or bear geometry.


### Recorded neutral-pose comparison

Measured from the production assets at `caccdbc112283d232a15a1cbf71e739207367cc7`, using visible skinned vertices. World units are implementation units, not dimensions established by the drawing. These numbers are observations, not modelling targets.

| Character | Uniform root scale | Measured standing height | Height / Qwerty |
| --- | ---: | ---: | ---: |
| Tab | 0.66 | 1.67970 | 2.35648 |
| Qwerty | 0.27 | 0.71280 | 1.00000 |
| Shift | 0.46 | 0.40896 | 0.57374 |

The trio image uses a single orthographic +X view with all three root X positions at zero and a shared QA minimum Y of −0.0455. The projected heights reproduce the measured world-height ratios. The source annotation, trio frame and Tab close-up were opened and inspected; 92 Node tests, 50 Python tests and the full production Chromium run passed locally. Cold independent GLEE found no remaining defect in this reconciliation. Merged-commit CI is checked separately after publication.
