import { promises as fs } from 'node:fs';

const excluded = new Set(['.git', 'node_modules', '__pycache__']);
const MAX_RESULTS = 500;
const MAX_FILES = 2000;
const MAX_BYTES = 32 * 1024 * 1024;

// Literal search only: no user-controlled regex execution or external index process.
export async function searchFiles(query, matchCase, resolve, cancelled = () => false) {
  const matches = [];
  let files = 0, bytesRead = 0, skipped = 0, limited = false;
  const deadline = Date.now() + 5000;
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
  async function walk(relative = '') {
    if (cancelled()) return;
    const directory = await resolve(relative);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (cancelled() || limited) return;
      if (Date.now() > deadline || files >= MAX_FILES || bytesRead >= MAX_BYTES) { limited = true; return; }
      if (entry.isSymbolicLink() || excluded.has(entry.name) || entry.name.startsWith('.ha-editor-')) continue;
      const filePath = relative ? `${relative}/${entry.name}` : entry.name;
      try {
        if (entry.isDirectory()) { await walk(filePath); continue; }
        if (!entry.isFile()) continue;
        files++;
        const target = await resolve(filePath);
        const stat = await fs.stat(target);
        if (stat.size > 2 * 1024 * 1024) { skipped++; continue; }
        if (bytesRead + stat.size > MAX_BYTES) { limited = true; return; }
        const content = await fs.readFile(target); bytesRead += content.length;
        if (content.includes(0)) { skipped++; continue; }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
        const lines = text.split(/\r\n|\n|\r/);
        for (let i = 0; i < lines.length; i++) {
          pattern.lastIndex = 0;
          for (const match of lines[i].matchAll(pattern)) {
            if (matches.length >= MAX_RESULTS) { limited = true; return; }
            const start = Math.max(0, match.index - 60);
            matches.push({ path: filePath, line: i + 1, column: match.index + 1, length: match[0].length,
              preview: lines[i].slice(start, match.index + match[0].length + 100), previewOffset: start });
          }
        }
      } catch { skipped++; } // A disappearing, unreadable, or non-UTF-8 file must not stop the search.
    }
  }
  await walk();
  return { matches, limited, skipped };
}
