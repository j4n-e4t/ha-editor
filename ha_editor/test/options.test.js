import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hiddenMatcher, loadOptions } from '../server/options.js';

test('matches names at any depth, wildcards, and paths from the configuration folder', () => {
  const hidden = hiddenMatcher(['.cache', ' .cloud ', '*.db-wal', 'home-assistant.log.?', 'esphome/.esphome', '/www/community/', '']);
  for (const p of ['.cache', 'deps/.cache', '.cache/x.yaml', '.cloud', 'zigbee.db-wal', 'home-assistant.log.1', 'esphome/.esphome', 'esphome/.esphome/build/a.yaml', 'www/community', 'www/community/card.js'])
    assert.equal(hidden(p), true, p);
  for (const p of ['cache', 'configuration.yaml', 'zigbee.db', 'home-assistant.log', 'packages/.esphome', 'www', 'www/communityx', 'esphome'])
    assert.equal(hidden(p), false, p);
  assert.equal(hiddenMatcher([])('anything'), false);
});

test('reads add-on options with safe defaults', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ha-editor-options-'));
  try {
    assert.deepEqual(await loadOptions(path.join(dir, 'missing.json')), { hidden: [], showConfigFolder: true });
    await fs.writeFile(path.join(dir, 'options.json'), JSON.stringify({ show_config_folder: false, hidden: ['.cache', ' ', '.cloud'] }));
    assert.deepEqual(await loadOptions(path.join(dir, 'options.json')), { hidden: ['.cache', '.cloud'], showConfigFolder: false });
    await fs.writeFile(path.join(dir, 'broken.json'), '{');
    assert.deepEqual(await loadOptions(path.join(dir, 'broken.json')), { hidden: [], showConfigFolder: true });
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
