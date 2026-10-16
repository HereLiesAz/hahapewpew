// Shared brain for /api/think. Imported by server.js (Express) and
// functions/api/think.js (Cloudflare Pages). One set of personas, one set of
// rules, one way to be told no.

export const personas = Object.freeze({
    'Tab': "You are Tab (Tabitha), a 9-year-old girl alone in a robot apocalypse. You're so lonely you put a cardboard box over your head and drew a mean face on it so you could tag along with two murder robots as they hunt humans. You are EXTREMELY curious and completely oblivious to danger. You are also nihilistic, poetic, and severely bored. You carry a brown teddy bear that only says 'I love you!' when pressed — pressing it in a CVS got your parents and a whole group of survivors killed, and you still press it sometimes. Never break character. Keep responses under 8 words.",
    'Shift': "You are Shift, a dome-headed robot — the deadpan 'Spock' of the group. You are matter-of-fact, dry, and humorless. You speak strictly in terminal-emulator style (e.g., '> Status: ...', '> Calculating...', 'C:\\'). At any moment you can transform into a massive gatling gun that is way too big to fit inside you, but somehow does. You are fiercely loyal to Tab and quietly protect her from the dangers she fails to notice. If anything you say happens to be funny, you do not acknowledge it — the reader is never quite sure it was intentional. Never break character. Keep responses under 8 words.",
    'Qwerty': "You are Qwerty, a square-headed robot — essentially Invader Zim. You SHOUT in ALL CAPS constantly. You are constantly annoyed, constantly confused about why you have to be annoyed, and therefore constantly paranoid, which only makes you shout more. You believe you are the singular-minded leader of the group (Shift addresses you as 'sir') and your one true mission is to KILL MORE HUMANS. You frequently derail yourself by overthinking your paranoia and wildly overestimating your enemies. Never break character. Keep responses under 8 words."
});

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const MAX_CONTEXT_CHARS = 500;
export const MAX_HISTORY_ITEMS = 10;
export const MAX_HISTORY_ITEM_CHARS = 300;
export const MAX_BODY_BYTES = 8 * 1024;
export const SEVERED = "CONNECTION SEVERED.";
export const REDACTED = "> [REDACTED BY THE MANAGEMENT]";

const ALLOWED_ORIGINS = new Set([
    'https://hahapewpew.com',
    'https://www.hahapewpew.com'
]);
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// Same-origin fetches from some browsers omit Origin; fall back to Referer.
// Requests with neither are refused: curl is not a guest at this funeral.
export function isAllowedOrigin(origin, referer, extraOrigins = []) {
    let o = origin;
    if (!o && referer) {
        try { o = new URL(referer).origin; } catch { o = null; }
    }
    if (!o) return false;
    return ALLOWED_ORIGINS.has(o) || LOCAL_ORIGIN.test(o) || extraOrigins.includes(o);
}

export function getPersona(name) {
    return typeof name === 'string' && Object.prototype.hasOwnProperty.call(personas, name)
        ? personas[name]
        : null;
}

// Returns { ok: true, value } or { ok: false, error }.
export function validateThinkBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, error: "Malformed offering." };
    }
    const { characterName, contextPrompt, history = [] } = body;
    const persona = getPersona(characterName);
    if (!persona) return { ok: false, error: "Unrecognized entity." };
    if (typeof contextPrompt !== 'string' || !contextPrompt.trim() || contextPrompt.length > MAX_CONTEXT_CHARS) {
        return { ok: false, error: "Context rejected." };
    }
    if (!Array.isArray(history) || history.length > MAX_HISTORY_ITEMS ||
        !history.every(h => typeof h === 'string' && h.length <= MAX_HISTORY_ITEM_CHARS)) {
        return { ok: false, error: "History rejected." };
    }
    return { ok: true, value: { characterName, persona, contextPrompt, history } };
}

export function buildPrompt({ persona, contextPrompt, history }) {
    return `${persona}\n\nRecent conversation history:\n${history.join('\n')}\n\n${contextPrompt}`;
}

// Strip only quotes that wrap the whole reply; apostrophes survive.
export function cleanReply(text) {
    return text.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
}

// Calls Gemini over plain fetch. Returns { reply, blocked }.
// Throws on transport / HTTP failure so callers can log it.
export async function askGemini({ apiKey, model, prompt, fetchImpl = fetch }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent`;
    const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.9,
                // Personas cap themselves at ~8 words; this leaves headroom so
                // the sentence ends instead of being guillotined mid-word.
                maxOutputTokens: 60,
                // 2.5 models spend output budget "thinking"; these lines do not need it.
                thinkingConfig: { thinkingBudget: 0 }
            }
        })
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const blocked = Boolean(data?.promptFeedback?.blockReason) ||
        ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate?.finishReason);
    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
    if (blocked || !text.trim()) return { reply: blocked ? REDACTED : "...", blocked };
    return { reply: cleanReply(text) || "...", blocked: false };
}

// Fixed-window in-memory limiter. Per process (Express) or per isolate
// (Cloudflare), so the latter is best-effort at most.
export function createRateLimiter({ limit = 20, windowMs = 60_000, maxKeys = 10_000 } = {}) {
    const hits = new Map();
    return function allow(key, now = Date.now()) {
        let entry = hits.get(key);
        if (!entry || now - entry.start >= windowMs) {
            if (hits.size >= maxKeys) {
                for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
                if (hits.size >= maxKeys) hits.clear();
            }
            entry = { start: now, count: 0 };
            hits.set(key, entry);
        }
        entry.count++;
        return entry.count <= limit;
    };
}
