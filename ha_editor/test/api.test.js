import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';

const cleanups = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()(); });

async function fixture(options) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ha-editor-'));
  const root = path.join(directory, 'config');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'configuration.yaml'), 'default_config:\n');
  const server = (await createApp(root, options)).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  cleanups.push(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); });
  const request = (route, options) => fetch(`http://127.0.0.1:${server.address().port}/api/${route}`, options);
  const save = (content, version) => request('file', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'configuration.yaml', content, version }) });
  return { root, directory, request, save };
}
test('lists, reads and saves files while preserving mode and detecting stale writes', async () => {
  const { root, request, save } = await fixture();
  await fs.chmod(path.join(root, 'configuration.yaml'), 0o640);
  assert.deepEqual(await (await request('tree')).json(), [{ name: 'configuration.yaml', directory: false }]);
  const file = await (await request('file?path=configuration.yaml')).json();
  assert.equal(file.content, 'default_config:\n');
  const saved = await save('homeassistant:\n  name: Home\n', file.version);
  assert.equal(saved.status, 200);
  assert.equal(await fs.readFile(path.join(root, 'configuration.yaml'), 'utf8'), 'homeassistant:\n  name: Home\n');
  assert.equal((await fs.stat(path.join(root, 'configuration.yaml'))).mode & 0o777, 0o640);
  assert.equal((await save('stale', file.version)).status, 409);
  assert.equal((await fs.readdir(root)).length, 1);
});
test('blocks path traversal, symlinks, binary and oversized files', async () => {
  const { root, directory, request } = await fixture();
  await fs.writeFile(path.join(directory, 'secret'), 'private');
  await fs.symlink(path.join(directory, 'secret'), path.join(root, 'link'));
  await fs.writeFile(path.join(root, 'binary'), Buffer.from([0, 1, 2]));
  await fs.writeFile(path.join(root, 'large'), Buffer.alloc(2 * 1024 * 1024 + 1, 'x'));
  for (const input of ['../secret', '/etc/passwd', 'a/../../secret']) assert.equal((await request(`file?path=${encodeURIComponent(input)}`)).status, 400);
  assert.equal((await request('file?path=link')).status, 403);
  assert.equal((await request('file?path=binary')).status, 415);
  assert.equal((await request('file?path=large')).status, 413);
});
test('serializes simultaneous saves so one succeeds and one conflicts', async () => {
  const { request, save } = await fixture();
  const file = await (await request('file?path=configuration.yaml')).json();
  const results = await Promise.all([save('first', file.version), save('second', file.version)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
test('rejects cross-site writes and access outside the ingress proxy', async () => {
  const { request } = await fixture();
  assert.equal((await request('file', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' })).status, 403);
  const ingress = await fixture({ ingressOnly: true });
  assert.equal((await ingress.request('tree')).status, 403);
});

test('searches nested UTF-8 files with literal matches, locations and optional case sensitivity', async () => {
  const { root, directory, request } = await fixture();
  await fs.mkdir(path.join(root, 'packages'));
  await fs.writeFile(path.join(root, 'packages', 'lights.yaml'), 'name: Home\r\nvalue: home Home\r\npattern: a.b\r\n');
  await fs.writeFile(path.join(root, 'invalid'), Buffer.from([0xff]));
  await fs.writeFile(path.join(root, 'binary'), Buffer.from([0, 1]));
  await fs.writeFile(path.join(directory, 'outside'), 'Home');
  await fs.symlink(path.join(directory, 'outside'), path.join(root, 'linked'));
  await fs.mkdir(path.join(root, '.git'));
  await fs.writeFile(path.join(root, '.git', 'ignored'), 'Home');
  const result = await (await request('search?q=home')).json();
  assert.equal(result.matches.length, 3);
  assert.deepEqual(result.matches.map(({ path, line, column }) => ({ path, line, column })), [
    { path: 'packages/lights.yaml', line: 1, column: 7 },
    { path: 'packages/lights.yaml', line: 2, column: 8 },
    { path: 'packages/lights.yaml', line: 2, column: 13 },
  ]);
  assert.equal(result.skipped, 2);
  assert.equal((await (await request('search?q=Home&matchCase=true')).json()).matches.length, 2);
  assert.equal((await (await request('search?q=a.b')).json()).matches.length, 1);
  assert.equal((await request('search?q=')).status, 400);
  assert.equal((await request('search?q=a%0Ab')).status, 400);
});

test('bounds workspace search result counts', async () => {
  const { root, request } = await fixture();
  await fs.writeFile(path.join(root, 'many.yaml'), 'match\n'.repeat(501));
  const result = await (await request('search?q=match')).json();
  assert.equal(result.matches.length, 500);
  assert.equal(result.limited, true);
});

test('renames files and folders without overwriting or escaping the configuration directory', async () => {
  const { root, directory, request } = await fixture();
  const post = (route, body) => request(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await fs.mkdir(path.join(root, 'packages'));
  await fs.writeFile(path.join(root, 'packages', 'lights.yaml'), 'light:\n');
  await fs.writeFile(path.join(root, 'scripts.yaml'), '');
  const renamed = await post('rename', { from: 'packages/lights.yaml', to: 'packages/lighting.yaml' });
  assert.equal(renamed.status, 200);
  assert.deepEqual(await renamed.json(), { path: 'packages/lighting.yaml' });
  assert.equal(await fs.readFile(path.join(root, 'packages', 'lighting.yaml'), 'utf8'), 'light:\n');
  assert.equal((await post('rename', { from: 'packages', to: 'includes' })).status, 200);
  assert.equal(await fs.readFile(path.join(root, 'includes', 'lighting.yaml'), 'utf8'), 'light:\n');
  assert.equal((await post('rename', { from: 'scripts.yaml', to: 'configuration.yaml' })).status, 409);
  assert.equal(await fs.readFile(path.join(root, 'configuration.yaml'), 'utf8'), 'default_config:\n');
  assert.equal((await post('rename', { from: 'includes', to: 'includes/nested' })).status, 400);
  assert.equal((await post('rename', { from: '', to: 'other' })).status, 400);
  assert.equal((await post('rename', { from: 'scripts.yaml', to: '../outside.yaml' })).status, 400);
  assert.equal((await post('rename', { from: 'scripts.yaml', to: 'missing/scripts.yaml' })).status, 404);
  assert.equal((await post('rename', { from: 'missing.yaml', to: 'other.yaml' })).status, 404);
  await fs.symlink(directory, path.join(root, 'link'));
  assert.equal((await post('rename', { from: 'scripts.yaml', to: 'link/scripts.yaml' })).status, 403);
  assert.equal((await post('rename', { from: 'link', to: 'renamed-link' })).status, 403);
});

test('deletes files and folders inside the configuration directory only', async () => {
  const { root, directory, request } = await fixture();
  const post = (route, body) => request(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await fs.mkdir(path.join(root, 'packages', 'nested'), { recursive: true });
  await fs.writeFile(path.join(root, 'packages', 'nested', 'a.yaml'), '');
  await fs.writeFile(path.join(directory, 'keep'), 'outside');
  await fs.symlink(path.join(directory, 'keep'), path.join(root, 'link'));
  assert.equal((await post('delete', { path: 'packages' })).status, 200);
  assert.equal(await fs.stat(path.join(root, 'packages')).catch(() => null), null);
  assert.equal((await post('delete', { path: 'configuration.yaml' })).status, 200);
  assert.equal((await post('delete', { path: '' })).status, 400);
  assert.equal((await post('delete', { path: '.' })).status, 400);
  assert.equal((await post('delete', { path: '../keep' })).status, 400);
  assert.equal((await post('delete', { path: 'link' })).status, 403);
  assert.equal((await post('delete', { path: 'missing' })).status, 404);
  assert.equal(await fs.readFile(path.join(directory, 'keep'), 'utf8'), 'outside');
  assert.equal((await request('delete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' }, body: '{"path":"x"}' })).status, 403);
});

test('reports the Home Assistant version from .HA_VERSION when present', async () => {
  const { root, request } = await fixture();
  assert.deepEqual(await (await request('info')).json(), { homeAssistantVersion: null });
  await fs.writeFile(path.join(root, '.HA_VERSION'), '2026.11.0\n');
  assert.deepEqual(await (await request('info')).json(), { homeAssistantVersion: '2026.11.0' });
});

test('creates files and folders without overwriting', async () => {
  const { root, directory, request } = await fixture();
  const post = (route, body) => request(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const folder = await post('create', { path: 'packages', directory: true });
  assert.equal(folder.status, 200);
  assert.deepEqual(await folder.json(), { path: 'packages' });
  assert.equal((await fs.stat(path.join(root, 'packages'))).isDirectory(), true);
  assert.equal((await post('create', { path: 'packages/lights.yaml' })).status, 200);
  assert.equal(await fs.readFile(path.join(root, 'packages', 'lights.yaml'), 'utf8'), '');
  assert.equal((await post('create', { path: 'configuration.yaml' })).status, 409);
  assert.equal(await fs.readFile(path.join(root, 'configuration.yaml'), 'utf8'), 'default_config:\n');
  assert.equal((await post('create', { path: 'packages', directory: true })).status, 409);
  assert.equal((await post('create', { path: '../outside.yaml' })).status, 400);
  assert.equal((await post('create', { path: '' })).status, 400);
  assert.equal((await post('create', { path: 'missing/new.yaml' })).status, 404);
  await fs.symlink(directory, path.join(root, 'link'));
  assert.equal((await post('create', { path: 'link/new.yaml' })).status, 403);
});

test('serves media for preview with safe headers and rejects other files', async () => {
  const { root, directory, request } = await fixture();
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b00000000049454e44ae426082', 'hex');
  await fs.mkdir(path.join(root, 'www'));
  await fs.writeFile(path.join(root, 'www', 'dot.png'), png);
  await fs.writeFile(path.join(root, 'www', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const image = await request('media?path=www%2Fdot.png');
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const svg = await request('media?path=www%2Ficon.svg');
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml');
  assert.match(svg.headers.get('content-security-policy'), /sandbox/);
  assert.equal((await request('media?path=configuration.yaml')).status, 415);
  await fs.writeFile(path.join(root, 'www', 'chime.mp3'), Buffer.alloc(1000, 7));
  const audio = await request('media?path=www%2Fchime.mp3');
  assert.equal(audio.headers.get('content-type'), 'audio/mpeg');
  assert.equal(audio.headers.get('accept-ranges'), 'bytes');
  const head = await request('media?path=www%2Fchime.mp3', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), '1000');
  const part = await request('media?path=www%2Fchime.mp3', { headers: { Range: 'bytes=100-199' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), 'bytes 100-199/1000');
  assert.equal((await part.arrayBuffer()).byteLength, 100);
  assert.equal((await request('media?path=..%2Fsecret.png')).status, 400);
  await fs.writeFile(path.join(directory, 'outside.png'), png);
  await fs.symlink(path.join(directory, 'outside.png'), path.join(root, 'link.png'));
  assert.equal((await request('media?path=link.png')).status, 403);
});

test('flags files that cannot be opened so the tree can dim them', async () => {
  const { root, request } = await fixture();
  await fs.writeFile(path.join(root, 'zigbee.db'), Buffer.from([0x53, 0x51, 0x4c, 0, 1, 2]));
  await fs.writeFile(path.join(root, 'latin1.txt'), Buffer.from([0x63, 0x61, 0x66, 0xe9]));
  await fs.writeFile(path.join(root, 'home-assistant.log'), 'INFO started\n');
  await fs.writeFile(path.join(root, 'huge.yaml'), Buffer.alloc(2 * 1024 * 1024 + 1, 'a'));
  await fs.writeFile(path.join(root, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]));
  await fs.writeFile(path.join(root, 'cut.yaml'), Buffer.concat([Buffer.alloc(8191, 'a'), Buffer.from('é')]));
  await fs.mkdir(path.join(root, 'packages'));
  const tree = Object.fromEntries((await (await request('tree')).json()).map(e => [e.name, !!e.binary]));
  assert.deepEqual(tree, { packages: false, 'configuration.yaml': false, 'cut.yaml': false, 'home-assistant.log': false, 'huge.yaml': true, 'latin1.txt': true, 'photo.png': false, 'zigbee.db': true });
});
