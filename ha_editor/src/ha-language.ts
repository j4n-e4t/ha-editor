import { monaco } from './monaco';
import { completionContext, entityReferences } from './ha-context';
import { deviceName, entityArea, entityIds, friendlyName, getHass, lookupService, serviceFields, type Hass } from './lib/hass';

// Home Assistant-aware YAML: completion of entity IDs, services and their fields, areas, devices and
// floors; hover details for entities and services; and a warning for entity IDs that don't exist.

const Kind = monaco.languages.CompletionItemKind;
const md = (value: string) => ({ value, isTrusted: false, supportHtml: false });
const code = (text: string) => `\`${text.replace(/`/g, '')}\``;
const escape = (text: string) => text.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');

function stateLine(hass: Hass, entityId: string) {
  const state = hass.states[entityId];
  if (!state) return hass.entities?.[entityId] ? '_No state (the entity may be disabled)_' : '';
  const unit = state.attributes.unit_of_measurement;
  return `State: ${code(`${state.state}${typeof unit === 'string' ? ` ${unit}` : ''}`)}`;
}

function entityDocs(hass: Hass, entityId: string, attributes = false) {
  const name = friendlyName(hass, entityId); const area = entityArea(hass, entityId);
  const lines = [`**${escape(name || entityId)}** ${code(entityId)}`, stateLine(hass, entityId)];
  if (area) lines.push(`Area: ${escape(area)}`);
  const attrs = Object.entries(hass.states[entityId]?.attributes ?? {}).filter(([key]) => !['friendly_name', 'unit_of_measurement', 'icon', 'entity_picture'].includes(key));
  if (attributes && attrs.length) lines.push(attrs.slice(0, 10).map(([key, value]) => `- ${escape(key)}: ${code(typeof value === 'object' ? JSON.stringify(value) : String(value)).slice(0, 120)}`).join('\n'));
  return lines.filter(Boolean).join('\n\n');
}

function serviceDocs(hass: Hass, id: string) {
  const service = lookupService(hass, id); if (!service) return '';
  const fields = serviceFields(service).map(([key, field]) => `- ${code(key)}${field.required ? ' (required)' : ''}${field.description ? ` — ${escape(field.description)}` : ''}`);
  return [`**${escape(service.name || id)}** ${code(id)}`, service.description ? escape(service.description) : '', fields.join('\n')].filter(Boolean).join('\n\n');
}

function suggestions(hass: Hass, context: NonNullable<ReturnType<typeof completionContext>>, range: monaco.IRange): monaco.languages.CompletionItem[] {
  switch (context.kind) {
    case 'entity': return entityIds(hass).map(id => {
      const name = friendlyName(hass, id);
      return { label: { label: id, description: name }, kind: Kind.Value, insertText: id, range, filterText: `${id} ${name}`, documentation: md(entityDocs(hass, id)) };
    });
    case 'service': return Object.entries(hass.services).flatMap(([domain, services]) => Object.entries(services).map(([name, service]) => {
      const id = `${domain}.${name}`;
      return { label: { label: id, description: service.name ?? '' }, kind: Kind.Function, insertText: id, range, filterText: `${id} ${service.name ?? ''}`, documentation: md(serviceDocs(hass, id)) };
    }));
    case 'field': return serviceFields(lookupService(hass, context.service!)).filter(([key]) => !context.existing?.includes(key)).map(([key, field], index) => ({
      label: { label: key, description: field.name ?? '' }, kind: Kind.Field, insertText: `${key}: `, range,
      sortText: `${field.required ? 0 : 1}${String(index).padStart(3, '0')}`,
      documentation: md([field.required ? '**Required**' : '', field.description ? escape(field.description) : '', field.example !== undefined ? `Example: ${code(String(field.example))}` : ''].filter(Boolean).join('\n\n')),
    }));
    case 'area': return Object.values(hass.areas ?? {}).map(area => ({ label: { label: area.area_id, description: area.name }, kind: Kind.Folder, insertText: area.area_id, range, filterText: `${area.area_id} ${area.name}` }));
    case 'floor': return Object.values(hass.floors ?? {}).map(floor => ({ label: { label: floor.floor_id, description: floor.name }, kind: Kind.Folder, insertText: floor.floor_id, range, filterText: `${floor.floor_id} ${floor.name}` }));
    case 'device': return Object.values(hass.devices ?? {}).map(device => {
      const name = deviceName(device);
      // Device IDs are opaque, so the device name leads and the ID is what gets inserted.
      return { label: { label: name, description: device.id }, kind: Kind.Module, insertText: device.id, range, filterText: `${name} ${device.id}`, detail: [device.manufacturer, device.model].filter(Boolean).join(' · ') };
    });
  }
}

