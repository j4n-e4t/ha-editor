import { Database, File, FileAudio, FileCode2, FileImage, FileVideo, FileText, Folder, FolderOpen, Globe, Image, Palette, ScrollText, Speech, SquarePlay, SwatchBook, Terminal, type LucideIcon } from 'lucide-react';
import { fileKind, type FileKind } from '@/file-kind';
import haLogo from '@/assets/home-assistant.svg';
import espLogo from '@/assets/esphome.svg';
import z2mLogo from '@/assets/zigbee2mqtt.svg';
import hmipLogo from '@/assets/homematic-ip.svg';
import pythonLogo from '@/assets/python.svg';
import javascriptLogo from '@/assets/javascript.svg';
import typescriptLogo from '@/assets/typescript.svg';
import jsonLogo from '@/assets/json.svg';
import yamlLogo from '@/assets/yaml.svg';
import { cn } from '@/lib/utils';

// Brand logos are drawn as masks so they follow the theme like the other icons. Their artwork fills the
// whole 24px box, so it is scaled to 20/24 to match the 2px padding inside Lucide's icons.
const BRANDS: Partial<Record<FileKind, { label: string; src: string; color: string }>> = {
  homeassistant: { label: 'Home Assistant', src: haLogo, color: 'bg-primary' },
  esphome: { label: 'ESPHome', src: espLogo, color: 'bg-primary' },
  zigbee2mqtt: { label: 'Zigbee2MQTT', src: z2mLogo, color: 'bg-[#e8a800] dark:bg-[#ffc135]' },
  homematicip: { label: 'Homematic IP', src: hmipLogo, color: 'bg-[#005282] dark:bg-[#2f6fa8]' },
  // Language logos (Simple Icons) in their brand colors, lightened or darkened where needed for contrast.
  python: { label: 'Python', src: pythonLogo, color: 'bg-[#3776ab] dark:bg-[#5a9fd4]' },
  javascript: { label: 'JavaScript', src: javascriptLogo, color: 'bg-[#c9a800] dark:bg-[#f7df1e]' },
  typescript: { label: 'TypeScript', src: typescriptLogo, color: 'bg-[#3178c6] dark:bg-[#4f94e0]' },
  json: { label: 'JSON', src: jsonLogo, color: 'bg-amber-600 dark:bg-amber-400' },
  yaml: { label: 'YAML', src: yamlLogo, color: 'bg-[#cb171e] dark:bg-[#f05a5f]' },
};
const ICONS: Partial<Record<FileKind, LucideIcon>> = {
  code: FileCode2, shell: Terminal, database: Database, log: ScrollText, picture: FileImage, audio: FileAudio, video: FileVideo, text: FileText,
  blueprints: SwatchBook, image: Image, media: SquarePlay, themes: Palette, tts: Speech, www: Globe,
};
const COLORS: Partial<Record<FileKind, string>> = {
  code: 'text-purple-500',
  database: 'text-teal-600 dark:text-teal-400', picture: 'text-rose-500 dark:text-rose-400', audio: 'text-violet-500 dark:text-violet-400', video: 'text-orange-500 dark:text-orange-400',
};

export function FileIcon({ path, directory = false, open = false }: { path: string; directory?: boolean; open?: boolean }) {
  const kind = fileKind(path, directory);
  const brand = BRANDS[kind];
  if (brand) return <span role="img" aria-label={brand.label} className={cn('inline-block size-[18px] shrink-0', brand.color)} style={{ mask: `url("${brand.src}") center / 83.333% no-repeat` }} />;
  const Icon = ICONS[kind] || (kind === 'folder' ? open ? FolderOpen : Folder : File);
  return <Icon aria-hidden className={cn('size-[18px] shrink-0', COLORS[kind] || 'text-muted-foreground')} />;
}
