import { useEffect, useState } from 'react';
import { FileAudio, ImageOff, LoaderCircle } from 'lucide-react';
import type { PreviewKind } from '@/file-kind';
import { cn } from '@/lib/utils';

export type MediaInfo = { width?: number; height?: number; duration?: number; bytes?: number; type: string };

export const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export const formatDuration = (seconds: number) => {
  const s = Math.round(seconds); const h = Math.floor(s / 3600); const m = Math.floor(s / 60) % 60; const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
};
const mediaUrl = (path: string, version: string) => `./api/media?path=${encodeURIComponent(path)}&v=${version}`;

function Message({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
      <ImageOff aria-hidden strokeWidth={1.5} className="size-14 text-icon opacity-60" />
      <p className="m-0">{text}</p>
    </div>
  );
}

/** Read-only preview for images, audio and video, using the browser's own players. */
export function MediaViewer({ path, kind, version, onInfo }: { path: string; kind: PreviewKind; version: string; onInfo: (info: MediaInfo | null) => void }) {
  return kind === 'image'
    ? <ImagePreview path={path} version={version} onInfo={onInfo} />
    : <PlayerPreview path={path} kind={kind} version={version} onInfo={onInfo} />;
}

type ImageStatus = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; url: string; bytes: number; type: string };

/** Fits the pane by default; click to toggle actual size. */
function ImagePreview({ path, version, onInfo }: { path: string; version: string; onInfo: (info: MediaInfo | null) => void }) {
  const [status, setStatus] = useState<ImageStatus>({ kind: 'loading' });
  const [actualSize, setActualSize] = useState(false);

  useEffect(() => {
    const controller = new AbortController(); let url = '';
    setStatus({ kind: 'loading' }); setActualSize(false); onInfo(null);
    void (async () => {
      try {
        const response = await fetch(mediaUrl(path, version), { signal: controller.signal });
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
      {status.kind === 'error' && <Message text={status.message} />}
      {status.kind === 'ready' && (
        <img src={status.url} alt={path.split('/').pop()} draggable={false}
          title={actualSize ? 'Click to fit' : 'Click for actual size'}
          onClick={() => setActualSize(value => !value)}
          onLoad={event => onInfo({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight, bytes: status.bytes, type: status.type })}
          onError={() => setStatus({ kind: 'error', message: 'This image could not be displayed.' })}
          className={cn('block select-none shadow-sm', actualSize ? 'm-6 max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain')} />
      )}
    </div>
  );
}

/** Streams from the server (with seeking) into the browser's native audio or video player. */
function PlayerPreview({ path, kind, version, onInfo }: { path: string; kind: 'audio' | 'video'; version: string; onInfo: (info: MediaInfo | null) => void }) {
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<{ bytes?: number; type: string }>({ type: '' });
  const [playback, setPlayback] = useState<{ duration?: number; width?: number; height?: number }>({});
  const url = mediaUrl(path, version);

  // The player reports duration and size; a HEAD request adds the file size and type.
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setMeta({ type: '' }); setPlayback({}); onInfo(null);
    fetch(url, { method: 'HEAD', signal: controller.signal }).then(async response => {
      if (!response.ok) { const body = await fetch(url, { signal: controller.signal }).then(r => r.json()).catch(() => null); setError(body?.error || 'This file could not be loaded.'); return; }
      const bytes = Number(response.headers.get('content-length')) || undefined;
      setMeta({ bytes, type: response.headers.get('content-type') || '' });
    }, () => {});
    return () => controller.abort();
  }, [url, onInfo]);

  const report = (element: HTMLMediaElement) => setPlayback({
    duration: Number.isFinite(element.duration) ? element.duration : undefined,
    ...(element instanceof HTMLVideoElement && element.videoWidth ? { width: element.videoWidth, height: element.videoHeight } : {}),
  });
  const failed = () => setError(`Your browser can't play this ${kind === 'audio' ? 'audio' : 'video'} file.`);
  // Whichever arrives first, the status bar gets the combined details.
  useEffect(() => { if (meta.type || playback.duration) onInfo({ type: meta.type, bytes: meta.bytes, ...playback }); }, [meta, playback, onInfo]);

  if (error) return <div className="absolute inset-0 bg-background"><Message text={error} /></div>;
  if (kind === 'video') return (
    <div className="absolute inset-0 grid place-items-center bg-black p-4">
      <video key={url} src={url} controls preload="metadata" playsInline onLoadedMetadata={event => report(event.currentTarget)} onError={failed}
        className="max-h-full max-w-full rounded-sm bg-black outline-none" />
    </div>
  );
  return (
    <div className="absolute inset-0 grid place-items-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <FileAudio aria-hidden strokeWidth={1.5} className="size-14 text-violet-500 dark:text-violet-400" />
        <p className="m-0 max-w-full truncate text-base" title={path}>{path.split('/').pop()}</p>
        <audio key={url} src={url} controls preload="metadata" onLoadedMetadata={event => report(event.currentTarget)} onError={failed} className="w-full" />
      </div>
    </div>
  );
}
