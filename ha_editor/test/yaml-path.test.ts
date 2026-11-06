import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDocument } from 'yaml';
import { yamlPath } from '../src/yaml-path.ts';

const text = `homeassistant:
  name: Home
  customize:
    light.kitchen:
      friendly_name: Kitchen
automation:
  - alias: Morning lights
    triggers:
      - trigger: time
        at: "07:00"
    actions:
      - action: light.turn_on
  - id: "1700000000"
    mode: single
sensor:
  - platform: template
  - plain
`;
const doc = parseDocument(text);
const at = (needle: string, extra = 0) => yamlPath(text, doc, text.indexOf(needle) + extra).map(c => c.label);

test('follows nested map keys to the cursor', () => {
  assert.deepEqual(at('Home'), ['homeassistant', 'name']);
  assert.deepEqual(at('friendly_name'), ['homeassistant', 'customize', 'light.kitchen', 'friendly_name']);
});

test('labels list items by alias, id, platform or value, else by position', () => {
  assert.deepEqual(at('"07:00"'), ['automation', 'Morning lights', 'triggers', 'time', 'at']);
  assert.deepEqual(at('light.turn_on'), ['automation', 'Morning lights', 'actions', 'light.turn_on', 'action']);
  assert.deepEqual(at('single'), ['automation', '1700000000', 'mode']);
  assert.deepEqual(at('template'), ['sensor', 'template', 'platform']);
  assert.deepEqual(at('plain'), ['sensor', 'plain']);
  const list = parseDocument('- a: 1\n- b: 2\n');
  assert.deepEqual(yamlPath('- a: 1\n- b: 2\n', list, 9).map(c => c.label), ['#2', 'b']);
});

test('treats the dash and leading indentation as part of the line', () => {
  const dash = text.indexOf('- id:');
  assert.deepEqual(yamlPath(text, doc, dash).map(c => c.label), ['automation', '1700000000', 'id']);
  const indent = text.indexOf('    mode') ;
  assert.deepEqual(yamlPath(text, doc, indent).map(c => c.label), ['automation', '1700000000', 'mode']);
});

test('returns crumb offsets pointing at the keys, and nothing outside any key', () => {
  const crumbs = yamlPath(text, doc, text.indexOf('Kitchen'));
  assert.equal(text.slice(crumbs[2].offset).startsWith('light.kitchen'), true);
  assert.deepEqual(yamlPath('', parseDocument(''), 0), []);
  assert.deepEqual(yamlPath('# comment\n', parseDocument('# comment\n'), 3), []);
});

test('works for JSON documents', () => {
  const json = '{\n  "views": [\n    { "title": "Home", "cards": [] }\n  ]\n}';
  assert.deepEqual(yamlPath(json, parseDocument(json), json.indexOf('"cards"')).map(c => c.label), ['views', '#1', 'cards']);
});
