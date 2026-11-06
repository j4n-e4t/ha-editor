import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FileIcon } from '@/components/file-icon';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Entry = { name: string; directory: boolean };
const join = (parent: string, name: string) => parent ? `${parent}/${name}` : name;
const parentOf = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

export function FileTree({ active, refreshKey, onOpen, onError }: { active: string; refreshKey: number; onOpen: (path: string) => void; onError: (message: string) => void }) {
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

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const row = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tree-row]');
    if (!row) return;
    const rows = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-tree-row]'));
    const index = rows.indexOf(row); const path = row.dataset.path!; const isOpen = row.getAttribute('aria-expanded');
    let target: HTMLButtonElement | undefined;
    switch (event.key) {
      case 'ArrowDown': target = rows[index + 1]; break;
      case 'ArrowUp': target = rows[index - 1]; break;
      case 'Home': target = rows[0]; break;
      case 'End': target = rows.at(-1); break;
      case 'ArrowRight': if (isOpen === 'false') void toggle(path); else if (isOpen === 'true') target = rows[index + 1]; break;
      case 'ArrowLeft':
        if (isOpen === 'true') void toggle(path);
        else if (row !== rows[0]) target = rows.find(r => r.dataset.path === parentOf(path));
        break;
      default: return;
    }
    event.preventDefault(); target?.focus();
  }

  function row(path: string, name: string, directory: boolean, depth: number) {
    const open = directory && expanded.has(path);
    const Chevron = open ? ChevronDown : ChevronRight;
    return (
      <button type="button" data-tree-row data-path={path} title={path || 'config'} aria-expanded={directory ? open : undefined} aria-current={path === active && !directory ? 'true' : undefined}
        onClick={() => directory ? void toggle(path) : onOpen(path)}
        className={cn('relative flex h-[30px] w-full items-center gap-1.5 whitespace-nowrap rounded-md pr-2 text-left outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          !depth && 'font-medium', path === active && !directory && 'bg-accent text-primary hover:bg-accent')}
        style={{ paddingLeft: 4 + depth * 16 }}>
        {directory ? <Chevron aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : <span className="w-4 shrink-0" />}
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
        {!list.length && <div className="py-2 text-xs text-muted-foreground" style={{ paddingLeft: 26 + depth * 16 }}>Empty folder</div>}
        {list.map(entry => {
          const child = join(path, entry.name);
          return <div key={child}>
            {row(child, entry.name, entry.directory, depth)}
            {entry.directory && expanded.has(child) && children(child, depth + 1)}
          </div>;
        })}
      </div>
    );
  }

  return (
    <nav aria-label="Configuration files" onKeyDown={onKeyDown} className="min-h-0 flex-1 overflow-auto px-1 pb-4">
      {row('', 'config', true, 0)}
      {expanded.has('') && children('', 1)}
    </nav>
  );
}
