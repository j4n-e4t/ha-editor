export type FolderKind = 'folder' | 'esphome' | 'blueprints' | 'image' | 'media' | 'themes' | 'tts' | 'www' | 'zigbee2mqtt' | 'homematicip';
export type FileKind = FolderKind | 'homeassistant' | 'yaml' | 'json' | 'python' | 'shell' | 'code' | 'database' | 'log' | 'picture' | 'audio' | 'video' | 'text';

// Top-level folders that hold Home Assistant configuration split out of configuration.yaml
// (packages, !include targets) and blueprints. Other YAML, such as themes, dashboards,
// custom_components or zigbee2mqtt/configuration.yaml, stays a plain YAML file.
const HOME_ASSISTANT_FOLDERS = new Set([
  'packages', 'blueprints', 'automations', 'scripts', 'scenes', 'templates', 'sensors', 'binary_sensors',
  'includes', 'integrations', 'entities',
]);
// Icons for well-known top-level folders of a Home Assistant configuration directory.
const FOLDERS: Record<string, FolderKind> = {
  esphome: 'esphome', blueprints: 'blueprints', image: 'image', media: 'media', themes: 'themes', tts: 'tts', www: 'www',
  zigbee2mqtt: 'zigbee2mqtt', homematicip_local: 'homematicip',
};
const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i;
const AUDIO = /\.(mp3|wav|ogg|oga|opus|flac|m4a|aac|weba)$/i;
const VIDEO = /\.(mp4|m4v|mov|webm|ogv|mkv)$/i;
export type PreviewKind = 'image' | 'audio' | 'video';
/** Images, audio and video open in a preview instead of the text editor. */
export const previewKind = (path: string): PreviewKind | null => IMAGE.test(path) ? 'image' : AUDIO.test(path) ? 'audio' : VIDEO.test(path) ? 'video' : null;
export const isImage = (path: string) => IMAGE.test(path);
const EXTENSIONS: Record<string, FileKind> = { json: 'json', py: 'python', sh: 'shell', js: 'code', ts: 'code', html: 'code', css: 'code', xml: 'code' };

export function fileKind(path: string, directory = false): FileKind {
  const parts = path.toLowerCase().split('/');
  const name = parts.at(-1) || '';
  // Only the top-level folders themselves get special icons, not their subfolders.
  if (directory) return (parts.length === 1 && FOLDERS[name]) || 'folder';
  const yaml = /\.ya?ml$/.test(name);
  if (yaml && parts[0] === 'esphome') return 'esphome';
  if (isImage(name)) return 'picture';
  if (AUDIO.test(name)) return 'audio';
  if (VIDEO.test(name)) return 'video';
  if (/\.(db|sqlite3?)(-[a-z]+)?$/.test(name)) return 'database'; // Includes SQLite -shm/-wal/-journal companions.
  if (/\.log(\.[\w-]+)?$/.test(name)) return 'log'; // home-assistant.log, .log.1, .log.old, .log.fault
  if (yaml) return parts.length === 1 || HOME_ASSISTANT_FOLDERS.has(parts[0]) ? 'homeassistant' : 'yaml';
  return EXTENSIONS[name.split('.').pop() || ''] || 'text';
}

/** Dotfiles, dot folders and anything inside them (.storage, .cache, .git…). */
export const isHidden = (path: string) => path.split('/').some(part => part.startsWith('.'));
