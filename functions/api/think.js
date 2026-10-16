import {
    DEFAULT_MODEL, MAX_BODY_BYTES, SEVERED,
    isAllowedOrigin, validateThinkBody, buildPrompt, askGemini, createRateLimiter
} from '../../lib/think-core.js';

// Lives per isolate. Cloudflare spins up many; treat this as a speed bump,
// not a wall. Use a WAF rate-limiting rule for the real thing.
const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function onRequestPost({ request, env }) {
    if (!isAllowedOrigin(request.headers.get('Origin'), request.headers.get('Referer'))) {
        return Response.json({ error: "Wrong wasteland." }, { status: 403 });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!allow(ip)) {
        return Response.json({ error: "Too much thinking. Rest." }, { status: 429, headers: { 'Retry-After': '60' } });
    }

    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > MAX_BODY_BYTES) {
        return Response.json({ error: "Too many words." }, { status: 413 });
    }

    let body;
    try {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
            return Response.json({ error: "Too many words." }, { status: 413 });
        }
        body = JSON.parse(raw);
    } catch {
        return Response.json({ error: "Malformed offering." }, { status: 400 });
    }

    const checked = validateThinkBody(body);
    if (!checked.ok) {
        return Response.json({ error: checked.error }, { status: 400 });
    }

    if (!env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not set. The void has no phone line.");
        return Response.json({ reply: SEVERED }, { status: 500 });
    }

    try {
        const { reply } = await askGemini({
            apiKey: env.GEMINI_API_KEY,
            model: env.GEMINI_MODEL || DEFAULT_MODEL,
            prompt: buildPrompt(checked.value)
        });
        return Response.json({ reply });
    } catch (error) {
        console.error("The void stared back and threw an error:", error);
        return Response.json({ reply: SEVERED }, { status: 502 });
    }
}
