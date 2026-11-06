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
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import { parseDocument, LineCounter } from 'yaml';
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = { getWorker: (_: string, label: string) => label === 'json' ? new JsonWorker() : new EditorWorker() };
export { monaco };
const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  monaco.editor.defineTheme('home', { base: darkMode.matches ? 'vs-dark' : 'vs', inherit: true, rules: [], colors: darkMode.matches ? {
    'editor.background': '#111111', 'editor.lineHighlightBackground': '#202020',
    'editorCursor.foreground': '#18bcf2', 'editor.selectionBackground': '#004156',
  } : {
    'editor.background': '#ffffff', 'editor.lineHighlightBackground': '#f7f7f7',
    'editorCursor.foreground': '#009ac7', 'editor.selectionBackground': '#dff3fc',
    'editorLineNumber.foreground': '#989898',
  } });
  monaco.editor.setTheme('home');
}
export function watchTheme() { applyTheme(); darkMode.addEventListener('change', applyTheme); return () => darkMode.removeEventListener('change', applyTheme); }
export function language(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();
  return ({ yaml: 'yaml', yml: 'yaml', json: 'json', py: 'python', js: 'javascript', sh: 'shell', xml: 'xml', conf: 'ini', ini: 'ini' } as Record<string, string>)[ext || ''] || 'plaintext';
}
export function validate(model: monaco.editor.ITextModel | null) {
  if (!model || model.getLanguageId() !== 'yaml') return;
  const lineCounter = new LineCounter();
  const doc = parseDocument(model.getValue(), { lineCounter, customTags: ['!include', '!include_dir_list', '!include_dir_named', '!include_dir_merge_list', '!include_dir_merge_named', '!secret', '!env_var'].map(tag => ({ tag, resolve: (value: string) => value })) });
  monaco.editor.setModelMarkers(model, 'yaml', doc.errors.map(error => {
    const start = lineCounter.linePos(error.pos[0]);
    const end = lineCounter.linePos(error.pos[1]);
    return { severity: monaco.MarkerSeverity.Error, message: error.message, startLineNumber: start.line, startColumn: start.col, endLineNumber: end.line, endColumn: Math.max(end.col, start.col + 1) };
  }));
}
