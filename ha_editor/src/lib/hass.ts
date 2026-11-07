// Live Home Assistant data for completions, read from the frontend this add-on is embedded in.
// Ingress serves the add-on from Home Assistant's own origin, so the iframe can read the
// <home-assistant> element's `hass` object: the logged-in user's states, services and
// registries. No token or extra add-on permission is involved, and nothing is sent anywhere.

export type HassState = { entity_id: string; state: string; attributes: Record<string, unknown> };
export type HassField = { name?: string; description?: string; example?: unknown; required?: boolean; fields?: Record<string, HassField> };
export type HassService = { name?: string; description?: string; fields?: Record<string, HassField> };
type Registry<T> = Record<string, T> | undefined;
export type Hass = {
  states: Record<string, HassState>;
  services: Record<string, Record<string, HassService>>;
  entities?: Registry<{ entity_id: string; name?: string | null; area_id?: string | null; device_id?: string | null; hidden?: boolean }>;
  devices?: Registry<{ id: string; name?: string | null; name_by_user?: string | null; area_id?: string | null; model?: string | null; manufacturer?: string | null }>;
  areas?: Registry<{ area_id: string; name: string; floor_id?: string | null }>;
  floors?: Registry<{ floor_id: string; name: string }>;
};

/** The current hass object, or null outside Home Assistant (or before it has loaded). */
export function getHass(): Hass | null {
  try {
    if (window.parent === window) return null;
    const hass = (window.parent.document.querySelector('home-assistant') as (Element & { hass?: Hass }) | null)?.hass;
    return hass?.states && hass.services ? hass : null;
  } catch { return null; } // Cross-origin parent: not Home Assistant.
}

export const friendlyName = (hass: Hass, entityId: string) => {
  const name = hass.states[entityId]?.attributes.friendly_name ?? hass.entities?.[entityId]?.name;
  return typeof name === 'string' ? name : '';
};
export const deviceName = (device: NonNullable<Hass['devices']>[string]) => device.name_by_user || device.name || device.id;

/** The area of an entity, directly or through its device. */
export function entityArea(hass: Hass, entityId: string) {
  const entry = hass.entities?.[entityId];
  const areaId = entry?.area_id || (entry?.device_id ? hass.devices?.[entry.device_id]?.area_id : undefined);
  return areaId ? hass.areas?.[areaId]?.name ?? '' : '';
}

/** Every known entity ID: current states plus registry entries without a state (e.g. disabled). */
export function entityIds(hass: Hass) {
  return [...new Set([...Object.keys(hass.states), ...Object.keys(hass.entities ?? {})])];
}

/** A service's fields, flattening Home Assistant's collapsible field sections. */
export function serviceFields(service: HassService | undefined) {
  const out: [string, HassField][] = [];
  const walk = (fields: Record<string, HassField> | undefined) => {
    for (const [key, field] of Object.entries(fields ?? {})) field.fields ? walk(field.fields) : out.push([key, field]);
  };
  walk(service?.fields);
  return out;
}

export function lookupService(hass: Hass, id: string) {
  const [domain, name] = id.split('.');
  return name ? hass.services[domain]?.[name] : undefined;
}
