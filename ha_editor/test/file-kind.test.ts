import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileKind, isHidden, isImage, previewKind } from '../src/file-kind.ts';

test('treats YAML in the configuration root and Home Assistant folders as Home Assistant files', () => {
  for (const path of ['configuration.yaml', 'automations.yaml', 'mqtt.yaml', 'input_selects.yaml', 'loggers.yaml', 'secrets.yaml', 'packages/climate.yaml', 'blueprints/automation/motion.yaml'])
    assert.equal(fileKind(path), 'homeassistant', path);
  assert.equal(fileKind('zigbee2mqtt/configuration.yaml'), 'yaml');
  for (const path of ['themes/amoled-black.yaml', 'custom_components/hacs/services.yaml', 'dashboards/home.yaml']) assert.equal(fileKind(path), 'yaml', path);
  assert.equal(fileKind('www/custom.yaml'), 'yaml');
});

test('uses the ESPHome icon only for the esphome folder and its YAML files', () => {
  assert.equal(fileKind('esphome', true), 'esphome');
  assert.equal(fileKind('esphome/living-room.yaml'), 'esphome');
  assert.equal(fileKind('esphome/archive/old.yaml'), 'esphome');
  assert.equal(fileKind('esphome/secrets.yaml'), 'esphome');
  assert.equal(fileKind('esphome/.git', true), 'folder');
  assert.equal(fileKind('esphome/archive', true), 'folder');
  assert.equal(fileKind('esphome/.device-builder.json'), 'json');
  assert.equal(fileKind('esphome/.gitignore'), 'text');
  assert.equal(fileKind('packages/esphome', true), 'folder');
});

test('recognizes databases and logs', () => {
  for (const path of ['home-assistant_v2.db', 'home-assistant_v2.db-shm', 'home-assistant_v2.db-wal', 'zigbee.db', 'device-codes.db', 'zigbee2mqtt/state.sqlite3'])
    assert.equal(fileKind(path), 'database', path);
  for (const path of ['home-assistant.log', 'home-assistant.log.1', 'home-assistant.log.old', 'home-assistant.log.fault'])
    assert.equal(fileKind(path), 'log', path);
  assert.equal(fileKind('dbus.yaml'), 'homeassistant');
});

test('gives well-known top-level folders their own icons', () => {
  const folders: Record<string, string> = { blueprints: 'blueprints', image: 'image', media: 'media', themes: 'themes', tts: 'tts', www: 'www', zigbee2mqtt: 'zigbee2mqtt', homematicip_local: 'homematicip' };
  for (const [path, kind] of Object.entries(folders)) assert.equal(fileKind(path, true), kind, path);
  assert.equal(fileKind('blueprints/automation', true), 'folder');
  assert.equal(fileKind('www/image', true), 'folder');
  assert.equal(fileKind('custom_components', true), 'folder');
});

test('maps other files to generic kinds', () => {
  assert.equal(fileKind('packages', true), 'folder');
  assert.equal(fileKind('.storage/core.config_entries'), 'text');
  assert.equal(fileKind('ui-lovelace.json'), 'json');
  assert.equal(fileKind('python_scripts/hello.py'), 'python');
});

test('marks dotfiles, dot folders and their contents as hidden', () => {
  for (const path of ['.cache', '.storage/core.config_entries', '.HA_VERSION', 'esphome/.git', 'esphome/.gitignore']) assert.equal(isHidden(path), true, path);
  for (const path of ['', 'esphome', 'configuration.yaml', 'www/app.v1.js']) assert.equal(isHidden(path), false, path);
});

test('recognizes images for the preview', () => {
  for (const path of ['www/logo.png', 'www/photo.JPG', 'www/icon.svg', 'www/anim.gif', 'www/pic.webp', 'favicon.ico'])
    assert.equal(fileKind(path), 'picture', path);
  assert.equal(fileKind('image', true), 'image');
  assert.equal(isImage('www/logo.png'), true);
  assert.equal(isImage('www/logo.png.yaml'), false);
  assert.equal(fileKind('www', true), 'www');
});

test('recognizes audio and video for the player', () => {
  assert.equal(fileKind('tts/452db2f25b32748e0295e7_en_-_tts.cloud.mp3'), 'audio');
  assert.equal(fileKind('tts/entry_delay.mp3'), 'audio');
  assert.equal(fileKind('media/doorbell.wav'), 'audio');
  assert.equal(fileKind('media/clip.mp4'), 'video');
  assert.equal(fileKind('media/clip.webm'), 'video');
  assert.equal(previewKind('www/logo.png'), 'image');
  assert.equal(previewKind('tts/entry_delay.mp3'), 'audio');
  assert.equal(previewKind('media/clip.MOV'), 'video');
  assert.equal(previewKind('configuration.yaml'), null);
});
