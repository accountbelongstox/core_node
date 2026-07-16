/** Cover carousel playback — wordnew home cards and library rows. */
export const COVER_ROTATE_INTERVAL_MS = 4000;
export const COVER_FADE_MS = 400;
export const COVER_MAX_IMAGES = 10;

export type CoverUrlInput = string | string[] | null | undefined;

/** Normalize backend cover_url (string) or image_urls (array) to a deduped list. */
export function resolveCoverUrls(primary?: string | null, extras?: CoverUrlInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const url = raw.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  if (primary) push(primary);
  if (Array.isArray(extras)) {
    for (const u of extras) {
      if (typeof u === 'string') push(u);
    }
  } else if (typeof extras === 'string' && extras) {
    push(extras);
  }

  return out.slice(0, COVER_MAX_IMAGES);
}

export function primaryCoverUrl(urls: string[], fallback?: string): string | undefined {
  if (urls.length > 0) return urls[0];
  return fallback || undefined;
}
