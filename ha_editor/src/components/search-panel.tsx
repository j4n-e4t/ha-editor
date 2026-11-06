import { useEffect, useState, type Ref } from 'react';
import { CaseSensitive, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileIcon } from '@/components/file-icon';
import { api, type Match } from '@/lib/api';
import { cn } from '@/lib/utils';

type SearchResult = { matches: Match[]; limited: boolean; skipped: number };
type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; result: SearchResult };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function SearchPanel({ inputRef, onOpen }: { inputRef: Ref<HTMLInputElement>; onOpen: (match: Match) => void }) {
  const [query, setQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (!query.trim()) { setStatus({ kind: 'idle' }); return; }
    setStatus({ kind: 'loading' });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await api<SearchResult>(`search?q=${encodeURIComponent(query)}&matchCase=${matchCase}`, { signal: controller.signal });
        if (!controller.signal.aborted) setStatus({ kind: 'done', result });
      } catch (error) { if (!controller.signal.aborted) setStatus({ kind: 'error', message: (error as Error).message }); }
    }, nonce ? 0 : 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, matchCase, nonce]);

  const groups: [string, Match[]][] = [];
  if (status.kind === 'done') for (const match of status.result.matches) {
    const last = groups.at(-1);
    if (last?.[0] === match.path) last[1].push(match); else groups.push([match.path, [match]]);
  }
  const summary = status.kind === 'idle' ? 'Search saved configuration files.'
    : status.kind === 'loading' ? 'Searching…'
    : status.kind === 'error' ? status.message
    : `${plural(status.result.matches.length, 'result')} in ${plural(groups.length, 'file')}${status.result.limited ? ' · Search limit reached; narrow your query.' : ''}${status.result.skipped ? ` · ${plural(status.result.skipped, 'file')} skipped` : ''}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form role="search" className="px-3 pt-3" onSubmit={event => { event.preventDefault(); setNonce(n => n + 1); }}>
        <div className="relative flex items-center">
          <Search aria-hidden className="pointer-events-none absolute left-3 size-[18px] text-icon" />
          <Input ref={inputRef} type="search" value={query} onChange={event => { setNonce(0); setQuery(event.target.value); }} placeholder="Search files" aria-label="Search across files"
            maxLength={256} autoComplete="off" spellCheck={false} className="h-10 rounded-md bg-card pl-9 pr-10 text-sm shadow-none focus-visible:border-primary focus-visible:ring-primary" />
          <Button type="button" variant="ghost" size="icon" aria-label="Match case" title="Match case" aria-pressed={matchCase} onClick={() => setMatchCase(v => !v)}
            className={cn('absolute right-1.5 size-8 rounded-full text-icon hover:bg-hover', matchCase && 'bg-selected text-primary hover:bg-selected hover:text-primary')}>
            <CaseSensitive className="size-5!" />
          </Button>
        </div>
      </form>
      <p role="status" className="mx-3 my-2.5 text-xs leading-normal text-muted-foreground">{summary}</p>
      <div className="min-h-0 flex-1 overflow-auto pb-3">
        {groups.map(([path, matches]) => (
          <div key={path}>
            <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1 text-xs font-medium [overflow-wrap:anywhere]" title={path}>
              <FileIcon path={path} /><span>{path}</span>
            </div>
            {matches.map(match => {
              const offset = match.column - 1 - match.previewOffset;
              return (
                <button key={`${match.line}:${match.column}`} type="button" title={`${match.path}:${match.line}:${match.column}`} onClick={() => onOpen(match)}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs outline-none hover:bg-hover focus-visible:bg-hover">
                  <span className="min-w-5 text-right text-muted-foreground">{match.line}</span>
                  <span className="truncate whitespace-pre">
                    {match.previewOffset ? '…' : ''}{match.preview.slice(0, offset)}<mark>{match.preview.slice(offset, offset + match.length)}</mark>{match.preview.slice(offset + match.length)}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
