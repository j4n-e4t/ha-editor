import { promises as fs } from 'node:fs';

/**
 * Add-on options from the Supervisor (/data/options.json). Outside Home Assistant the file is
 * missing and the defaults apply; HIDDEN (comma-separated) and SHOW_CONFIG_FOLDER override them.
 */
export async function loadOptions(file = process.env.OPTIONS_PATH || '/data/options.json') {
  let options = {};
  try { options = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') console.warn(`Ignoring unreadable add-on options: ${error.message}`); }
  const hidden = process.env.HIDDEN !== undefined ? process.env.HIDDEN.split(',') : options.hidden;
  const show = process.env.SHOW_CONFIG_FOLDER !== undefined ? process.env.SHOW_CONFIG_FOLDER !== 'false' : options.show_config_folder;
  return {
    hidden: Array.isArray(hidden) ? hidden.map(String).map(s => s.trim()).filter(Boolean) : [],
    showConfigFolder: show !== false,
  };
}

const escape = text => text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
const glob = pattern => new RegExp(`^${escape(pattern).replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')}$`);

/**
 * Returns a test for paths relative to the configuration folder. A pattern without "/" matches
 * a file or folder name at any depth (".cache", "*.db-wal"); one with "/" matches that path
 * from the configuration folder ("esphome/.esphome"). Hiding a folder hides everything in it.
 */
export function hiddenMatcher(patterns = []) {
  const names = [], paths = [];
  for (const raw of patterns) {
    const pattern = raw.trim().replace(/^\/+|\/+$/g, '');
    if (!pattern) continue;
    (pattern.includes('/') ? paths : names).push(glob(pattern));
  }
  if (!names.length && !paths.length) return () => false;
  return relative => {
    const parts = relative.split('/').filter(Boolean);
    if (parts.some(part => names.some(regex => regex.test(part)))) return true;
    for (let i = 1; i <= parts.length; i++) { const prefix = parts.slice(0, i).join('/'); if (paths.some(regex => regex.test(prefix))) return true; }
    return false;
  };
}
