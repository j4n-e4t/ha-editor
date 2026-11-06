import { isMap, isScalar, isSeq, type Document, type Node } from 'yaml';

export type Crumb = { label: string; offset: number };

// Keys that name a list item in Home Assistant and ESPHome configs (automations, scripts, sensors, triggers…).
const ITEM_LABELS = ['alias', 'name', 'id', 'platform', 'trigger', 'action', 'service', 'condition', 'entity_id'];

const range = (node: unknown) => (node as Node | null)?.range;

/** Start of a block sequence item, including its "- " marker, so the dash itself counts as inside the item. */
function itemStart(text: string, start: number) {
  let i = start - 1;
  while (i >= 0 && (text[i] === ' ' || text[i] === '\t')) i--;
  return text[i] === '-' ? i : start;
}

function itemLabel(item: unknown, index: number) {
  if (isMap(item)) for (const key of ITEM_LABELS) {
    const value = item.get(key, true);
    if (isScalar(value) && value.value != null && typeof value.value !== 'object') return String(value.value);
  }
  if (isScalar(item) && item.value != null) return String(item.value).slice(0, 40);
  return `#${index + 1}`;
}

/**
 * The key path containing `offset`, e.g. automation › Morning lights › triggers › #1 › at.
 * The cursor counts from the first non-blank character of its line, so a cursor in an
 * indented line's leading whitespace still belongs to that line's key.
 */
export function yamlPath(text: string, doc: Document, offset: number): Crumb[] {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
  const firstChar = lineStart + (text.slice(lineStart).match(/^[ \t]*/)?.[0].length ?? 0);
  let position = Math.max(offset, Math.min(firstChar, text.indexOf('\n', lineStart) === -1 ? text.length : text.indexOf('\n', lineStart)));
  const crumbs: Crumb[] = [];
  let node: unknown = doc.contents;
  while (node) {
    if (isMap(node)) {
      const pair = node.items.find(item => {
        const key = range(item.key); if (!key) return false;
        const end = range(item.value)?.[1] ?? key[1];
        return position >= key[0] && position <= end;
      });
      if (!pair) break;
      crumbs.push({ label: isScalar(pair.key) ? String(pair.key.value) : '…', offset: range(pair.key)![0] });
      node = pair.value;
    } else if (isSeq(node)) {
      let index = -1;
      node.items.forEach((item, i) => { const r = range(item); if (r && itemStart(text, r[0]) <= position && position <= r[1]) index = i; });
      if (index < 0) break;
      const item = node.items[index]; const start = range(item)![0];
      crumbs.push({ label: itemLabel(item, index), offset: itemStart(text, start) });
      position = Math.max(position, start); // On the "- " marker, continue with the item's first key.
      node = item;
    } else break;
  }
  return crumbs;
}
