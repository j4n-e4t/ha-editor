import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeft, RefreshCw, Replace, Save, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree } from '@/components/file-tree';
import { SearchPanel } from '@/components/search-panel';
import { FileIcon } from '@/components/file-icon';
import { useEditor } from '@/use-editor';
import { cn } from '@/lib/utils';

const tabTrigger = 'h-full rounded-none border-b-2 border-transparent px-0 font-normal text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none focus-visible:ring-offset-0';

export function App() {
  const { container, state, error, setError, open, save, find } = useEditor();
  const [sidebar, setSidebar] = useState(true);
  const [tab, setTab] = useState('files');
  const [refreshKey, setRefreshKey] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const showSearch = useCallback(() => { setSidebar(true); setTab('search'); requestAnimationFrame(() => searchInput.current?.select()); }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 's') { event.preventDefault(); void save(); }
      else if (key === 'f' && event.shiftKey) { event.preventDefault(); showSearch(); }
      else if (key === 'f') { event.preventDefault(); find(event.altKey); }
      else if (key === 'h' && !event.metaKey) { event.preventDefault(); find(true); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save, find, showSearch]);

  const openFile = useCallback((path: string) => void open(path), [open]);
  const status = state.saving ? 'Saving…' : state.loading ? 'Loading…' : state.dirty ? 'Unsaved changes' : state.path ? 'Saved' : 'Ready';
  const name = state.path.split('/').pop();

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
          <aside aria-label="File explorer" hidden={!sidebar} className="flex w-64 min-w-0 shrink-0 flex-col border-r bg-background max-sm:w-52">
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <div className="flex h-11 shrink-0 items-center justify-between pr-2 pl-4">
                <TabsList aria-label="Sidebar" className="h-full gap-4 rounded-none bg-transparent p-0">
                  <TabsTrigger value="files" className={tabTrigger}>Files</TabsTrigger>
                  <TabsTrigger value="search" className={tabTrigger}>Search</TabsTrigger>
                </TabsList>
                {tab === 'files' && <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground" title="Refresh files" aria-label="Refresh files" onClick={() => { setError(''); setRefreshKey(k => k + 1); }}><RefreshCw /></Button>}
              </div>
              <TabsContent value="files" forceMount className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                <FileTree active={state.path} refreshKey={refreshKey} onOpen={openFile} onError={setError} />
              </TabsContent>
              <TabsContent value="search" forceMount className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
                <SearchPanel inputRef={searchInput} onOpen={match => void open(match.path, match)} />
              </TabsContent>
            </Tabs>
          </aside>
        <main className="relative flex min-w-0 flex-1 flex-col bg-card">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b pr-3 pl-2 max-sm:gap-1 max-sm:pr-2">
            <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground" title="Toggle file tree" aria-label="Toggle file tree" aria-expanded={sidebar} onClick={() => setSidebar(v => !v)}><PanelLeft /></Button>
            <div className="flex min-w-0 items-center gap-2" title={state.path}>
              {state.path && <FileIcon path={state.path} />}
              <span className="truncate">{name || 'Editor'}{state.dirty && <span className="text-muted-foreground"> •</span>}</span>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground" title="Find (Ctrl/Cmd+F)" aria-label="Find in current file" disabled={!state.path} onClick={() => find()}><Search /></Button>
              <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground" title="Replace (Ctrl+H / Cmd+Option+F)" aria-label="Replace in current file" disabled={!state.path} onClick={() => find(true)}><Replace /></Button>
              <Button variant="ghost" size="sm" className="ml-1 rounded-full text-primary hover:bg-accent hover:text-primary max-sm:px-2" title="Save (Ctrl/Cmd+S)" disabled={!state.dirty || state.saving || state.loading} onClick={() => void save()}>
                <Save /><span className="max-sm:hidden">Save</span>
              </Button>
            </div>
          </div>
          {error && (
            <div role="alert" className="z-10 flex items-start gap-2 bg-[light-dark(#fff0e4,#3b0f00)] px-4 py-3 leading-normal text-[light-dark(#7e2900,#ffbb89)]">
              <span className="flex-1">{error}</span>
              <button type="button" aria-label="Dismiss" className="rounded-sm opacity-70 hover:opacity-100" onClick={() => setError('')}><X className="size-4" /></button>
            </div>
          )}
          <div ref={container} className="min-h-0 flex-1" />
          {!state.path && <div className="pointer-events-none absolute inset-x-0 top-11 bottom-0 grid place-items-center bg-card text-muted-foreground">Select a file to start editing</div>}
        </main>
      </div>
      <footer className="flex h-[27px] shrink-0 items-center justify-between gap-3 border-t bg-background px-4 text-xs text-muted-foreground max-sm:justify-end max-sm:px-2 max-sm:text-[10px]">
        <span role="status" className="max-sm:hidden">{status}</span>
        {state.path && (
          <div className={cn('flex items-center gap-[18px] whitespace-nowrap max-sm:gap-2.5')}>
            <span>Ln {state.line}, Col {state.column}{state.selected ? ` (${state.selected} selected)` : ''}</span>
            <span>{state.spaces ? 'Spaces' : 'Tab Size'}: {state.tabSize}</span>
            <span title="File encoding">UTF-8</span>
            <span title="Line endings">{state.eol}</span>
            <span title="Language mode">{state.language}</span>
          </div>
        )}
      </footer>
    </div>
  );
}
