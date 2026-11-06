import { spawn } from 'node:child_process';

// Runs the API server (restarting on changes) and the Vite dev server together.
const env = { ...process.env, CONFIG_ROOT: process.env.CONFIG_ROOT || '.example', HOST: '127.0.0.1' };
const children = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { env, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];
const exited = children.map(child => new Promise(resolve => child.once('exit', code => resolve(code ?? 0))));
let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) child.kill(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const code = await Promise.race(exited);
stop(); await Promise.all(exited);
process.exit(code);
