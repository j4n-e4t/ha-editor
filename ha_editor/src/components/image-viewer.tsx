import { useEffect, useState } from 'react';
import { ImageOff, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ImageInfo = { width: number; height: number; bytes: number; type: string };
type Status = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; url: string; bytes: number; type: string };

export const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Read-only preview: fits the pane by default; click to toggle actual size. */
export function ImageViewer({ path, version, onInfo }: { path: string; version: string; onInfo: (info: ImageInfo | null) => void }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [actualSize, setActualSize] = useState(false);

  useEffect(() => {
    const controller = new AbortController(); let url = '';
    setStatus({ kind: 'loading' }); setActualSize(false); onInfo(null);
    void (async () => {
      try {
        const response = await fetch(`./api/image?path=${encodeURIComponent(path)}`, { signal: controller.signal });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'The image could not be loaded.');
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        setStatus({ kind: 'ready', url, bytes: blob.size, type: blob.type });
      } catch (error) { if (!controller.signal.aborted) setStatus({ kind: 'error', message: (error as Error).message }); }
    })();
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [path, version, onInfo]);

  return (
    // Checkerboard so transparent areas are visible in both themes.
    <div className={cn('absolute inset-0 overflow-auto bg-background', status.kind === 'ready' && !actualSize && 'grid place-items-center p-6')}
      style={{ backgroundImage: 'conic-gradient(var(--hover) 25%, transparent 0 50%, var(--hover) 0 75%, transparent 0)', backgroundSize: '20px 20px' }}>
      {status.kind === 'loading' && <div className="grid h-full place-items-center"><LoaderCircle aria-label="Loading image" className="size-8 animate-spin text-icon" /></div>}
      {status.kind === 'error' && (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
          <ImageOff aria-hidden strokeWidth={1.5} className="size-14 text-icon opacity-60" />
          <p className="m-0">{status.message}</p>
        </div>
      )}
      {status.kind === 'ready' && (
        <img src={status.url} alt={path.split('/').pop()} draggable={false}
          title={actualSize ? 'Click to fit' : 'Click for actual size'}
          onClick={() => setActualSize(value => !value)}
          onLoad={event => onInfo({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight, bytes: status.bytes, type: status.type })}
          onError={() => setStatus({ kind: 'error', message: 'This image could not be displayed.' })}
          className={cn('block select-none shadow-sm [image-rendering:auto]',
            actualSize ? 'max-w-none cursor-zoom-out m-6' : 'max-h-full max-w-full cursor-zoom-in object-contain')} />
      )}
    </div>
  );
}
