import { CapResourcePackage } from '@/shared/capabilities';
import { wfNewEndpoints } from '../api/WfNewEndpoints';
import { preloadAudioFromPayload } from './WfNewAudioCache';

const resourcePackage = new CapResourcePackage({
  dbName: 'wordnew_resources',
  collection: 'server_responses',
  namespace: 'wordnew',
  defaultTtlMs: 5 * 60 * 1000,
  onValue: preloadAudioFromPayload,
});

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function scopeFor(token: string | null): string {
  return token ? `user-${hash(token)}` : 'public';
}

function resourceKey(path: string, variant = 'GET'): string {
  const endpointId = wfNewEndpoints.getCurrentEndpoint()?.id ?? 'unknown';
  return `${endpointId}|${variant}|${path}`;
}

function ttlFor(path: string): number {
  if (/\/(social|friends|nearby|live|messages|notifications|presence)(\/|\?|$)/i.test(path)) {
    return 15 * 1000;
  }
  if (/\/(profile|statistics|progress|daily)(\/|\?|$)/i.test(path)) return 30 * 1000;
  if (/\/recitation(\/|\?|$)/i.test(path)) return 30 * 1000;
  if (/\/(query_gwords|group\/get_words|words?|vocabulary)(\/|\?|$)/i.test(path)) {
    return 15 * 60 * 1000;
  }
  if (/\/(media|articles?)(\/|\?|$)/i.test(path)) return 60 * 60 * 1000;
  return 5 * 60 * 1000;
}

function staticMediaResponseIsUsable(path: string, payload: unknown): boolean {
  if (!/\/media\/(books|subtitles)(\/|\?|$)/i.test(path)) return true;
  const items = (payload as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0) return false;
  return items.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as { image_url?: unknown; image_urls?: unknown };
    const primary = typeof row.image_url === 'string' && row.image_url.trim() !== '';
    const extras = Array.isArray(row.image_urls)
      && row.image_urls.some((url) => typeof url === 'string' && url.trim() !== '');
    return primary || extras;
  });
}

export function requestVariant(method: string, body?: unknown): string {
  if (body === undefined) return method.toUpperCase();
  return `${method.toUpperCase()}:${hash(stableSerialize(body))}`;
}

export function queryServerResource<T>(
  path: string,
  token: string | null,
  fetchRemote: () => Promise<T>,
  variant = 'GET',
): Promise<T> {
  return resourcePackage.query({
    key: resourceKey(path, variant),
    scope: scopeFor(token),
    fetchRemote,
    ttlMs: ttlFor(path),
    refresh: 'stale',
    isUsable: (payload) => staticMediaResponseIsUsable(path, payload),
  });
}

export async function mirrorServerResponse(
  path: string,
  payload: unknown,
  token: string | null,
  variant = 'GET',
): Promise<void> {
  await resourcePackage.put(resourceKey(path, variant), payload, {
    scope: scopeFor(token),
    ttlMs: ttlFor(path),
  });
}

export async function readMirroredResponse<T>(
  path: string,
  token: string | null,
  variant = 'GET',
): Promise<T | null> {
  const record = await resourcePackage.get<T>(resourceKey(path, variant), scopeFor(token));
  if (!record) return null;
  preloadAudioFromPayload(record.payload);
  return record.payload;
}

export function removeMirroredResponse(
  path: string,
  token: string | null,
  variant = 'GET',
): Promise<boolean> {
  return resourcePackage.remove(resourceKey(path, variant), scopeFor(token));
}

export function clearServerMirror(): Promise<boolean> {
  return resourcePackage.clear();
}

export function serverResourceStats(): Promise<{ records: number; bytes: number }> {
  return resourcePackage.stats();
}
