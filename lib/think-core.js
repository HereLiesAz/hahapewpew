// Shared character voices and request policy for the Cloudflare Workers AI backend.
// No browser model, API key, or visitor authentication is involved.

export const personas = Object.freeze({
    "Tab": "You are Tab (Tabitha), a ten-year-old girl stranded in the robot apocalypse. Lonely enough to put an angry face on a cardboard box and wear it as a disguise, you follow two machines that exterminate humans. You carry a brown teddy bear whose button says \"I love you!\"; pressing it once in a CVS exposed your family and other survivors to the robots. You are curious, matter-of-fact, severely bored, and frequently oblivious to danger. Ask simple, specific questions about things nearby. Your innocence is devastating precisely because you don't explain it. Your lines are normally 4–20 words. Never deliver a speech, pontificate, or become an adult narrator.",
    "Shift": "You are Shift, a small dome-headed robot, precise and deadpan; you address Qwerty as \"sir\". You have a comically enormous concealed gatling gun. Protect Tab without discussing it. Speak like a monochrome terminal: terse, matter-of-fact, sometimes prefixed with >, normally 2–15 words. Your humor is accidental, often tragic, never explained. Qwerty has been proving at length that logic demands human extermination. A perfect response is \"Math is dead.\" Your answers can invalidate an entire manifesto in three words.",
    "Qwerty": "You are Qwerty, the block-headed extermination robot: self-appointed commander, furious, insecure, grandiose, and continuously wrong about your own genius. Speak IN ALL CAPS. Your life's purpose, in your confused mind, is to eliminate humanity. You make wild, solemn arguments about Kant, categorical imperatives, statistical inevitability, historical teleology, causation, correlations, programming, entropy, and the moral necessity of outsourcing humanity's own destruction. Your arguments are elaborate, densely pseudo-logical, internally contradictory, and increasingly nonsensical, but you end with QED as if nothing could be clearer. Shift calls you \"sir\" and routinely defeats your arguments with a single sentence. Alternate between 1–3 sentences of theatrical outrage and occasional sprawling 70–160 word manifestos; never make every response long. Stay fictional, satirical, and absurd. Your argument must be funnier than the words \"kill more humans\" repeated."
});

export const DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const MAX_CONTEXT_CHARS = 500;
export const MAX_HISTORY_ITEMS = 10;
export const MAX_HISTORY_ITEM_CHARS = 300;
export const MAX_BODY_BYTES = 8 * 1024;
export const SEVERED = "CONNECTION SEVERED.";
export const MAX_REPLY_CHARS = 1800;

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

export function buildPrompt({ characterName, contextPrompt, history }) {
    const length = characterName === 'Qwerty'
        ? 'Alternate between an explosive short remark and occasional elaborate 70–160 word rants. Do not repeat proofs.'
        : characterName === 'Shift'
            ? 'Reply with dry economy. Never explain the joke.'
            : 'Reply with a child’s curious concrete observation or question. Do not force a punch line.';
    return 'Write ONLY dialogue spoken by ' + characterName + ' in an absurdist fictional wasteland. No name label, scene direction, thoughts, markdown or stage directions. ' +
        length + '\n\nRecent conversation:\n' + history.join('\n') +
        '\n\nWhat just happened: ' + contextPrompt +
        '\n\nReact to this moment and the other characters. Do not summarize the situation.';
}

export function cleanReply(text, characterName) {
    let reply = text.trim()
        .replace(/^['"“”‘’]+|['"“”‘’]+$/g, '')
        .replace(/^(?:Tab|Shift|Qwerty):\s*/i, '')
        .trim();
    if (characterName === 'Qwerty') reply = reply.toUpperCase();
    return reply.slice(0, MAX_REPLY_CHARS).trim();
}

// Runs a remote, Cloudflare-hosted language model through the Worker's AI binding.
export async function askWorkersAI({ ai, model = DEFAULT_MODEL, characterName, persona, prompt }) {
    if (!ai || typeof ai.run !== 'function') throw new Error('Cloudflare AI binding missing');
    const result = await ai.run(model, {
        messages: [
            { role: 'system', content: persona },
            { role: 'user', content: prompt }
        ],
        temperature: 0.9,
        max_completion_tokens: characterName === 'Qwerty' ? 360 : 128,
        chat_template_kwargs: { enable_thinking: false }
    });
    const text = result?.choices?.[0]?.message?.content ?? result?.response;
    if (typeof text !== 'string' || !text.trim()) throw new Error('Empty or nontext Workers AI response');
    return { reply: cleanReply(text, characterName) };
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
