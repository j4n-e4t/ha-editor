import type { monaco } from './monaco';

export type VimMode = 'normal' | 'insert' | 'visual' | 'visual line' | 'visual block' | 'replace';

/**
 * Turns on Vim key bindings for an editor. monaco-vim is loaded on demand, so the default
 * editing style doesn't download it. The status node shows the mode, pending keys and the
 * ":" command line; ":w" saves through onSave. Returns a function that turns Vim off again.
 */
export async function enableVim(editor: monaco.editor.IStandaloneCodeEditor, status: HTMLElement, onSave: () => void, onMode: (mode: VimMode) => void) {
  const { initVimMode, VimMode, StatusBar } = await import('monaco-vim');
  (VimMode as unknown as { commands: Record<string, () => void> }).commands.save = onSave;
  // Close the ":" or "/" prompt when it loses focus (as Vim and CodeMirror do) instead of leaving it open.
  class ClosingStatusBar extends StatusBar {
    setSec(...[text, callback, options]: Parameters<InstanceType<typeof StatusBar>['setSec']>) { return super.setSec(text, callback, options && { closeOnBlur: true, ...options }); }
  }
  const vim = initVimMode(editor, status, ClosingStatusBar);
  vim.on('vim-mode-change', ({ mode, subMode }: { mode: string; subMode?: string }) =>
    onMode((mode === 'visual' && subMode ? `visual ${subMode === 'linewise' ? 'line' : 'block'}` : mode) as VimMode));
  onMode('normal');
  return () => vim.dispose();
}
