// Recomputes the sha256 of every inline <script> in public/index.html and
// writes it into the script-src of public/_headers (Cloudflare Pages).
// Run after editing the inline script: npm run csp:hash
// server.js computes the same hashes at startup, so Express needs nothing.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);

const headersPath = path.join(root, 'public', '_headers');
const headers = fs.readFileSync(headersPath, 'utf8');
const updated = headers.replace(/script-src 'self'[^;]*;/, `script-src 'self' ${hashes.join(' ')};`);
if (updated === headers) {
    console.log('CSP already matches. Nothing to atone for.');
} else {
    fs.writeFileSync(headersPath, updated);
    console.log(`Updated public/_headers: ${hashes.join(' ')}`);
}
