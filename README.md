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
