// Works out what Home Assistant value belongs at a position in YAML text. Purely text-based, so
// it keeps working while the document is being typed and does not parse as valid YAML.

export type CompletionKind = 'entity' | 'service' | 'area' | 'device' | 'floor' | 'field';
export type CompletionContext = { kind: CompletionKind; start: number; service?: string; existing?: string[] };

const KEYS: Record<string, CompletionKind> = {
  entity_id: 'entity', entity: 'entity', entities: 'entity',
  action: 'service', service: 'service',
  area_id: 'area', device_id: 'device', floor_id: 'floor',
};
const TEMPLATE = /(?:states|is_state|state_attr|is_state_attr|has_value|expand|state_translated|is_hidden_entity|area_name|device_id)\(\s*['"]([\w.]*)$/;
const INLINE = /^(\s*)(-\s+)?([A-Za-z_]\w*)\s*:\s*(?:\[\s*(?:['"]?[\w.]+['"]?\s*,\s*)*)?['"]?([\w.]*)$/;
const ITEM = /^(\s*)-\s+['"]?([\w.]*)$/;
const NEW_KEY = /^(\s*)([A-Za-z_]\w*)?$/;
const KEY_LINE = /^(\s*)(-\s+)?([A-Za-z_]\w*)\s*:(.*)$/;
const indent = (line: string) => line.match(/^\s*/)![0].length;
const blank = (line: string) => /^\s*(#.*)?$/.test(line);

/** The key a block list item at `row` belongs to, e.g. entity_id for "  - light.kitchen". */
export function parentKey(lines: string[], row: number) {
  const own = indent(lines[row]);
  for (let i = row - 1; i >= 0; i--) {
    const line = lines[i];
    if (blank(line)) continue;
    if (indent(line) === own && /^\s*-/.test(line)) continue; // A sibling item of the same list.
    const key = line.match(KEY_LINE);
    if (key && indent(line) + (key[2]?.length ?? 0) <= own && !key[4].trim()) return { key: key[3], row: i, column: indent(line) + (key[2]?.length ?? 0) };
    return null;
  }
  return null;
}

function keyAt(line: string) {
  const m = line.match(KEY_LINE);
  return m ? { column: indent(line) + (m[2]?.length ?? 0), dash: !!m[2], key: m[3], value: m[4] } : null;
}

/**
 * The service of the map whose `data:` key is at `row`: its sibling action/service key, i.e. a key
 * at the same column within the same map. Scanning stops at the map's own "- " line going up,
 * and at the next list item or a less-indented line going down.
 */
function siblingService(lines: string[], row: number, column: number) {
  const service = (k: ReturnType<typeof keyAt>) => k && (k.key === 'action' || k.key === 'service') && k.column === column
    ? k.value.trim().replace(/^['"]|['"]$/g, '').match(/^\w+\.\w+$/)?.[0] ?? null : null;
  if (!keyAt(lines[row])?.dash) for (let i = row - 1; i >= 0; i--) {
    if (blank(lines[i])) continue;
    const k = keyAt(lines[i]);
    if (k && k.column === column) { const found = service(k); if (found) return found; if (k.dash) break; continue; }
    if ((k ? k.column : indent(lines[i])) > column) continue; // Nested under an earlier sibling.
    break;
  }
  for (let i = row + 1; i < lines.length; i++) {
    if (blank(lines[i])) continue;
    if (/^\s*-\s/.test(lines[i]) && indent(lines[i]) < column) break; // The next list item.
    const k = keyAt(lines[i]);
    if ((k ? k.column : indent(lines[i])) < column) break;
    const found = service(k); if (found) return found;
  }
  return null;
}

/** Keys already present in the block starting below `row` at `column`, to avoid suggesting them twice. */
function blockKeys(lines: string[], from: number, column: number, skip: number) {
  const keys: string[] = [];
  for (let i = from + 1; i < lines.length; i++) {
    if (blank(lines[i]) || i === skip) continue;
    if (indent(lines[i]) < column) break;
    const m = lines[i].match(KEY_LINE);
    if (m && indent(lines[i]) === column) keys.push(m[3]);
  }
  return keys;
}

/**
 * What to complete at `column` (0-based) of line `row`. `start` is where the typed token begins,
 * which the completion should replace (entity IDs contain dots, which editors treat as word breaks).
 */
export function completionContext(lines: string[], row: number, column: number): CompletionContext | null {
  const before = lines[row].slice(0, column);
  if (/^\s*#/.test(before)) return null;
  const template = before.match(TEMPLATE);
  if (template) return { kind: 'entity', start: column - template[1].length };
  const inline = before.match(INLINE);
  if (inline) {
    const kind = KEYS[inline[3]];
    return kind && kind !== 'field' ? { kind, start: column - inline[4].length } : null;
  }
  const item = before.match(ITEM);
  if (item) {
    const kind = KEYS[parentKey(lines, row)?.key ?? ''];
    return kind ? { kind, start: column - item[2].length } : null;
  }
  const newKey = before.match(NEW_KEY);
  if (newKey && !/:/.test(lines[row].slice(column))) {
    const own = newKey[1].length;
    for (let i = row - 1; i >= 0; i--) {
      if (blank(lines[i])) continue;
      if (indent(lines[i]) >= own && !/^\s*-\s/.test(lines[i])) continue;
      const m = lines[i].match(KEY_LINE);
      const keyColumn = m ? indent(lines[i]) + (m[2]?.length ?? 0) : -1;
      if (!m || m[3] !== 'data' || m[4].trim() || keyColumn >= own) return null;
      const service = siblingService(lines, i, keyColumn);
      return service ? { kind: 'field', start: column - (newKey[2]?.length ?? 0), service, existing: blockKeys(lines, i, own, row) } : null;
    }
  }
  return null;
}

export type EntityReference = { entity: string; row: number; start: number; end: number };
const ENTITY = /^[a-z0-9_]+\.[a-z0-9_]+$/;

/** Literal entity IDs given to entity keys (entity_id:, entities:, and their lists), for checking. */
export function entityReferences(lines: string[]): EntityReference[] {
  const refs: EntityReference[] = [];
  const add = (row: number, offset: number, text: string) => {
    let position = offset;
    for (const part of text.split(',')) {
      const value = part.trim().replace(/^['"]|['"]$/g, '');
      const at = lines[row].indexOf(value, position);
      if (ENTITY.test(value) && at >= 0) refs.push({ entity: value, row, start: at, end: at + value.length });
      position += part.length + 1;
    }
  };
  lines.forEach((line, row) => {
    const value = line.replace(/\s+#.*$/, '');
    const key = value.match(KEY_LINE);
    if (key && KEYS[key[3]] === 'entity') {
      const rest = key[4].trim();
      const offset = value.length - key[4].length;
      if (rest.startsWith('[')) add(row, offset, rest.replace(/^\[|\]$/g, ''));
      else if (rest && !/[{!]/.test(rest)) add(row, offset, rest);
      return;
    }
    const item = value.match(/^(\s*)-\s+(.+)$/);
    if (item && !item[2].includes(':') && KEYS[parentKey(lines, row)?.key ?? ''] === 'entity') add(row, item[1].length + 2, item[2]);
  });
  return refs;
}
