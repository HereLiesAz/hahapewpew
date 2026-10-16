import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL, askWorkersAI, buildPrompt, validateThinkBody,
    isAllowedOrigin, createRateLimiter, MAX_BODY_BYTES } from '../lib/think-core.js';
import { onRequestPost } from '../functions/api/think.js';

const input = { characterName: 'Tab', contextPrompt: 'An abandoned playground.', history: [] };
const requestFor = (body, origin = 'https://www.hahapewpew.com', headers = {}) =>
    new Request('https://www.hahapewpew.com/api/think', {
        method: 'POST', headers: { Origin: origin, ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body)
    });

test('remote AI binding needs no visitor or provider API key', async () => {
    let model, payload;
    const ai = { async run(m, p) { model = m; payload = p;
        return { choices: [{ message: { content: '"Math is dead."' } }] }; } };
    const result = await askWorkersAI({ ai, characterName: 'Shift', persona: 'Robot', prompt: 'Rubble' });
    assert.deepEqual(result, { reply: 'Math is dead.' });
    assert.equal(model, DEFAULT_MODEL);
    assert.deepEqual(payload.messages, [
        { role: 'system', content: 'Robot' }, { role: 'user', content: 'Rubble' }
    ]);
    assert.equal(payload.max_completion_tokens, 128);
    assert.equal(JSON.stringify(payload).includes('apiKey'), false);
});
test('Qwerty keeps longer arguments and all-caps speech', async () => {
    const ai = { async run(_, payload) {
        assert.equal(payload.max_completion_tokens, 360);
        return { choices: [{ message: { content: 'History demands absurdity. QED!' } }] };
    } };
    assert.deepEqual(await askWorkersAI({ ai, characterName: 'Qwerty',
        persona: 'Robot', prompt: 'Rubble' }), { reply: 'HISTORY DEMANDS ABSURDITY. QED!' });
});
test('old response shape works; empty inference fails', async () => {
    const ai = { async run() { return { response: 'Where is everyone?' }; } };
    assert.deepEqual(await askWorkersAI({ ai, characterName: 'Tab',
        persona: 'Child', prompt: 'Rubble' }), { reply: 'Where is everyone?' });
    await assert.rejects(() => askWorkersAI({ ai: { async run() {
        return { response: '' };
    } }, characterName: 'Tab', persona: 'Child', prompt: 'Rubble' }), /Empty/);
});
test('personas, contexts and origins are validated', () => {
    assert.equal(validateThinkBody({ ...input, characterName: '__proto__' }).ok, false);
    assert.equal(validateThinkBody({ ...input, history: [42] }).ok, false);
    assert.equal(validateThinkBody({ ...input, contextPrompt: 'x'.repeat(501) }).ok, false);
    assert.equal(validateThinkBody(input).ok, true);
    assert.match(buildPrompt({ ...input, characterName: 'Shift' }), /playground/);
    assert.equal(isAllowedOrigin('https://www.hahapewpew.com'), true);
    assert.equal(isAllowedOrigin('https://other.example'), false);
    assert.equal(isAllowedOrigin(null, null), false);
});
test('per-isolate throttle respects the expiry boundary', () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    assert.equal(allow('u', 0), true);
    assert.equal(allow('u', 500), true);
    assert.equal(allow('u', 999), false);
    assert.equal(allow('u', 1000), true);
});
test('API invokes only the bound model for valid input', async () => {
    let calls = 0;
    const response = await onRequestPost({ request: requestFor(input, undefined,
        { 'CF-Connecting-IP': 'test-success' }), env: { AI: { async run() {
            calls++; return { choices: [{ message: { content: 'Where do birds sleep?' } }] };
        } } } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: 'Where do birds sleep?' });
    assert.equal(calls, 1);
});
test('API rejects third parties, malformed input, oversized requests', async () => {
    const env = { AI: { async run() { throw new Error('Should not be called'); } } };
    assert.equal((await onRequestPost({ request: requestFor(input, 'https://evil.example'), env })).status, 403);
    assert.equal((await onRequestPost({ request: requestFor({ ...input, characterName: '__proto__' },
        undefined, { 'CF-Connecting-IP': 'test-invalid' }), env })).status, 400);
    assert.equal((await onRequestPost({ request: requestFor('x'.repeat(MAX_BODY_BYTES + 5),
        undefined, { 'CF-Connecting-IP': 'test-size' }), env })).status, 413);
});
test('missing AI binding reports failure, never fabricated dialogue', async () => {
    const response = await onRequestPost({ request: requestFor(input, undefined,
        { 'CF-Connecting-IP': 'test-missing' }), env: {} });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { reply: 'CONNECTION SEVERED.' });
});
