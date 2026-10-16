# hahapewpew

Two murder robots and a nine-year-old in a cardboard box walk the end of the world, making small talk. The small talk comes from Gemini. The pew pew is local.

Live at **https://www.hahapewpew.com**.

## What's in the box

| Path | What it is |
| --- | --- |
| `public/index.html` | The whole game: one canvas, one inline script. |
| `public/_headers` | Security headers for the Cloudflare static assets (CSP with the inline script's hash). |
| `public/robots.txt`, `public/sitemap.xml` | For the crawlers, who also wander aimlessly. |
| `functions/api/think.js` | `POST /api/think` handler, routed by `worker.js` in production. |
| `worker.js`, `wrangler.jsonc` | Cloudflare Worker entry and config: API route plus `public/` as static assets. |
| `server.js` | Express server for local development (and any Node host). Same API, same rules. |
| `lib/think-core.js` | Shared personas, request validation, origin check, rate limiter, Gemini call. Both backends import it. |
| `scripts/csp-hash.js` | Rewrites the CSP hash in `public/_headers` after you touch the inline script. |

## Run it locally

Requires Node 18 or newer.

~~~sh
npm install
echo "GEMINI_API_KEY=your-key-here" > .env
npm start
~~~

Then open http://localhost:3000. The server exits immediately if `GEMINI_API_KEY` is missing, rather than pretending.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | (required) | Google AI Studio key. Sent in the `x-goog-api-key` header, never in a URL. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any `generateContent`-capable Gemini model. Change it when Google retires this one too. |
| `PORT` | `3000` | Express port. |
| `ALLOWED_ORIGINS` | (none) | Comma-separated extra origins allowed to call `/api/think` (Express only). |
| `TRUST_PROXY` | (unset) | Passed to Express `trust proxy` so rate limiting sees real client IPs behind a proxy. |

Sanity check:

~~~sh
npm run check
curl -i -X POST http://localhost:3000/api/think \
  -H 'Origin: http://localhost:3000' -H 'Content-Type: application/json' \
  -d '{"characterName":"__proto__","contextPrompt":"hi"}'
# HTTP/1.1 400 ... {"error":"Unrecognized entity."}
~~~

## Deploy

Production is a **Cloudflare Worker** with static assets, not GitHub Pages. The `CNAME` file is a leftover label for the custom domain, `www.hahapewpew.com`; Cloudflare is what actually serves it.

`wrangler.jsonc` defines it: `worker.js` handles `POST /api/think` (reusing `functions/api/think.js`, which imports `lib/think-core.js`), and every other path is served from `public/`, with `public/_headers` applied.

Workers Builds settings (dashboard):

- Build command: none
- Deploy command: `npx wrangler versions upload` (or `npx wrangler deploy`)
- Variables and secrets: `GEMINI_API_KEY` (secret), optionally `GEMINI_MODEL`
- Custom domains: `hahapewpew.com` and `www.hahapewpew.com`

Or from the command line:

~~~sh
npx wrangler deploy
npx wrangler dev    # local, with the Worker and assets together
~~~

If you edit the inline `<script>` in `public/index.html`, regenerate the CSP hash or the browser will refuse to run the game:

~~~sh
npm run csp:hash
~~~

(`server.js` computes the hash at startup, so local runs never drift.)

## What the API does and does not protect

`POST /api/think` takes `{ characterName, contextPrompt, history }` and returns `{ reply }`. It:

- accepts only `Tab`, `Shift` or `Qwerty` (own-property lookup; `__proto__` is not a character);
- requires `contextPrompt` to be a non-empty string of at most 500 chars, and `history` an array of at most 10 strings of at most 300 chars; otherwise `400`;
- rejects bodies over 8 KB (`413`) and requests whose `Origin`/`Referer` is not `hahapewpew.com`, `www.hahapewpew.com` or localhost (`403`);
- rate-limits to 20 requests per minute per IP (`429`).

Be honest about the limits. The origin check stops other websites from spending the key through visitors' browsers; it does not stop someone with curl who forges a header. The Express limiter is per process. The Cloudflare limiter is per isolate, which is to say decorative; for a real ceiling add a Cloudflare WAF rate-limiting rule on `/api/think` and set a quota on the Gemini key. The client also caps itself at 120 calls per page load and goes quiet while the tab is hidden or paused.

Safety-blocked Gemini responses come back as `> [REDACTED BY THE MANAGEMENT]` from both backends.

## Accessibility

Dialogue is mirrored into a polite `aria-live` log. Press **P** or the Pause button to stop the world. `prefers-reduced-motion` runs the apocalypse at half speed.

## Versioning

`version.properties` (`major.minor.patch.build`) is canonical and is read by an external workflow, along with `.version-state.json`. `package.json` carries the matching `major.minor.patch` (npm does not allow a fourth segment). Do not hand-edit the first two.

## License

Boost Software License 1.0. See `LICENSE`.
