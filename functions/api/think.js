import {
    DEFAULT_MODEL, MAX_BODY_BYTES, SEVERED,
    isAllowedOrigin, validateThinkBody, buildPrompt, askWorkersAI, createRateLimiter
} from '../../lib/think-core.js';

// Best-effort per-isolate limiter. Set a Cloudflare WAF rate limit for /api/think.
const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function onRequestPost({ request, env }) {
    if (!isAllowedOrigin(request.headers.get('Origin'), request.headers.get('Referer'))) {
        return Response.json({ error: 'Wrong wasteland.' }, { status: 403 });
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!allow(ip)) {
        return Response.json({ error: 'Too much thinking. Rest.' }, {
            status: 429, headers: { 'Retry-After': '60' }
        });
    }
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY_BYTES) {
        return Response.json({ error: 'Too many words.' }, { status: 413 });
    }
    let body;
    try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
            return Response.json({ error: 'Too many words.' }, { status: 413 });
        }
        body = JSON.parse(raw);
    } catch {
        return Response.json({ error: 'Malformed offering.' }, { status: 400 });
    }
    const checked = validateThinkBody(body);
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });
    if (!env?.AI || typeof env.AI.run !== 'function') {
        console.error('Cloudflare Workers AI binding AI is missing.');
        return Response.json({ reply: SEVERED }, { status: 503 });
    }
    try {
        const { reply } = await askWorkersAI({
            ai: env.AI,
            model: env.AI_MODEL || DEFAULT_MODEL,
            ...checked.value,
            prompt: buildPrompt(checked.value)
        });
        return Response.json({ reply });
    } catch (error) {
        console.error('Workers AI inference failed:', error);
        return Response.json({ reply: SEVERED }, { status: 502 });
    }
}
