import { File, FileCode2, FileJson, FileText, Folder, FolderOpen, Terminal } from 'lucide-react';
import { fileKind } from '@/file-kind';
import haLogo from '@/assets/home-assistant.svg';
import espLogo from '@/assets/esphome.svg';
import { cn } from '@/lib/utils';
export function FileIcon({ path, directory = false, open = false }: { path: string; directory?: boolean; open?: boolean }) {
  const kind = fileKind(path, directory);
  if (kind === 'homeassistant' || kind === 'esphome') return <span title={kind === 'esphome' ? 'ESPHome' : 'Home Assistant'} role="img" aria-label={kind === 'esphome' ? 'ESPHome' : 'Home Assistant'} className={cn('inline-block size-[18px] shrink-0', kind === 'esphome' ? 'bg-foreground' : 'bg-primary')} style={{ mask: `url("${kind === 'esphome' ? espLogo : haLogo}") center / contain no-repeat` }} />;
  const Icon = directory ? open ? FolderOpen : Folder : kind === 'json' ? FileJson : ['yaml', 'code', 'python'].includes(kind) ? FileCode2 : kind === 'shell' ? Terminal : kind === 'text' ? FileText : File;
  return <Icon aria-hidden className={cn('size-[18px] shrink-0', kind === 'yaml' ? 'text-primary' : kind === 'json' ? 'text-amber-600 dark:text-amber-400' : kind === 'code' ? 'text-purple-500' : 'text-muted-foreground')} />;
}
