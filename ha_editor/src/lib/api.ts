export async function api<T>(route: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`./api/${route}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
export type Match = { path: string; line: number; column: number; length: number; preview: string; previewOffset: number };
