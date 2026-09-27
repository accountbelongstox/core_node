/**
 * Poster / vocabulary-cover image search helpers (Google/Bing via web-search-service).
 * Last verified: 2026-07-11
 */

import { searchBookCoverUrls } from '@/entrypoints/background/services/web-search-service';
import { bytesToBase64, isRasterImageBytes } from '@/utils/binary';
import { fetchRemoteImageBytes } from '@/utils/image-utils';

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

/** Web image query for a vocabulary-library cover when the task has no search_query. */
export function buildLibraryCoverQuery(name: string, category?: string): string {
  const clean = String(name || '').trim();
  if (!clean) return '';
  return [clean, String(category || '').trim(), 'illustration'].filter(Boolean).join(' ');
}

async function fetchImageUrlAsBase64(url: string): Promise<{ imageBase64: string; mime: string } | null> {
  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.endsWith('.svg')
    || normalizedUrl.includes('fonts.gstatic.com')
    || normalizedUrl.includes('/productlogos/')) {
    return null;
  }
  const image = await fetchRemoteImageBytes(url);
  if (!image || image.mime === 'image/svg+xml' || !image.mime.startsWith('image/')) return null;
  if (!isRasterImageBytes(image.bytes)) return null;
  return { imageBase64: bytesToBase64(image.bytes), mime: image.mime };
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
