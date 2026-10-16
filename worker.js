// Workers entry. Cloudflare builds this repo as a Worker (`wrangler versions upload`),
// not as Pages, so Pages Functions never run. Route the API by hand; everything
// else falls through to the static assets in public/ (which honor public/_headers).
import { onRequestPost } from './functions/api/think.js';

export default {
    async fetch(request, env, ctx) {
        const { pathname } = new URL(request.url);
        if (pathname === '/api/think') {
            if (request.method !== 'POST') {
                return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
            }
            return onRequestPost({ request, env, ctx });
        }
        return env.ASSETS.fetch(request);
    }
};
