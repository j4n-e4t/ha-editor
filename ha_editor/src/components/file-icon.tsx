import { Database, File, FileCode2, FileImage, FileJson, FileText, Folder, FolderOpen, Globe, Image, Palette, ScrollText, Speech, SquarePlay, SwatchBook, Terminal, type LucideIcon } from 'lucide-react';
import { fileKind, type FileKind } from '@/file-kind';
import haLogo from '@/assets/home-assistant.svg';
import espLogo from '@/assets/esphome.svg';
import z2mLogo from '@/assets/zigbee2mqtt.svg';
import hmipLogo from '@/assets/homematic-ip.svg';
import { cn } from '@/lib/utils';

// Brand logos are drawn as masks so they follow the theme like the other icons.
const BRANDS: Partial<Record<FileKind, { label: string; src: string; color: string }>> = {
  homeassistant: { label: 'Home Assistant', src: haLogo, color: 'bg-primary' },
  esphome: { label: 'ESPHome', src: espLogo, color: 'bg-foreground' },
  zigbee2mqtt: { label: 'Zigbee2MQTT', src: z2mLogo, color: 'bg-muted-foreground' },
  homematicip: { label: 'Homematic IP', src: hmipLogo, color: 'bg-muted-foreground' },
};
const ICONS: Partial<Record<FileKind, LucideIcon>> = {
  json: FileJson, yaml: FileCode2, code: FileCode2, python: FileCode2, shell: Terminal, database: Database, log: ScrollText, picture: FileImage, text: FileText,
  blueprints: SwatchBook, image: Image, media: SquarePlay, themes: Palette, tts: Speech, www: Globe,
};
const COLORS: Partial<Record<FileKind, string>> = {
  yaml: 'text-primary', json: 'text-amber-600 dark:text-amber-400', code: 'text-purple-500', python: 'text-sky-700 dark:text-sky-400',
  database: 'text-teal-600 dark:text-teal-400', picture: 'text-rose-500 dark:text-rose-400',
};

export function FileIcon({ path, directory = false, open = false }: { path: string; directory?: boolean; open?: boolean }) {
  const kind = fileKind(path, directory);
  const brand = BRANDS[kind];
  if (brand) return <span role="img" aria-label={brand.label} className={cn('inline-block size-[18px] shrink-0', brand.color)} style={{ mask: `url("${brand.src}") center / contain no-repeat` }} />;
  const Icon = ICONS[kind] || (kind === 'folder' ? open ? FolderOpen : Folder : File);
  return <Icon aria-hidden className={cn('size-[18px] shrink-0', COLORS[kind] || 'text-muted-foreground')} />;
}
