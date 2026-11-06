import { useSyncExternalStore } from 'react';

// Integration with the Home Assistant frontend when running as an ingress panel.
// Ingress serves the add-on from Home Assistant's own origin, so the iframe can read the
// live theme variables from the parent document (including custom themes and the user's
// dark-mode choice) and use the ha-panel-app postMessage protocol for layout properties.

const THEME_VARIABLES = [
  'primary-color', 'accent-color', 'primary-text-color', 'secondary-text-color', 'disabled-text-color', 'text-primary-color',
  'primary-background-color', 'secondary-background-color', 'card-background-color', 'divider-color',
  'error-color', 'warning-color', 'success-color', 'info-color',
  'sidebar-background-color', 'sidebar-text-color', 'sidebar-icon-color', 'sidebar-selected-text-color', 'sidebar-selected-icon-color',
  'app-header-background-color', 'app-header-text-color', 'app-header-border-bottom',
  'header-height', 'ha-font-family-body', 'scrollbar-thumb-color',
];
const NARROW_QUERY = '(max-width: 870px)'; // Home Assistant's own narrow breakpoint.

type State = { embedded: boolean; narrow: boolean; dark: boolean; theme: number };
const listeners = new Set<() => void>();
let state: State = { embedded: false, narrow: matchMedia(NARROW_QUERY).matches, dark: false, theme: 0 };
function update(next: Partial<State>) {
  const merged = { ...state, ...next };
  if (merged.embedded === state.embedded && merged.narrow === state.narrow && merged.dark === state.dark && merged.theme === state.theme) return;
  state = merged; listeners.forEach(listener => listener());
}
export function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const getState = () => state;
export function useHomeAssistant() { return useSyncExternalStore(subscribe, getState); }

function parentDocument(): Document | null {
  try { return window.parent !== window ? window.parent.document : null; } catch { return null; } // Cross-origin: not inside Home Assistant.
}

const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
const context = canvas.getContext('2d', { willReadFrequently: true })!;
/** Resolves any CSS color (including oklch or color-mix) to #rrggbb or #rrggbbaa. */
export function toHex(color: string, fallback = '#000000') {
  if (!color) return fallback;
  context.clearRect(0, 0, 1, 1); context.fillStyle = fallback; context.fillStyle = color; context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}${a < 255 ? hex(a) : ''}`;
}
export const cssVariable = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
const luminance = (hex: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

const system = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const root = document.documentElement; const parent = parentDocument();
  if (parent) {
    const computed = getComputedStyle(parent.documentElement);
    for (const name of THEME_VARIABLES) {
      const value = computed.getPropertyValue(`--${name}`).trim();
      if (value) root.style.setProperty(`--${name}`, value); else root.style.removeProperty(`--${name}`);
    }
  }
  // Inside Home Assistant the background decides; standalone follows the system.
  const dark = parent ? luminance(toHex(cssVariable('primary-background-color'), '#fafafa')) < 0.5 : system.matches;
  root.dataset.theme = dark ? 'dark' : 'light'; root.style.colorScheme = dark ? 'dark' : 'light';
  update({ dark, theme: state.theme + 1 }); // Always notify: colors may change without switching modes.
}

export function connectHomeAssistant() {
  const parent = parentDocument();
  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(applyTheme); };
  applyTheme();
  system.addEventListener('change', schedule);
  if (!parent) {
    const narrow = matchMedia(NARROW_QUERY);
    narrow.addEventListener('change', () => update({ narrow: narrow.matches }));
    return;
  }
  // Home Assistant applies themes as inline styles on <html> and as <style> elements in <head>.
  const observer = new MutationObserver(schedule);
  observer.observe(parent.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
  observer.observe(parent.head, { childList: true, subtree: true, characterData: true });
  window.parent.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'home-assistant/properties') return;
    update({ embedded: true, narrow: !!event.data.narrow });
  });
  window.parent.postMessage({ type: 'home-assistant/subscribe-properties' }, location.origin);
  window.addEventListener('pagehide', () => window.parent.postMessage({ type: 'home-assistant/unsubscribe-properties' }, location.origin));
  update({ embedded: true });
}
