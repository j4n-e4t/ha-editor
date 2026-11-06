import { forwardRef, Fragment, useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ChevronRight, CircleAlert, FileCode2, PanelLeftClose, PanelLeftOpen, Replace, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileTree } from '@/components/file-tree';
import { SearchPanel } from '@/components/search-panel';
import { FileIcon } from '@/components/file-icon';
import { MediaViewer, formatBytes, formatDuration, type MediaInfo } from '@/components/media-viewer';
import { useEditor } from '@/use-editor';
import { useHomeAssistant } from '@/lib/home-assistant';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

/** Home Assistant's ha-icon-button: a 48px round target with a 24px icon. */
const IconButton = forwardRef<HTMLButtonElement, ComponentProps<'button'> & { label: string }>(({ label, className, ...props }, ref) => (
  <Button ref={ref} variant="ghost" size="icon" title={label} aria-label={label}
    className={cn('size-12 shrink-0 rounded-full text-icon hover:bg-hover hover:text-icon disabled:opacity-40 [&_svg]:size-6', className)} {...props} />
));

const tabTrigger = 'h-full flex-1 rounded-none border-b-2 border-transparent px-4 text-sm font-medium text-sidebar-foreground opacity-80 shadow-none hover:text-primary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:opacity-100 data-[state=active]:shadow-none focus-visible:ring-inset focus-visible:ring-offset-0';
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

