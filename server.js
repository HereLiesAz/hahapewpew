import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    DEFAULT_MODEL, MAX_BODY_BYTES, SEVERED,
    isAllowedOrigin, validateThinkBody, buildPrompt, askGemini, createRateLimiter
} from './lib/think-core.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. Refusing to open a line to nowhere.");
    process.exit(1);
}
const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
const port = process.env.PORT || 3000;
const extraOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// Hash every inline <script> in index.html so the CSP can allow exactly those.
function inlineScriptHashes(file) {
    const html = fs.readFileSync(file, 'utf8');
    return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
}
const scriptHashes = inlineScriptHashes(path.join(__dirname, 'public', 'index.html'));
const csp = [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'"
].join('; ');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

app.use((req, res, next) => {
    res.set({
        'Content-Security-Policy': csp,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

const allow = createRateLimiter({ limit: 20, windowMs: 60_000 });

app.post('/api/think',
    (req, res, next) => {
        if (!isAllowedOrigin(req.get('Origin'), req.get('Referer'), extraOrigins)) {
            return res.status(403).json({ error: "Wrong wasteland." });
        }
        if (!allow(req.ip || 'unknown')) {
            res.set('Retry-After', '60');
            return res.status(429).json({ error: "Too much thinking. Rest." });
        }
        next();
    },
    express.json({ limit: MAX_BODY_BYTES }),
    async (req, res) => {
        const checked = validateThinkBody(req.body);
        if (!checked.ok) {
            return res.status(400).json({ error: checked.error });
        }
        try {
            const { reply } = await askGemini({ apiKey, model, prompt: buildPrompt(checked.value) });
            res.json({ reply });
        } catch (error) {
            console.error("The void stared back and threw an error:", error);
            res.status(502).json({ reply: SEVERED });
        }
    }
);

// Body parser failures (bad JSON, too large) land here.
app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: "Too many words." });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: "Malformed offering." });
    console.error("Unhandled despair:", err);
    res.status(500).json({ reply: SEVERED });
});

app.listen(port, () => {
    console.log(`Purgatory is being served on port ${port} (model: ${model})`);
});
