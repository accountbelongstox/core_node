/** Cover carousel playback — wordnew home cards and library rows. */
export const COVER_ROTATE_INTERVAL_MS = 4000;
export const COVER_FADE_MS = 400;
/** Multi-cover contract: each book shows its latest 5 covers. */
export const COVER_MAX_IMAGES = 5;

/** Carousel transition styles. Cards pick one deterministically (per-book hash)
 *  so the home grid mixes left/right/up/down slides and rounded zoom reveals. */
export type CoverCarouselMode = 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom-reveal';

export const COVER_CAROUSEL_MODES: CoverCarouselMode[] = [
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'zoom-reveal',
];

/** Small stable string hash (FNV-1a 32-bit) for per-card variation. */
export function coverSeedHash(seed: string): number {
  let result = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    result ^= seed.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

/** Deterministic carousel mode for one card (stable across renders). */
export function coverCarouselMode(seed: string): CoverCarouselMode {
  return COVER_CAROUSEL_MODES[coverSeedHash(seed) % COVER_CAROUSEL_MODES.length];
}

/**
 * Per-card rotation interval: 3.2s–6.4s derived from the card seed so the grid
 * never refreshes every cover in lockstep.
 */
export function coverRotateInterval(seed: string): number {
  const spread = coverSeedHash(`interval:${seed}`) % 3200;
  return 3200 + spread;
}

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
