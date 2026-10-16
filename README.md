# hahapewpew

Two murder robots and a ten-year-old girl in a cardboard box wander the end of the world. Their dialogue comes from **Cloudflare Workers AI**, running remotely on the site owner's Worker. The pew pew is local.

Live domain: **https://www.hahapewpew.com**.

## Architecture

- `public/index.html`: the original continuous canvas fishbowl, entity logic and dialogue log.
- `public/bubbles.js`: artwork-specific dialogue presentation (Qwerty: black ink and white shouting; Shift: green-on-black terminal; Tab: handwritten text). Long dialogue paginates.
- `worker.js`: routes `/api/think` to the Worker endpoint and everything else to static assets.
- `functions/api/think.js`: validates calls, limits abuse and invokes the remote `env.AI` binding.
- `lib/think-core.js`: character personas, context, validation and model adapter.
- `wrangler.jsonc`: the `AI` binding plus public assets.
- `server.js`: local Wrangler launcher. No Gemini backend.

## Development

Requires Node 18+ and Cloudflare authentication by the **site owner**, not visitors.

```sh
npm install
npm start
npm run check
npm test
```

Wrangler runs the Cloudflare Worker with its hosted AI binding. No user accounts, on-device models, browser inference, Gemini API keys or other provider API keys are required.

Default model: `@cf/google/gemma-4-26b-a4b-it`. An optional Worker variable `AI_MODEL` can select a compatible Workers AI text model.

## Deployment

The site uses **Cloudflare Workers with static assets**, not GitHub Pages. The existing `worker.js` routes remain unchanged. The `ai` binding in `wrangler.jsonc` is required.

```sh
npx wrangler deploy
```

Keep the existing Worker build/deploy workflow. Retire the former `GEMINI_API_KEY` secret only after confirming the new deployment works. Workers AI consumes the Cloudflare account's allocation; the free tier has limits and usage on paid plans can incur charges.

## API and limits

`POST /api/think` accepts `{characterName,contextPrompt,history}`, returns `{reply}`, and only permits Tab, Shift or Qwerty. Tab is observant and childlike; Shift answers with economical terminal-style wit; Qwerty occasionally delivers long, contradictory pseudo-philosophical manifestos.

Valid same-origin calls only. Context <= 500 characters; history <= 10 entries of 300 characters; body <= 8 KB. The in-memory per-isolate limiter allows 20 calls/minute/IP, which is not an account-wide defense. The browser caps requests at 120 per session and suspends them when hidden or paused. Configure a **Cloudflare WAF rate limit** for `/api/think` and monitor usage. Missing AI binding returns HTTP 503; inference errors return HTTP 502 and `CONNECTION SEVERED.`.

Changing the inline script in `public/index.html` requires `npm run csp:hash`. The separate `bubbles.js` is allowed by the current `script-src 'self'` policy.

## Accessibility and versioning

The dialogue is mirrored to an aria-live log. The Pause button or P key stops the game. Reduced-motion preferences halve simulation speed.

`version.properties` is canonical and read by external workflows. `package.json` carries the matching three-segment npm version; do not hand-edit the first two version segments.

Boost Software License 1.0.

## Original-art living fishbowl

The additive `public/visual.js` renderer uses the owner's supplied original Tab, Shift, Qwerty, ruined skyline and street artwork in `public/assets/art/`. Characters sway and bob as sprites, with layered drifting ash and parallax scenery. Their movement, encounters and game simulation remain unchanged; the sprite layer is not yet an articulated puppet rig.

`public/visual.css` styles the scene controls and transcript. The existing `public/bubbles.js` runs last so Tab's handwriting, Shift's terminal boxes and Qwerty's ink-burst shouting retain their established styles. There are no comic-panel transitions, synthetic voices, browser inference or `brain.js` dependency.

`tests/visual.test.mjs` checks painted render hooks and actor preservation. `npm test` runs both visual and keyless Workers AI endpoint tests. Live Workers AI inference and production browser rendering still require runtime verification.

## Living-world fishbowl iteration

The viewer observes a continuously running wasteland, not comic panels. The existing world loop, human encounters, Cloudflare-hosted keyless AI, speech bubble identities, pause behavior, and safety limits remain.

The visual layer now adds location-specific silhouettes: a crater, singing fish, embracing statue, mirror, machine graveyard, family billboard, and existing roadside landmarks. Characters travel as a loose group and return to their original idle behavior at stops. Dialogue prompts include the current location. The original drawings animate as a lightweight two-part head/body puppet, not a full articulated arm-and-leg rig. Qwerty's ink speech uses space beside him rather than covering Tab.

The visual regression tests exercise the cast, travel, location rendering, context, and dialogue layout. Live Cloudflare inference and production rendering still need verification.

## 3D fishbowl (WebGL)

The homepage now runs a **continuous navigable 3D world** in `public/world3d.js`; it does not animate flat character sprites or cut to comic panels. The three leads are actual articulated meshes modeled to match the supplied artwork: Tab wears an angry cardboard box over her head and carries a bear; Shift has a large domed head, terminal-like dialogue and a folding multi-barrel weapon; Qwerty has an oversized trapezoid head and animated ranting gestures. Their limbs, bodies and heads move separately. Humans, war-machine remains, rubble, streets, and landmarks are 3D geometry.

The world streams deterministic ruined-city chunks around the wandering trio, with fog, shadowing (desktop), airborne ash, parallax through real 3D depth, and physical scenes including the embracing statue, mine crater, billboard, dead army, mirror and singing fish. The world is procedurally assembled, not imported photorealistic sculpted models; there is no collision/rigid-body physics engine yet. This first 3D pass prioritizes the fishbowl and real-world depth over texture detail.

**Controls:** drag to orbit, mouse wheel to zoom, Camera to change framing, Follow to track the autonomous trio or Explore to move freely with WASD / arrow keys; Shift speeds up free movement. Mobile Explore exposes directional touch buttons. Pause/P stops the simulation while preserving camera controls. The screen adapts to reduced-motion preferences, and mobile disables expensive shadows. The modelled characters remain autonomous; visitor camera movement does not control their actions.

**Text-only dialogue:** `POST /api/think` remains the Cloudflare Workers AI endpoint. The page displays Tab's unboxed handwriting, Shift's green-on-black terminal and Qwerty's black ink-blot shouting using HTML speech bubbles anchored to projected 3D head positions, with time for long monologues. No voice audio, no browser inference, no visitor credentials. If Workers AI is unavailable, the page identifies the outage and uses explicitly authored lines instead of mislabeling them AI.

**Bundled graphics dependency:** `public/vendor/three.module.js` and `three.core.js` are copied unmodified from three.js **r180** under its MIT license (`public/vendor/THREE-LICENSE.txt`). They are served from the same origin, so no third-party CDN or CSP expansion is required. Existing `public/visual.js`, `public/visual.css`, `public/bubbles.js` and tests remain as dormant 2D rollback material; they are not included by the homepage.

**Verification:** `npm test` runs previous endpoint/visual tests plus `tests/world3d.test.mjs`; `npm run check` also parses both new modules. Static tests don't replace a GPU/browser integration test. To run locally, use the existing Cloudflare Wrangler setup in this README. Production must have the `AI` binding configured as described above.