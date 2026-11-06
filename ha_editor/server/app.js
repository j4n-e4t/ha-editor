import express from 'express';
import { searchFiles } from './search.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const MAX_SIZE = 2 * 1024 * 1024;
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const MEDIA_TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', weba: 'audio/webm',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogv: 'video/ogg', mkv: 'video/x-matroska',
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });

export async function createApp(rootPath, { ingressOnly = false } = {}) {
  const root = await fs.realpath(rootPath);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (ingressOnly && req.socket.remoteAddress !== '172.30.32.2' && req.socket.remoteAddress !== '::ffff:172.30.32.2') return res.status(403).json({ error: 'Use Home Assistant ingress to access this editor.' });
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD' && (req.get('sec-fetch-site') === 'cross-site' || !req.is('application/json'))) return res.status(403).json({ error: 'Only same-site JSON requests are accepted.' });
    next();
  });
  app.use(express.json({ limit: '3mb' }));
  async function resolve(input = '') {
    if (typeof input !== 'string' || input.includes('\0') || input.includes('\\') || path.isAbsolute(input) || input.split('/').includes('..')) throw fail(400, 'Invalid path.');
    const target = path.resolve(root, input);
    if (target !== root && !target.startsWith(root + path.sep)) throw fail(403, 'Path outside configuration directory.');
    let current = root;
    for (const part of input.split('/').filter(Boolean)) {
      current = path.join(current, part);
      if ((await fs.lstat(current)).isSymbolicLink()) throw fail(403, 'Symbolic links cannot be edited.');
    }
    return target;
  }
  async function read(target) {
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw fail(400, 'Select a regular file.');
    if (stat.size > MAX_SIZE) throw fail(413, 'Files larger than 2 MB cannot be edited.');
    const bytes = await fs.readFile(target);
    if (bytes.includes(0)) throw fail(415, 'Binary files cannot be edited.');
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw fail(415, 'Only UTF-8 text files can be edited.'); }
    return { content, version: hash(bytes), mode: stat.mode };
  }
  // A file can be opened when it is media (previewed) or small UTF-8 text. Only the first 8 KB is
  // inspected, so a listing stays fast; files that cannot be opened are flagged for the tree to dim.
  async function unreadable(target, size) {
    if (MEDIA_TYPES[path.extname(target).slice(1).toLowerCase()]) return false;
    if (size > MAX_SIZE) return true;
    let handle;
    try {
      handle = await fs.open(target, 'r');
      const { buffer, bytesRead } = await handle.read(Buffer.alloc(8192), 0, 8192, 0);
      const head = buffer.subarray(0, bytesRead);
      if (head.includes(0)) return true;
      // When the read stopped before the end of the file, a final character cut in half is fine.
      new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: size > bytesRead });
      return false;
    } catch { return true; }
    finally { await handle?.close(); }
  }
  app.get('/api/tree', async (req, res) => {
    const target = await resolve(req.query.path);
    const entries = (await fs.readdir(target, { withFileTypes: true })).filter(e => !e.isSymbolicLink() && (e.isDirectory() || e.isFile()));
    const listed = await Promise.all(entries.map(async (entry, index) => {
      if (entry.isDirectory()) return { name: entry.name, directory: true };
      const file = path.join(target, entry.name);
      // Very large folders (TTS caches, recordings) skip the check beyond the first 1,000 files.
      const binary = index < 1000 ? await fs.stat(file).then(stat => unreadable(file, stat.size), () => false) : false;
      return binary ? { name: entry.name, directory: false, binary: true } : { name: entry.name, directory: false };
    }));
    res.json(listed.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name)));
  });
  app.get('/api/file', async (req, res) => {
    const { content, version } = await read(await resolve(req.query.path));
    res.json({ content, version });
  });
  // Home Assistant writes its version to .HA_VERSION in the configuration directory.
  app.get('/api/info', async (req, res) => {
    let homeAssistantVersion = null;
    try {
      const target = await resolve('.HA_VERSION');
      const stat = await fs.stat(target);
      if (stat.isFile() && stat.size < 64) homeAssistantVersion = (await fs.readFile(target, 'utf8')).trim() || null;
    } catch {} // Missing outside Home Assistant (or before its first start).
    res.json({ homeAssistantVersion });
  });
  // Read-only media preview for images, audio and video. Only media types are served, with Range
  // support so players can seek and stream; SVGs run with scripts disabled.
  app.get('/api/media', async (req, res, next) => {
    const target = await resolve(req.query.path);
    const type = MEDIA_TYPES[path.extname(target).slice(1).toLowerCase()];
    if (!type) throw fail(415, 'This file type cannot be previewed.');
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw fail(400, 'Select a regular file.');
    if (type.startsWith('image/') && stat.size > MAX_IMAGE_SIZE) throw fail(413, 'Images larger than 25 MB cannot be previewed.');
    res.set({ 'Content-Type': type, 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
    res.sendFile(target, { dotfiles: 'allow', acceptRanges: true, cacheControl: false, lastModified: false }, error => { if (error && !res.headersSent) next(error); });
  });
  app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (typeof query !== 'string' || !query.trim() || query.length > 256 || /[\r\n\0]/.test(query)) throw fail(400, 'Enter a single-line search of 1–256 characters.');
    const result = await searchFiles(query, req.query.matchCase === 'true', resolve, () => res.destroyed);
    if (!res.destroyed) res.json(result);
  });
  // Saves, renames and deletes run one at a time so they cannot interleave.
  let queue = Promise.resolve();
  const exclusive = (res, next, operation) => {
    const run = queue.then(operation).then(result => res.json(result));
    queue = run.catch(() => {});
    return run.catch(next);
  };
  const isRoot = input => typeof input === 'string' && !input.split('/').some(part => part && part !== '.');
  const exists = target => fs.lstat(target).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
  // Resolves a path that may not exist yet: the parent goes through resolve() (traversal and symlink
  // checks) and must be a directory; the new name must be valid.
  async function resolveNew(input) {
    if (typeof input !== 'string' || isRoot(input)) throw fail(400, 'Invalid path.');
    const parts = input.split('/').filter(part => part && part !== '.');
    const name = parts.pop();
    if (name.startsWith('.ha-editor-') || name.length > 255) throw fail(400, 'Invalid name.');
    const parent = await resolve(parts.join('/'));
    if (!(await fs.stat(parent)).isDirectory()) throw fail(400, 'The destination folder does not exist.');
    const target = path.join(parent, name);
    if (!target.startsWith(root + path.sep) || name.includes('\0') || name.includes('\\') || name === '..') throw fail(400, 'Invalid name.');
    return target;
  }
  app.put('/api/file', (req, res, next) => exclusive(res, next, async () => {
    const { path: filePath, content, version } = req.body ?? {};
    if (typeof content !== 'string' || typeof version !== 'string') throw fail(400, 'Content and file version are required.');
    if (Buffer.byteLength(content) > MAX_SIZE || content.includes('\0')) throw fail(413, 'File must be text smaller than 2 MB.');
    const target = await resolve(filePath);
    const previous = await read(target);
    if (previous.version !== version) throw fail(409, 'This file changed on disk. Copy your edits before reopening it.');
    const temporary = path.join(path.dirname(target), `.ha-editor-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, content, { mode: previous.mode, flag: 'wx' });
      // Check once more before replacing a file another process may have changed.
      if ((await read(target)).version !== version) throw fail(409, 'This file changed on disk. Copy your edits before reopening it.');
      await fs.rename(temporary, target);
    } finally { await fs.rm(temporary, { force: true }); }
    return { version: hash(Buffer.from(content)) };
  }));
  app.post('/api/rename', (req, res, next) => exclusive(res, next, async () => {
    const { from, to } = req.body ?? {};
    if (isRoot(from)) throw fail(400, 'The configuration folder cannot be renamed.');
    const source = await resolve(from);
    const target = await resolveNew(to);
    if (target === source) return { path: to };
    if (target.startsWith(source + path.sep)) throw fail(400, 'A folder cannot be moved into itself.');
    // Names differing only in case are the same file on case-insensitive filesystems.
    if (await exists(target) && target.toLowerCase() !== source.toLowerCase()) throw fail(409, `“${path.basename(target)}” already exists.`);
    await fs.rename(source, target);
    return { path: path.relative(root, target).split(path.sep).join('/') };
  }));
  app.post('/api/create', (req, res, next) => exclusive(res, next, async () => {
    const { path: input, directory } = req.body ?? {};
    const target = await resolveNew(input);
    if (await exists(target)) throw fail(409, `“${path.basename(target)}” already exists.`);
    // 'wx' fails instead of overwriting if something appears between the check and the write.
    if (directory === true) await fs.mkdir(target); else await fs.writeFile(target, '', { flag: 'wx' });
    return { path: path.relative(root, target).split(path.sep).join('/') };
  }));
  app.post('/api/delete', (req, res, next) => exclusive(res, next, async () => {
    const { path: input } = req.body ?? {};
    if (isRoot(input)) throw fail(400, 'The configuration folder cannot be deleted.');
    const target = await resolve(input);
    const stat = await fs.lstat(target);
    // fs.rm removes symlinks inside folders without following them.
    if (stat.isDirectory()) await fs.rm(target, { recursive: true }); else await fs.unlink(target);
    return { ok: true };
  }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API endpoint.' }));
  app.use(express.static(path.resolve('dist'), { index: 'index.html' }));
  app.use((error, req, res, next) => {
    const status = error.status ?? (error.code === 'ENOENT' ? 404 : error.code === 'EACCES' ? 403 : 500);
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'Unable to access the configuration directory.' : error.message });
  });
  return app;
}
