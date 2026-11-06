export function fileKind(path: string, directory = false) {
  const parts = path.toLowerCase().split('/');
  const name = parts.at(-1) || '';
  const yaml = /\.ya?ml$/.test(name);
  if (parts.includes('esphome') && (yaml || directory)) return 'esphome';
  if (directory) return 'folder';
  if (yaml && (/^(configuration|automations?|scripts?|scenes?|secrets|customize(?:_glob|_domain)?|groups?|sensors?|binary_sensors?|switches?|lights?|templates?|helpers?)\.ya?ml$/.test(name)
    || parts.some(part => ['packages', 'blueprints', 'automations', 'scripts', 'scenes'].includes(part)))) return 'homeassistant';
  if (yaml) return 'yaml';
  return ({ json: 'json', py: 'python', sh: 'shell', js: 'code', ts: 'code', html: 'code', css: 'code', xml: 'code' } as Record<string, string>)[name.split('.').pop() || ''] || 'text';
}
