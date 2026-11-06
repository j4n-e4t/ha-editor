import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileKind } from '../src/file-kind.ts';

test('recognizes Home Assistant configuration files and folders', () => {
  for (const path of ['configuration.yaml', 'automations.yaml', 'scripts.yml', 'secrets.yaml', 'packages/climate.yaml', 'blueprints/automation/motion.yaml'])
    assert.equal(fileKind(path), 'homeassistant', path);
  assert.equal(fileKind('www/custom.yaml'), 'yaml');
});

test('ESPHome takes priority inside an esphome folder', () => {
  assert.equal(fileKind('esphome', true), 'esphome');
  assert.equal(fileKind('esphome/living-room.yaml'), 'esphome');
  assert.equal(fileKind('esphome/secrets.yaml'), 'esphome');
  assert.equal(fileKind('esphome/README.md'), 'text');
});

test('maps other files to generic kinds', () => {
  assert.equal(fileKind('packages', true), 'folder');
  assert.equal(fileKind('.storage/core.config_entries'), 'text');
  assert.equal(fileKind('ui-lovelace.json'), 'json');
  assert.equal(fileKind('python_scripts/hello.py'), 'python');
});
