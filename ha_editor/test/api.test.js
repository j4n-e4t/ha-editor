import { afterEach, expect, test } from 'bun:test';
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
