import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/ini/ini.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetController2.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import { parseDocument, LineCounter, type Document } from 'yaml';
import { cssVariable, getState, subscribe, toHex } from './lib/home-assistant';
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = { getWorker: (_: string, label: string) => label === 'json' ? new JsonWorker() : new EditorWorker() };
export { monaco };
// Monaco needs concrete hex colors, so the theme is rebuilt from the resolved Home Assistant variables.
function applyTheme() {
  const color = (name: string, fallback: string) => toHex(cssVariable(name), fallback).slice(0, 7);
  const alpha = (hex: string, opacity: number) => hex + Math.round(opacity * 255).toString(16).padStart(2, '0');
  const { dark } = getState();
  const background = color('primary-background-color', dark ? '#111111' : '#fafafa');
  const text = color('primary-text-color', dark ? '#e1e1e1' : '#212121');
  const secondary = color('secondary-text-color', dark ? '#9b9b9b' : '#727272');
  const primary = color('primary-color', dark ? '#18bcf2' : '#009ac7');
  const card = color('card-background-color', dark ? '#1c1c1c' : '#ffffff');
  monaco.editor.defineTheme('home-assistant', { base: dark ? 'vs-dark' : 'vs', inherit: true, rules: [], colors: {
    'editor.background': background, 'editorGutter.background': background, 'editor.foreground': text,
    'editorLineNumber.foreground': alpha(secondary, 0.7), 'editorLineNumber.activeForeground': text,
    'editorCursor.foreground': primary, 'editor.selectionBackground': alpha(primary, dark ? 0.35 : 0.22),
    'editor.inactiveSelectionBackground': alpha(primary, 0.14), 'editor.lineHighlightBackground': alpha(text, 0.05), 'editor.lineHighlightBorder': '#00000000',
    'editorIndentGuide.background1': alpha(text, 0.1), 'editorIndentGuide.activeBackground1': alpha(text, 0.25),
    'editorWidget.background': card, 'editorWidget.border': alpha(text, 0.12), 'editorHoverWidget.background': card, 'editorHoverWidget.border': alpha(text, 0.12),
    'input.background': background, 'input.border': alpha(text, 0.12), 'focusBorder': primary, 'inputOption.activeBorder': primary,
    'scrollbarSlider.background': alpha(text, 0.15), 'scrollbarSlider.hoverBackground': alpha(text, 0.25), 'scrollbarSlider.activeBackground': alpha(text, 0.35),
  } });
  monaco.editor.setTheme('home-assistant');
}
export function watchTheme() { applyTheme(); return subscribe(applyTheme); }
export function language(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();
  return ({ yaml: 'yaml', yml: 'yaml', json: 'json', py: 'python', js: 'javascript', sh: 'shell', xml: 'xml', conf: 'ini', ini: 'ini' } as Record<string, string>)[ext || ''] || 'plaintext';
}
// Home Assistant YAML tags, so they parse as plain values instead of unknown-tag errors.
const customTags = ['!include', '!include_dir_list', '!include_dir_named', '!include_dir_merge_list', '!include_dir_merge_named', '!secret', '!env_var', '!input']
  .map(tag => ({ tag, resolve: (value: string) => value }));
const cache = new WeakMap<monaco.editor.ITextModel, { version: number; text: string; doc: Document; lineCounter: LineCounter }>();
/** Parsed YAML (or JSON) for a model, reused until its content changes. */
export function parsed(model: monaco.editor.ITextModel) {
  if (!['yaml', 'json'].includes(model.getLanguageId())) return null;
  const version = model.getVersionId(); let entry = cache.get(model);
  if (entry?.version !== version) {
    const text = model.getValue(); const lineCounter = new LineCounter();
    entry = { version, text, lineCounter, doc: parseDocument(text, { lineCounter, customTags }) };
    cache.set(model, entry);
  }
  return entry;
}
export function validate(model: monaco.editor.ITextModel | null) {
  if (!model || model.getLanguageId() !== 'yaml') return;
  const { doc, lineCounter } = parsed(model)!;
  monaco.editor.setModelMarkers(model, 'yaml', doc.errors.map(error => {
    const start = lineCounter.linePos(error.pos[0]);
    const end = lineCounter.linePos(error.pos[1]);
    return { severity: monaco.MarkerSeverity.Error, message: error.message, startLineNumber: start.line, startColumn: start.col, endLineNumber: end.line, endColumn: Math.max(end.col, start.col + 1) };
  }));
}
