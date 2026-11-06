import { useCallback, useEffect, useRef, useState } from 'react';
import { monaco, language, parsed, validate, watchTheme } from './monaco';
import { yamlPath } from './yaml-path';
import { previewKind, type PreviewKind } from './file-kind';
import { api, type Match } from './lib/api';

export type Breadcrumb = { label: string; line: number; column: number };
const initial = { path: '', preview: null as PreviewKind | null, version: '', dirty: false, saving: false, loading: false, line: 1, column: 1, selected: 0, tabSize: 2, spaces: true, eol: 'LF', language: 'Plain Text' };
export function useEditor() {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const current = useRef({ path: '', preview: null as PreviewKind | null, version: '', saved: '', saving: false, loading: false });
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  const [crumbs, setCrumbs] = useState<Breadcrumb[]>([]);
  // The YAML key path at the cursor; parsing is cached per document version.
  const updateCrumbs = useCallback(() => {
    const ed = editor.current; const model = ed?.getModel(); const position = ed?.getPosition();
    const entry = model && position ? parsed(model) : null;
    const next = entry ? yamlPath(entry.text, entry.doc, model!.getOffsetAt(position!)).map(crumb => {
      const { lineNumber, column } = model!.getPositionAt(crumb.offset);
      return { label: crumb.label, line: lineNumber, column };
    }) : [];
    setCrumbs(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
  }, []);
  const sync = useCallback(() => {
    const ed = editor.current; const model = ed?.getModel(); const pos = ed?.getPosition(); const selection = ed?.getSelection();
    const options = model?.getOptions();
    const labels: Record<string, string> = { yaml: 'YAML', json: 'JSON', plaintext: 'Plain Text', python: 'Python', javascript: 'JavaScript', shell: 'Shell', xml: 'XML', ini: 'INI' };
    setState({ path: current.current.path, preview: current.current.preview, version: current.current.version, dirty: !!model && model.getValue() !== current.current.saved, saving: current.current.saving, loading: current.current.loading,
      line: pos?.lineNumber || 1, column: pos?.column || 1, selected: selection && model ? model.getValueInRange(selection).length : 0,
      tabSize: options?.tabSize || 2, spaces: options?.insertSpaces ?? true, eol: model?.getEOL() === '\r\n' ? 'CRLF' : 'LF', language: labels[model?.getLanguageId() || 'plaintext'] || 'Plain Text' });
  }, []);
  useEffect(() => {
    const ed = monaco.editor.create(container.current!, { automaticLayout: true, fontSize: 14, lineHeight: 24,
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, padding: { top: 16 },
      overviewRulerLanes: 0, hideCursorInOverviewRuler: true, tabSize: 2, insertSpaces: true, model: null, wordWrap: 'on' });
    editor.current = ed; const unwatch = watchTheme(); let timer: ReturnType<typeof setTimeout>; let crumbTimer: ReturnType<typeof setTimeout>;
    const scheduleCrumbs = () => { clearTimeout(crumbTimer); crumbTimer = setTimeout(updateCrumbs, 60); };
    const disposables = [ed.onDidChangeCursorPosition(scheduleCrumbs), ed.onDidChangeModel(updateCrumbs), ed.onDidChangeModelLanguage(updateCrumbs), ed.onDidChangeCursorSelection(sync), ed.onDidChangeModelOptions(sync), ed.onDidChangeModelContent(() => { sync(); scheduleCrumbs(); clearTimeout(timer); timer = setTimeout(() => validate(ed.getModel()), 250); })];
    return () => { clearTimeout(timer); clearTimeout(crumbTimer); disposables.forEach(d => d.dispose()); unwatch(); ed.getModel()?.dispose(); ed.dispose(); editor.current = null; };
  }, [sync, updateCrumbs]);
  const reveal = useCallback((match: Pick<Match, 'line' | 'column' | 'length'>) => {
    const ed = editor.current; if (!ed?.getModel()) return;
    const range = new monaco.Range(match.line, match.column, match.line, match.column + match.length);
    ed.setSelection(range); ed.revealRangeInCenter(range); ed.focus(); sync();
  }, [sync]);
  const open = useCallback(async (path: string, match?: Match) => {
    const ed = editor.current; const file = current.current; if (!ed || file.loading || file.saving) return;
    if (path === file.path && match) { reveal(match); return; }
    if (ed.getModel() && ed.getValue() !== file.saved && !confirm('Discard unsaved changes and open another file?')) return;
    const preview = previewKind(path);
    if (preview) { // Images, audio and video are shown by the preview; the text editor is cleared.
      const old = ed.getModel(); ed.setModel(null); old?.dispose();
      Object.assign(file, { path, preview, version: String(Date.now()), saved: '' }); setError(''); sync(); return;
    }
    file.loading = true; ed.updateOptions({ readOnly: true }); setError(''); sync();
    try {
      const result = await api<{ content: string; version: string }>(`file?path=${encodeURIComponent(path)}`);
      if (editor.current !== ed) return;
      const model = monaco.editor.createModel(result.content, language(path)); model.detectIndentation(true, 2);
      const old = ed.getModel(); file.path = path; file.preview = null; file.version = result.version; file.saved = result.content;
      ed.setModel(model); old?.dispose(); validate(model); if (match) reveal(match);
    } catch (e) { setError((e as Error).message); }
    finally { file.loading = false; if (editor.current === ed) { ed.updateOptions({ readOnly: false }); sync(); ed.focus(); } }
  }, [reveal, sync]);
  const save = useCallback(async () => {
    const ed = editor.current; const file = current.current;
    if (!ed?.getModel() || file.loading || file.saving || ed.getValue() === file.saved) return;
    const content = ed.getValue(); file.saving = true; setError(''); sync();
    try { const result = await api<{ version: string }>('file', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: file.path, content, version: file.version }) }); file.version = result.version; file.saved = content; }
    catch (e) { setError((e as Error).message); }
    finally { file.saving = false; sync(); }
  }, [sync]);
  const find = useCallback((replace = false) => { const ed = editor.current; if (!ed?.getModel()) return; ed.focus(); void ed.getAction(replace ? 'editor.action.startFindReplaceAction' : 'actions.find')?.run(); }, []);
  useEffect(() => {
    document.title = `${state.dirty ? '• ' : ''}${state.path.split('/').pop() || 'HA Editor'} — HA Editor`;
    const beforeUnload = (e: BeforeUnloadEvent) => { if (editor.current?.getModel() && editor.current.getValue() !== current.current.saved) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [state.path, state.dirty]);
  // Keep the open buffer (including unsaved edits) when its file or a parent folder is renamed.
  const moved = useCallback((from: string, to: string) => {
    const file = current.current; const model = editor.current?.getModel();
    if (!file.path || (file.path !== from && !file.path.startsWith(`${from}/`))) return;
    file.path = to + file.path.slice(from.length);
    if (file.preview) { file.preview = previewKind(file.path) ?? file.preview; file.version = String(Date.now()); }
    if (model) { monaco.editor.setModelLanguage(model, language(file.path)); validate(model); }
    sync();
  }, [sync]);
  // Close the editor when its file, or a folder containing it, is deleted.
  const removed = useCallback((path: string) => {
    const file = current.current; const ed = editor.current;
    if (!ed || !file.path || (file.path !== path && !file.path.startsWith(`${path}/`))) return;
    const model = ed.getModel(); ed.setModel(null); model?.dispose();
    file.path = ''; file.preview = null; file.version = ''; file.saved = ''; sync();
  }, [sync]);
  const goTo = useCallback((line: number, column: number) => {
    const ed = editor.current; if (!ed?.getModel()) return;
    ed.setPosition({ lineNumber: line, column }); ed.revealLineInCenterIfOutsideViewport(line); ed.focus();
  }, []);
  return { container, state, crumbs, error, setError, open, save, find, moved, removed, goTo };
}
