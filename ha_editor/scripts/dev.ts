const children = [
  Bun.spawn([process.execPath, '--watch', 'server/index.js'], { env: { ...process.env, CONFIG_ROOT: process.env.CONFIG_ROOT || '.example', HOST: '127.0.0.1' }, stdout: 'inherit', stderr: 'inherit' }),
  Bun.spawn([process.execPath, '--bun', 'node_modules/vite/bin/vite.js'], { stdout: 'inherit', stderr: 'inherit' }),
];
let stopping = false;
function stop() { if (stopping) return; stopping = true; for (const child of children) child.kill(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const code = await Promise.race(children.map(child => child.exited));
stop(); await Promise.all(children.map(child => child.exited));
process.exit(code);
export {};