export function App() {
  const { container, state, crumbs, error, setError, open, save, find, moved, removed, goTo } = useEditor();
  const breadcrumbs = useRef<HTMLElement>(null);
  // Keep the innermost crumb visible when the path is wider than the bar.
  useEffect(() => { const bar = breadcrumbs.current; if (bar) bar.scrollLeft = bar.scrollWidth; }, [crumbs]);
  const { narrow } = useHomeAssistant();
  const [sidebar, setSidebar] = useState(!narrow);
  const [tab, setTab] = useState('files');
  const [refreshKey, setRefreshKey] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  const [haVersion, setHaVersion] = useState<string | null>(null);
  const [showConfigFolder, setShowConfigFolder] = useState<boolean | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  useEffect(() => {
    api<{ homeAssistantVersion: string | null; showConfigFolder: boolean }>('info')
      .then(info => { setHaVersion(info.homeAssistantVersion); setShowConfigFolder(info.showConfigFolder); }, () => setShowConfigFolder(true));
  }, []);
  useEffect(() => setSidebar(!narrow), [narrow]);
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

  // On phones the file tree is a drawer over the editor that closes once a file is chosen.
  const openFile = useCallback((path: string) => { void open(path); if (narrow) setSidebar(false); }, [open, narrow]);
  const slash = state.path.lastIndexOf('/');
  const SidebarIcon = sidebar ? PanelLeftClose : PanelLeftOpen;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Mirrors Home Assistant's panel toolbar (hass-subpage): 56px, 8px 12px padding, 20px title. */}
      <header className="flex h-[var(--header-height)] shrink-0 items-center gap-1 bg-header px-3 py-2 text-header-foreground [border-bottom:var(--app-header-border-bottom)] max-sm:px-1">
        <IconButton label={sidebar ? 'Hide files' : 'Show files'} aria-expanded={sidebar} onClick={() => setSidebar(v => !v)}><SidebarIcon /></IconButton>
        <h1 className={cn('m-0 min-w-0 flex-1 truncate text-xl leading-normal font-normal', narrow ? 'ml-2' : 'ml-6')}>Editor</h1>
        <IconButton label={`Find (${mod}+F)`} disabled={!state.path || !!state.preview} onClick={() => find()}><Search /></IconButton>
        <IconButton label="Replace" disabled={!state.path || !!state.preview} onClick={() => find(true)} className="max-sm:hidden"><Replace /></IconButton>
        <Button title={`Save (${mod}+S)`} disabled={!state.dirty || state.saving || state.loading} onClick={() => void save()}
          className="mr-1 ml-2 h-10 rounded-full px-5 text-sm font-medium shadow-none disabled:bg-hover disabled:text-muted-foreground disabled:opacity-100 max-sm:ml-1 max-sm:px-4">
          {state.saving ? 'Saving…' : 'Save'}
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Home Assistant's drawer timing (Material): 250ms to open, 200ms to close, standard easing. */}
        {narrow && <div aria-hidden onClick={() => setSidebar(false)}
          className={cn('absolute inset-0 z-20 bg-black/40 transition-opacity ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
            sidebar ? 'opacity-100 duration-250' : 'pointer-events-none opacity-0 duration-200')} />}
        {/* Desktop: the column narrows while the panel slides left, so the editor widens with it. */}
        <div className={cn('flex shrink-0 justify-end overflow-hidden transition-[width] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
          narrow ? cn('absolute inset-y-0 left-0 z-30 w-[min(85vw,320px)] overflow-visible', !sidebar && 'pointer-events-none') : sidebar ? 'w-72 duration-250' : 'w-0 duration-200')}>
        <aside aria-label="File explorer" inert={!sidebar}
          className={cn('flex w-72 min-w-72 shrink-0 flex-col border-r bg-sidebar',
            narrow && cn('w-full min-w-0 shadow-2xl transition-transform ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
              sidebar ? 'translate-x-0 duration-250' : '-translate-x-full shadow-none duration-200'))}>
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-stretch border-b">
              <TabsList aria-label="Sidebar" className="h-full flex-1 gap-0 rounded-none bg-transparent p-0">
                <TabsTrigger value="files" className={tabTrigger}>Files</TabsTrigger>
                <TabsTrigger value="search" className={tabTrigger}>Search</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="files" forceMount className="relative mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <FileTree active={state.path} dirty={state.dirty} refreshKey={refreshKey} showRoot={showConfigFolder} onRefresh={() => { setError(''); setRefreshKey(k => k + 1); }} onOpen={openFile} onError={setError} onRenamed={moved} onDeleted={removed} />
            </TabsContent>
            <TabsContent value="search" forceMount className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
              <SearchPanel inputRef={searchInput} onOpen={match => { void open(match.path, match); if (narrow) setSidebar(false); }} />
            </TabsContent>
          </Tabs>
        </aside>
        </div>

        <main className="relative flex min-w-0 flex-1 flex-col bg-background">
          {state.path && (
            <nav ref={breadcrumbs} aria-label="Breadcrumbs" className="flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b px-2 text-[13px] whitespace-nowrap text-muted-foreground [scrollbar-width:none]">
              {/* The file's folders, then the file itself (click to go to the top), then the YAML key path. */}
              {state.path.split('/').slice(0, -1).map((folder, index) => (
                <Fragment key={`folder:${index}`}>
                  <span className="shrink-0 px-1.5">{folder}</span>
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 opacity-60" />
                </Fragment>
              ))}
              <button type="button" title={`${state.path} · go to top`} onClick={() => goTo(1, 1)}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 py-0.5 hover:bg-hover hover:text-foreground', !crumbs.length && 'text-foreground')}>
                <FileIcon path={state.path} />{state.path.slice(slash + 1)}
                {state.dirty && <span aria-label="Unsaved changes" title="Unsaved changes" className="size-2 shrink-0 rounded-full bg-primary" />}
              </button>
              {crumbs.map((crumb, index) => (
                <Fragment key={`${index}:${crumb.line}`}>
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 opacity-60" />
                  <button type="button" title={`${crumb.label} · line ${crumb.line}`} onClick={() => goTo(crumb.line, crumb.column)}
                    aria-current={index === crumbs.length - 1 ? 'location' : undefined}
                    className={cn('max-w-56 shrink-0 truncate rounded-sm px-1.5 py-0.5 hover:bg-hover hover:text-foreground', index === crumbs.length - 1 && 'text-foreground')}>
                    {crumb.label}
                  </button>
                </Fragment>
              ))}
            </nav>
          )}
          {error && (
            // Home Assistant's ha-alert (error): tinted background, icon in the error color.
            <div role="alert" className="relative m-3 mb-0 flex items-start gap-3 overflow-hidden rounded-sm bg-[color-mix(in_srgb,var(--error-color)_12%,transparent)] py-2 pr-2 pl-3 leading-normal">
              <CircleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-error" />
              <span className="flex-1 self-center">{error}</span>
              <IconButton label="Dismiss" className="-my-1 size-9 [&_svg]:size-5" onClick={() => setError('')}><X /></IconButton>
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            <div ref={container} className="absolute inset-0" />
            {state.preview && <MediaViewer path={state.path} kind={state.preview} version={state.version} onInfo={setMediaInfo} />}
          </div>
          {!state.path && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center">
              <FileCode2 aria-hidden strokeWidth={1.5} className="size-14 text-icon opacity-60" />
              <p className="m-0 text-base">Select a file to start editing</p>
              <p className="m-0 text-xs text-muted-foreground">{mod}+S to save · {mod}+F to find · {mod}+Shift+F to search all files</p>
            </div>
          )}
        </main>
      </div>

      <footer className="flex h-6 shrink-0 items-center justify-between gap-3 border-t bg-sidebar px-4 text-xs text-muted-foreground max-sm:justify-end max-sm:px-2 max-sm:text-[10px]">
        <span className="flex items-center gap-1.5 max-sm:hidden" title="Home Assistant version">
          {haVersion && <><FileIcon path="configuration.yaml" />Home Assistant {haVersion}</>}
        </span>
        {state.preview && mediaInfo && (
          <div className="flex items-center gap-[18px] whitespace-nowrap max-sm:gap-2.5">
            {mediaInfo.width ? <span title="Dimensions">{mediaInfo.width} × {mediaInfo.height}</span> : null}
            {mediaInfo.duration !== undefined && <span title="Duration">{formatDuration(mediaInfo.duration)}</span>}
            {mediaInfo.bytes !== undefined && <span title="File size">{formatBytes(mediaInfo.bytes)}</span>}
            {mediaInfo.type && <span title="Type">{mediaInfo.type.split('/')[1].replace('svg+xml', 'svg').replace('mpeg', 'mp3').replace('x-', '').toUpperCase()}</span>}
          </div>
        )}
        {state.path && !state.preview && (
          <div className="flex items-center gap-[18px] whitespace-nowrap max-sm:gap-2.5">
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
