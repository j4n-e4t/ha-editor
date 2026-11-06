import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, FilePlus2, FolderPlus, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileIcon } from '@/components/file-icon';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { isHidden } from '@/file-kind';

type Entry = { name: string; directory: boolean; binary?: boolean };
const join = (parent: string, name: string) => parent ? `${parent}/${name}` : name;
const parentOf = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const within = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
const remap = (path: string, from: string, to: string) => within(path, from) ? to + path.slice(from.length) : path;
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
type Target = { path: string; directory: boolean };
const post = <T,>(route: string, body: unknown) => api<T>(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const invalidName = (name: string) => name.includes('/') || name.includes('\\') || name === '.' || name === '..';

/** Inline name field used for renaming and creating. Enter or leaving the field commits, Escape cancels. */
function NameInput({ initial, label, selectBase, onCommit, onCancel }: { initial: string; label: string; selectBase: boolean; onCommit: (value: string) => Promise<void>; onCancel: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const skipBlur = useRef(false); // Enter and Escape already handled the edit; ignore the blur that follows.
  const busy = useRef(false);
  // Focus once mounted, after a context menu has finished closing.
  useEffect(() => { requestAnimationFrame(() => input.current?.focus()); }, []);
  const commit = async (value: string) => { if (busy.current) return; busy.current = true; try { await onCommit(value); } finally { busy.current = false; } };
  return (
    <input ref={input} defaultValue={initial} aria-label={label} spellCheck={false} autoComplete="off"
      className="h-7 min-w-0 flex-1 rounded-sm border border-primary bg-card px-1.5 text-sm text-foreground outline-none ring-1 ring-primary"
      onFocus={event => { const dot = initial.lastIndexOf('.'); event.target.setSelectionRange(0, selectBase && dot > 0 ? dot : initial.length); }}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); skipBlur.current = true; void commit(event.currentTarget.value); }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); skipBlur.current = true; onCancel(); }
      }}
      onChange={() => { skipBlur.current = false; }}
      onBlur={event => { if (!skipBlur.current) void commit(event.currentTarget.value); }} />
  );
}

const actionButton = 'size-8 rounded-full text-icon hover:bg-hover hover:text-icon [&_svg]:size-[18px]';

type Props = {
  active: string; dirty: boolean; refreshKey: number; onRefresh: () => void;
  onOpen: (path: string) => void; onError: (message: string) => void;
  onRenamed: (from: string, to: string) => void; onDeleted: (path: string) => void;
};

