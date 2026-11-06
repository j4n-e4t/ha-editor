import express from 'express';
import { searchFiles } from './search.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const MAX_SIZE = 2 * 1024 * 1024;
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
    if (req.method !== 'GET' && (req.get('sec-fetch-site') === 'cross-site' || !req.is('application/json'))) return res.status(403).json({ error: 'Only same-site JSON requests are accepted.' });
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
  app.get('/api/tree', async (req, res) => {
    const target = await resolve(req.query.path);
    const entries = await fs.readdir(target, { withFileTypes: true });
    res.json(entries.filter(e => !e.isSymbolicLink() && (e.isDirectory() || e.isFile())).map(e => ({ name: e.name, directory: e.isDirectory() })).sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name)));
  });
  app.get('/api/file', async (req, res) => {
    const { content, version } = await read(await resolve(req.query.path));
    res.json({ content, version });
  });
  app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (typeof query !== 'string' || !query.trim() || query.length > 256 || /[\r\n\0]/.test(query)) throw fail(400, 'Enter a single-line search of 1–256 characters.');
    const result = await searchFiles(query, req.query.matchCase === 'true', resolve, () => res.destroyed);
    if (!res.destroyed) res.json(result);
  });
  let saves = Promise.resolve();
  app.put('/api/file', async (req, res, next) => {
    const operation = saves.then(async () => {
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
      res.json({ version: hash(Buffer.from(content)) });
    });
    saves = operation.catch(() => {});
    await operation.catch(next);
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API endpoint.' }));
  app.use(express.static(path.resolve('dist'), { index: 'index.html' }));
  app.use((error, req, res, next) => {
    const status = error.status ?? (error.code === 'ENOENT' ? 404 : error.code === 'EACCES' ? 403 : 500);
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'Unable to access the configuration directory.' : error.message });
  });
  return app;
}