const ENTITY_TOKEN = /[a-z0-9_]+\.[a-z0-9_]+/g;
const languageFor = (model: monaco.editor.ITextModel) => model.getLanguageId() === 'yaml';

function checkEntities(model: monaco.editor.ITextModel) {
  const hass = getHass();
  if (!hass || !languageFor(model) || model.isDisposed()) { if (!model.isDisposed()) monaco.editor.setModelMarkers(model, 'home-assistant', []); return; }
  const known = new Set(entityIds(hass));
  const domains = new Set([...known].map(id => id.split('.')[0]));
  const markers = entityReferences(model.getLinesContent())
    // Only domains Home Assistant has, so other tools' IDs (and new integrations) aren't flagged.
    .filter(ref => domains.has(ref.entity.split('.')[0]) && !known.has(ref.entity))
    .map(ref => ({ severity: monaco.MarkerSeverity.Warning, message: `Entity “${ref.entity}” was not found in Home Assistant.`, source: 'Home Assistant',
      startLineNumber: ref.row + 1, startColumn: ref.start + 1, endLineNumber: ref.row + 1, endColumn: ref.end + 1 }));
  monaco.editor.setModelMarkers(model, 'home-assistant', markers);
}

let registered = false;
export function registerHomeAssistantLanguage() {
  if (registered) return; registered = true;
  monaco.languages.registerCompletionItemProvider('yaml', {
    triggerCharacters: ['.', ' ', "'", '"', '[', ','],
    provideCompletionItems(model, position) {
      const hass = getHass(); if (!hass) return { suggestions: [] };
      const context = completionContext(model.getLinesContent(), position.lineNumber - 1, position.column - 1);
      if (!context) return { suggestions: [] };
      const after = model.getLineContent(position.lineNumber).slice(position.column - 1).match(/^[\w.]*/)![0].length;
      const range = new monaco.Range(position.lineNumber, context.start + 1, position.lineNumber, position.column + after);
      return { suggestions: suggestions(hass, context, range) };
    },
  });
  monaco.languages.registerHoverProvider('yaml', {
    provideHover(model, position) {
      const hass = getHass(); if (!hass) return null;
      const line = model.getLineContent(position.lineNumber);
      for (const match of line.matchAll(ENTITY_TOKEN)) {
        const start = match.index! + 1, end = start + match[0].length;
        if (position.column < start || position.column > end) continue;
        const range = new monaco.Range(position.lineNumber, start, position.lineNumber, end);
        if (hass.states[match[0]] || hass.entities?.[match[0]]) return { range, contents: [md(entityDocs(hass, match[0], true))] };
        if (lookupService(hass, match[0])) return { range, contents: [md(serviceDocs(hass, match[0]))] };
      }
      return null;
    },
  });
  // Re-check open YAML files as they change, when they're opened, and as Home Assistant's data loads.
  const timers = new WeakMap<monaco.editor.ITextModel, ReturnType<typeof setTimeout>>();
  const schedule = (model: monaco.editor.ITextModel, delay = 400) => { clearTimeout(timers.get(model)); timers.set(model, setTimeout(() => checkEntities(model), delay)); };
  monaco.editor.onDidCreateModel(model => {
    schedule(model, 0);
    model.onDidChangeContent(() => schedule(model));
    model.onDidChangeLanguage(() => schedule(model, 0));
  });
  setInterval(() => monaco.editor.getModels().forEach(model => schedule(model, 0)), 30_000);
}