export function FileTree({ active, dirty, refreshKey, onRefresh, onOpen, onError, onRenamed, onDeleted }: Props) {
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']));
  const expandedRef = useRef(expanded); expandedRef.current = expanded;
  const load = useCallback(async (path: string) => {
    const list = await api<Entry[]>(`tree?path=${encodeURIComponent(path)}`);
    setEntries(current => ({ ...current, [path]: list }));
  }, []);

  // Reload the root and every expanded folder; folders that disappeared are collapsed.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const paths = [...new Set(['', ...expandedRef.current])].sort((a, b) => a.split('/').length - b.split('/').length);
      const loaded: Record<string, Entry[]> = {}; const failed = new Set<string>();
      await Promise.all(paths.map(async path => {
        try { loaded[path] = await api<Entry[]>(`tree?path=${encodeURIComponent(path)}`); }
        catch (error) { failed.add(path); if (!path) onError((error as Error).message); }
      }));
      if (cancelled) return;
      setEntries(loaded);
      if (failed.size) setExpanded(current => new Set([...current].filter(path => !path || ![...failed].some(f => path === f || path.startsWith(`${f}/`)))));
    })();
    return () => { cancelled = true; };
  }, [refreshKey, onError]);

  const toggle = useCallback(async (path: string) => {
    if (expandedRef.current.has(path)) { setExpanded(current => { const next = new Set(current); next.delete(path); return next; }); return; }
    try { await load(path); setExpanded(current => new Set(current).add(path)); }
    catch (error) { onError((error as Error).message); }
  }, [load, onError]);

  const nav = useRef<HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<Target | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [creating, setCreating] = useState<{ parent: string; directory: boolean } | null>(null);
  // The row last clicked or focused decides where the header's New file/New folder buttons create.
  const selected = useRef<Target>({ path: '', directory: true });
  const remember = (event: { target: EventTarget }) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-tree-row]');
    if (row) selected.current = { path: row.dataset.path!, directory: row.hasAttribute('aria-expanded') };
  };
  const folderFor = (target: Target) => target.directory ? target.path : parentOf(target.path);
  const focusRow = (path: string) => requestAnimationFrame(() => nav.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)?.focus());

  async function commitRename(from: string, value: string) {
    const name = value.trim();
    if (!name || name === nameOf(from)) { setRenaming(null); focusRow(from); return; }
    if (invalidName(name)) { onError('Names cannot contain “/” or be “.” or “..”.'); setRenaming(null); focusRow(from); return; }
    try {
      const to = join(parentOf(from), name);
      await post('rename', { from, to });
      setExpanded(current => new Set([...current].map(path => remap(path, from, to))));
      setEntries(current => Object.fromEntries(Object.entries(current).map(([path, list]) => [remap(path, from, to), list])));
      await load(parentOf(from));
      onRenamed(from, to); setRenaming(null); focusRow(to);
    } catch (error) { onError((error as Error).message); setRenaming(null); focusRow(from); }
  }

  async function startCreate(parent: string, directory: boolean) {
    setRenaming(null);
    try {
      if (!expandedRef.current.has(parent)) { await load(parent); setExpanded(current => new Set(current).add(parent)); }
      setCreating({ parent, directory });
    } catch (error) { onError((error as Error).message); }
  }

  async function commitCreate(value: string) {
    if (!creating) return;
    const { parent, directory } = creating; const name = value.trim();
    if (!name) { setCreating(null); focusRow(parent); return; }
    if (invalidName(name)) { onError('Names cannot contain “/” or be “.” or “..”.'); setCreating(null); focusRow(parent); return; }
    try {
      const { path } = await post<{ path: string }>('create', { path: join(parent, name), directory });
      await load(parent); setCreating(null);
      if (directory) { await load(path); setExpanded(current => new Set(current).add(path)); focusRow(path); }
      else onOpen(path);
    } catch (error) { onError((error as Error).message); setCreating(null); focusRow(parent); }
  }

  async function confirmDelete(target: Target) {
    try {
      await post('delete', { path: target.path });
      setExpanded(current => new Set([...current].filter(path => !within(path, target.path))));
      setEntries(current => Object.fromEntries(Object.entries(current).filter(([path]) => !within(path, target.path))));
      await load(parentOf(target.path));
      onDeleted(target.path); focusRow(parentOf(target.path));
    } catch (error) { onError((error as Error).message); }
  }

  // Right-click opens the menu for the row under the pointer; empty space and open name fields have none.
  function onContextMenu(event: MouseEvent<HTMLElement>) {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-tree-row]');
    if (!row || renaming !== null || creating) { event.preventDefault(); setMenuTarget(null); return; }
    setMenuTarget({ path: row.dataset.path!, directory: row.hasAttribute('aria-expanded') });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    const row = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tree-row]');
    if (!row) return;
    const target = { path: row.dataset.path!, directory: row.hasAttribute('aria-expanded') };
    if (target.path && event.key === 'F2') { event.preventDefault(); setRenaming(target.path); return; }
    if (target.path && (event.key === 'Delete' || (isMac && event.metaKey && event.key === 'Backspace'))) { event.preventDefault(); setDeleting(target); return; }
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-tree-row]'));
    const index = rows.indexOf(row); const path = row.dataset.path!; const isOpen = row.getAttribute('aria-expanded');
    let next: HTMLButtonElement | undefined;
    switch (event.key) {
      case 'ArrowDown': next = rows[index + 1]; break;
      case 'ArrowUp': next = rows[index - 1]; break;
      case 'Home': next = rows[0]; break;
      case 'End': next = rows.at(-1); break;
      case 'ArrowRight': if (isOpen === 'false') void toggle(path); else if (isOpen === 'true') next = rows[index + 1]; break;
      case 'ArrowLeft':
        if (isOpen === 'true') void toggle(path);
        else if (row !== rows[0]) next = rows.find(r => r.dataset.path === parentOf(path));
        break;
      default: return;
    }
    event.preventDefault(); next?.focus();
  }

  function row(path: string, name: string, directory: boolean, depth: number, binary = false) {
    const open = directory && expanded.has(path);
    const Chevron = open ? ChevronDown : ChevronRight;
    if (renaming === path) return (
      <div className="flex h-8 w-full items-center gap-1.5 pr-1" style={{ paddingLeft: 4 + depth * 16 }}>
        {directory ? <Chevron aria-hidden className="size-4 shrink-0 text-icon" /> : <span className="w-4 shrink-0" />}
        <FileIcon path={path} directory={directory} open={open} />
        <NameInput initial={name} label={`Rename ${name}`} selectBase={!directory}
          onCommit={value => commitRename(path, value)} onCancel={() => { setRenaming(null); focusRow(path); }} />
      </div>
    );
    return (
      <button type="button" data-tree-row data-path={path} title={binary ? `${path} · cannot be opened` : path || 'config'} aria-expanded={directory ? open : undefined} aria-current={path === active && !directory ? 'true' : undefined}
        onClick={() => directory ? void toggle(path) : onOpen(path)}
        className={cn('relative flex h-8 w-full items-center gap-1.5 whitespace-nowrap rounded-sm pr-2 text-left text-sidebar-foreground outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          !depth && 'font-medium', path === active && !directory && 'bg-selected font-medium text-sidebar-selected hover:bg-selected',
          (isHidden(path) || binary) && path !== active && 'opacity-50 hover:opacity-80')}
        style={{ paddingLeft: 4 + depth * 16 }}>
        {directory ? <Chevron aria-hidden className="size-4 shrink-0 text-icon" /> : <span className="w-4 shrink-0" />}
        <FileIcon path={path || 'config'} directory={directory} open={open} />
        <span className="truncate">{name}</span>
      </button>
    );
  }

  function children(path: string, depth: number) {
    const list = entries[path];
    if (!list) return null;
    return (
      <div role="group" className="relative">
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-guide" style={{ left: 12 + (depth - 1) * 16 }} />
        {creating?.parent === path && (
          <div className="flex h-8 w-full items-center gap-1.5 pr-1" style={{ paddingLeft: 4 + depth * 16 }}>
            <span className="w-4 shrink-0" />
            <FileIcon path="new" directory={creating.directory} />
            <NameInput initial="" label={creating.directory ? 'New folder name' : 'New file name'} selectBase={false}
              onCommit={commitCreate} onCancel={() => { setCreating(null); focusRow(path); }} />
          </div>
        )}
        {!list.length && creating?.parent !== path && <div className="py-2 text-xs text-muted-foreground" style={{ paddingLeft: 26 + depth * 16 }}>Empty folder</div>}
        {list.map(entry => {
          const child = join(path, entry.name);
          return <div key={child}>
            {row(child, entry.name, entry.directory, depth, entry.binary)}
            {entry.directory && expanded.has(child) && children(child, depth + 1)}
          </div>;
        })}
      </div>
    );
  }

  const affectsOpenFile = deleting && active && within(active, deleting.path);

  return (
    <>
      <div className="absolute top-1 right-2 z-10 flex items-center">
        <Button variant="ghost" size="icon" className={actionButton} title="New file" aria-label="New file" onClick={() => void startCreate(folderFor(selected.current), false)}><FilePlus2 /></Button>
        <Button variant="ghost" size="icon" className={actionButton} title="New folder" aria-label="New folder" onClick={() => void startCreate(folderFor(selected.current), true)}><FolderPlus /></Button>
        <Button variant="ghost" size="icon" className={actionButton} title="Refresh files" aria-label="Refresh files" onClick={onRefresh}><RefreshCw /></Button>
      </div>
      <ContextMenu modal={false}>
        <ContextMenuTrigger asChild>
          <nav ref={nav} aria-label="Configuration files" onKeyDown={onKeyDown} onContextMenu={onContextMenu} onFocusCapture={remember} onPointerDownCapture={remember}
            className="min-h-0 flex-1 overflow-auto px-2 pt-2 pb-4">
            {row('', 'config', true, 0)}
            {expanded.has('') && children('', 1)}
          </nav>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={event => { event.preventDefault(); if (menuTarget && renaming === null && !creating) focusRow(menuTarget.path); }}>
          <ContextMenuItem onSelect={() => menuTarget && void startCreate(folderFor(menuTarget), false)}><FilePlus2 />New file</ContextMenuItem>
          <ContextMenuItem onSelect={() => menuTarget && void startCreate(folderFor(menuTarget), true)}><FolderPlus />New folder</ContextMenuItem>
          {menuTarget?.path && <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => setRenaming(menuTarget.path)}><Pencil />Rename<ContextMenuShortcut>F2</ContextMenuShortcut></ContextMenuItem>
            <ContextMenuItem destructive onSelect={() => setDeleting(menuTarget)}><Trash2 />Delete<ContextMenuShortcut>{isMac ? '⌘⌫' : 'Del'}</ContextMenuShortcut></ContextMenuItem>
          </>}
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={!!deleting} onOpenChange={open => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete “{deleting && nameOf(deleting.path)}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleting?.directory ? 'This folder and everything in it will be permanently deleted.' : 'This file will be permanently deleted.'}
            {affectsOpenFile && dirty ? ' The open file has unsaved changes, which will be lost.' : ''} This cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-error text-white hover:bg-error/90" onClick={() => deleting && void confirmDelete(deleting)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
