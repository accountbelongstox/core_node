/**
 * Poster / vocabulary-cover image search helpers (Google/Bing via web-search-service).
 * Last verified: 2026-07-11
 */

import { searchBookCoverUrls } from '@/entrypoints/background/services/web-search-service';

export interface ResolvedPosterImage {
  imageBase64: string;
  mime: string;
  sourceUrl: string;
  provider: string;
  engine: string;
}

export function buildPosterQuery(
  title: string,
  year?: number | null,
  kind: 'book' | 'movie' = 'book',
): string {
  const clean = String(title || '').trim();
  if (!clean) return '';
  const suffix = kind === 'book' ? 'book cover' : 'movie poster';
  const parts = [clean];
  if (year) parts.push(String(year));
  parts.push(suffix);
  return parts.join(' ').trim();
}

export function buildVocabCoverQuery(name: string, prompt?: string): string {
  const label = String(name || '').trim();
  if (label) return `${label} vocabulary book cover`;
  const hint = String(prompt || '').trim().slice(0, 80);
  return hint ? `${hint} book cover` : 'vocabulary book cover';
}

async function fetchImageUrlAsBase64(url: string): Promise<{ imageBase64: string; mime: string } | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) return null;
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { imageBase64: btoa(binary), mime };
  } catch {
    return null;
  }
}

/**
 * Search Google then Bing images and return the first downloadable poster/cover.
 */
export async function resolvePosterImageFromSearch(
  query: string,
  options: { waitForVerification?: boolean } = {},
): Promise<ResolvedPosterImage | null> {
  const clean = String(query || '').trim();
  if (!clean) return null;

  const cover = await searchBookCoverUrls(clean, '', {
    waitForVerification: options.waitForVerification ?? false,
  });
  if (!cover.ok || !cover.coverUrls.length) return null;

  for (const url of cover.coverUrls) {
    const fetched = await fetchImageUrlAsBase64(url);
    if (!fetched) continue;
    return {
      imageBase64: fetched.imageBase64,
      mime: fetched.mime,
      sourceUrl: url,
      provider: 'mcp-chrome-google-images',
      engine: cover.sourceEngine || 'google',
    };
  }
  return null;
}
