/** Cover carousel timing — shared by Duoreader popup and ingest metadata. */
export const COVER_SEARCH_MAX = 5;
export const COVER_ROTATE_INTERVAL_MS = 4000;
export const COVER_FADE_MS = 400;

export function normalizeCoverUrls(primary: string, extras: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [primary, ...extras]) {
    const url = String(raw || '').trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= COVER_SEARCH_MAX) break;
  }
  return out;
}

export function primaryCoverUrl(urls: string[] | undefined, fallback = ''): string {
  if (urls?.length) return urls[0];
  return fallback;
}
