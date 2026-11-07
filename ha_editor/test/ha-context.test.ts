import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completionContext, entityReferences } from '../src/ha-context.ts';

/** Context at the "|" marker in a YAML snippet. */
function at(snippet: string) {
  const lines = snippet.split('\n');
  const row = lines.findIndex(line => line.includes('|'));
  const column = lines[row].indexOf('|');
  lines[row] = lines[row].replace('|', '');
  const context = completionContext(lines, row, column);
  return context && { ...context, token: lines[row].slice(context.start, column) };
}

test('completes entity IDs after entity keys, in lists and in templates', () => {
  assert.deepEqual(at('entity_id: light.kit|'), { kind: 'entity', start: 11, token: 'light.kit' });
  assert.equal(at('  - entity: |')?.kind, 'entity');
  assert.equal(at('entities: [light.a, sen|')?.token, 'sen');
  assert.equal(at('target:\n  entity_id:\n    - light.a\n    - sw|')?.token, 'sw');
  assert.equal(at('entity_id:\n- light.a\n- |')?.kind, 'entity'); // Indentless list.
  assert.equal(at("value_template: \"{{ is_state('binary_sensor.do|') }}\"")?.token, 'binary_sensor.do');
  assert.equal(at('entity_id: "light.|')?.token, 'light.');
});

test('completes services, areas, devices and floors', () => {
  assert.equal(at('  - action: light.tu|')?.kind, 'service');
  assert.equal(at('service: |')?.kind, 'service');
  assert.equal(at('area_id: liv|')?.kind, 'area');
  assert.equal(at('target:\n  area_id:\n    - |')?.kind, 'area');
  assert.equal(at('device_id: |')?.kind, 'device');
  assert.equal(at('floor_id: |')?.kind, 'floor');
});

test('completes service fields under data using the sibling action', () => {
  const automation = `actions:
  - action: light.turn_on
    target:
      entity_id: light.kitchen
    data:
      brightness_pct: 50
      tr|`;
  assert.deepEqual(at(automation), { kind: 'field', start: 6, service: 'light.turn_on', existing: ['brightness_pct'], token: 'tr' });
  const actionBelow = `- data:
    |
  action: notify.mobile_app_phone`;
  assert.equal(at(actionBelow)?.service, 'notify.mobile_app_phone');
  const twoItems = `- action: light.turn_on
  data:
    brightness: 1
- action: climate.set_temperature
  data:
    |`;
  assert.equal(at(twoItems)?.service, 'climate.set_temperature');
  assert.equal(at('- action: light.turn_on\n  target:\n    |'), null); // Not under data.
  assert.equal(at('data:\n  |'), null); // No service in the map.
});

test('offers nothing elsewhere', () => {
  assert.equal(at('alias: Morning |'), null);
  assert.equal(at('# entity_id: light.|'), null);
  assert.equal(at('name: light.|'), null);
  assert.equal(at('  - platform: |'), null);
});

test('finds literal entity references for checking', () => {
  const text = `automation:
  - triggers:
      - trigger: state
        entity_id: binary_sensor.door, binary_sensor.window # both doors
    actions:
      - action: light.turn_on
        target:
          entity_id:
            - light.kitchen
            - "light.hall"
      - action: scene.turn_on
        entity_id: [scene.evening, scene.night]
      - entity_id: "{{ trigger.entity_id }}"
      - entity_id: !input target_light
      - entities:
          - entity: sensor.temperature
`;
  const lines = text.split('\n');
  const refs = entityReferences(lines);
  assert.deepEqual(refs.map(r => r.entity), ['binary_sensor.door', 'binary_sensor.window', 'light.kitchen', 'light.hall', 'scene.evening', 'scene.night', 'sensor.temperature']);
  for (const ref of refs) assert.equal(lines[ref.row].slice(ref.start, ref.end), ref.entity);
});
