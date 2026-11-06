import { expect, test } from 'bun:test';
import { fileKind } from '../src/file-kind';

test('recognizes Home Assistant configuration files and folders', () => {
  for (const path of ['configuration.yaml', 'automations.yaml', 'scripts.yml', 'secrets.yaml', 'packages/climate.yaml', 'blueprints/automation/motion.yaml'])
    expect(fileKind(path)).toBe('homeassistant');
  expect(fileKind('www/custom.yaml')).toBe('yaml');
});

test('ESPHome takes priority inside an esphome folder', () => {
  expect(fileKind('esphome', true)).toBe('esphome');
  expect(fileKind('esphome/living-room.yaml')).toBe('esphome');
  expect(fileKind('esphome/secrets.yaml')).toBe('esphome');
  expect(fileKind('esphome/README.md')).toBe('text');
});

test('maps other files to generic kinds', () => {
  expect(fileKind('packages', true)).toBe('folder');
  expect(fileKind('.storage/core.config_entries')).toBe('text');
  expect(fileKind('ui-lovelace.json')).toBe('json');
  expect(fileKind('python_scripts/hello.py')).toBe('python');
});
