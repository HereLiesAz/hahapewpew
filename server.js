// Development uses the actual Cloudflare Worker and its hosted AI binding.
// Express cannot emulate a Workers AI binding without credentials.
import { spawn } from 'node:child_process';

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(executable, ['--yes', 'wrangler', 'dev', ...process.argv.slice(2)], {
    stdio: 'inherit'
});
child.on('error', error => {
    console.error('Could not launch Wrangler:', error.message);
    process.exitCode = 1;
});
child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
