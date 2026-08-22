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

async function fetchImageUrlAsBase64(url: string): Promise<{ imageBase64: string; mime: string } | null> {
  try {
    const normalizedUrl = url.toLowerCase();
    if (normalizedUrl.endsWith('.svg')
      || normalizedUrl.includes('fonts.gstatic.com')
      || normalizedUrl.includes('/productlogos/')) {
      return null;
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
    if (mime === 'image/svg+xml' || !mime.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) return null;
    const bytes = new Uint8Array(buf);
    const isRaster = (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
      || (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
      || (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[8] === 0x57
        && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
    if (!isRaster) return null;
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
    const engine = cover.sourceEngine || 'google';
    return {
      imageBase64: fetched.imageBase64,
      mime: fetched.mime,
      sourceUrl: url,
      provider: `mcp-chrome-${engine}-images`,
      engine,
    };
  }
  return null;
}
