import { STORAGE_KEYS } from '@/utils/storage-keys';

/**
 * Web search core — shared types, URL builders, CAPTCHA hints.
 * Last verified against live Google/Bing result pages: 2026-07-11
 */

export const WEB_SEARCH_LAST_VERIFIED = '2026-07-11';

export type WebSearchEngine = 'google' | 'bing';
export type WebSearchMode = 'web' | 'images' | 'news';

export type WebSearchStatus =
  | 'ok'
  | 'verification_required'
  | 'verification_timeout'
  | 'no_results'
  | 'error';

export interface WebSearchTextHit {
  title: string;
  url: string;
  snippet: string;
  engine: WebSearchEngine;
  mode: WebSearchMode;
}

export interface WebSearchImageHit {
  title: string;
  imageUrl: string;
  thumbnailUrl: string;
  pageUrl: string;
  width: number;
  height: number;
  engine: WebSearchEngine;
}

const SEARCH_TOKEN_MIN_LENGTH = 3;
const SEARCH_STOP_WORDS = new Set([
  'and',
  'book',
  'cover',
  'for',
  'from',
  'image',
  'images',
  'poster',
  'the',
  'with',
]);
const REJECTED_IMAGE_URL_PARTS = [
  'accounts.google.com/',
  'explicit.bing.net/',
  'fonts.gstatic.com/',
  'pimpandhost.com/',
  'pictoa.com/',
  'productlogos/',
  'rule34.',
  'sex.com/',
  'ssl.gstatic.com/gb/',
];

export interface WebSearchRequest {
  query: string;
  engine?: WebSearchEngine;
  mode?: WebSearchMode;
  maxResults?: number;
  /** When true, poll until CAPTCHA clears or verificationTimeoutMs elapses. */
  waitForVerification?: boolean;
  verificationTimeoutMs?: number;
  openInNewTab?: boolean;
  tabId?: number;
  /** Skip OPFS cover cache (used when caller already checked cache). */
  skipCoverCache?: boolean;
}

export interface WebSearchResult {
  ok: boolean;
  status: WebSearchStatus;
  query: string;
  engine: WebSearchEngine;
  mode: WebSearchMode;
  message: string;
  url: string;
  tabId?: number;
  textResults: WebSearchTextHit[];
  imageResults: WebSearchImageHit[];
  elapsedMs: number;
  lastVerified: string;
  error?: string;
  fromCache?: boolean;
  cacheKey?: string;
}

export interface BookCoverSearchResult {
  ok: boolean;
  coverUrls: string[];
  coverUrl: string;
  sourceEngine: WebSearchEngine | '';
  status: WebSearchStatus;
  message: string;
  fromCache?: boolean;
  cacheKey?: string;
  attempts?: Array<{
    engine: WebSearchEngine;
    status: WebSearchStatus;
    resultCount: number;
    message: string;
  }>;
}

function searchTokens(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= SEARCH_TOKEN_MIN_LENGTH && !SEARCH_STOP_WORDS.has(token));
}

export function isSearchImageCandidate(
  hit: WebSearchImageHit,
  query: string,
): boolean {
  const imageUrl = String(hit.imageUrl || '').trim();
  const normalizedUrl = imageUrl.toLowerCase();
  if (!/^https?:\/\//i.test(imageUrl)) return false;
  if (normalizedUrl.endsWith('.svg')) return false;
  if (REJECTED_IMAGE_URL_PARTS.some((part) => normalizedUrl.includes(part))) return false;
  if (hit.width > 0 && hit.height > 0 && Math.max(hit.width, hit.height) < 128) return false;

  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const searchable = `${hit.title} ${hit.pageUrl} ${hit.imageUrl}`.toLowerCase();
  return tokens.some((token) => searchable.includes(token));
}

export function filterSearchImageResults(
  hits: WebSearchImageHit[],
  query: string,
): WebSearchImageHit[] {
  return hits.filter((hit) => isSearchImageCandidate(hit, query));
}

export const WEB_SEARCH_PROGRESS_KEY = STORAGE_KEYS.WEB_SEARCH_PROGRESS;

export interface WebSearchProgress {
  running: boolean;
  phase: string;
  detail: string;
  query: string;
  engine: WebSearchEngine;
  mode: WebSearchMode;
  status: WebSearchStatus | 'idle';
  tabId: number | null;
  updatedAt: number;
}

export function emptyWebSearchProgress(): WebSearchProgress {
  return {
    running: false,
    phase: 'Idle',
    detail: '',
    query: '',
    engine: 'bing',
    mode: 'web',
    status: 'idle',
    tabId: null,
    updatedAt: Date.now(),
  };
}

export function buildSearchUrl(
  query: string,
  engine: WebSearchEngine = 'bing',
  mode: WebSearchMode = 'web',
): string {
  const q = encodeURIComponent(query.trim());
  if (engine === 'google') {
    if (mode === 'images') {
      return `https://www.google.com/search?q=${q}&udm=2`;
    }
    if (mode === 'news') {
      return `https://www.google.com/search?q=${q}&tbm=nws`;
    }
    return `https://www.google.com/search?q=${q}`;
  }
  if (mode === 'images') {
    return `https://www.bing.com/images/search?q=${q}&first=1`;
  }
  if (mode === 'news') {
    return `https://www.bing.com/news/search?q=${q}`;
  }
  return `https://www.bing.com/search?q=${q}`;
}

export function bookCoverQuery(title: string, author: string): string {
  const parts = [title, author, 'book cover'].filter((p) => String(p || '').trim());
  return parts.join(' ').trim();
}

export function isVerificationUrl(url: string): boolean {
  const u = String(url || '').toLowerCase();
  return (
    u.includes('/sorry/') ||
    u.includes('google.com/sorry') ||
    u.includes('ipv4.google.com/sorry') ||
    u.includes('bing.com/challenge') ||
    u.includes('/challenge/') ||
    u.includes('captcha')
  );
}

export function engineHost(engine: WebSearchEngine): string {
  return engine === 'google' ? 'google.com' : 'bing.com';
}

export function isEngineSearchUrl(url: string, engine: WebSearchEngine): boolean {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const expectedHost = engineHost(engine);
  const hostMatches = host === expectedHost || host.endsWith(`.${expectedHost}`);
  if (!hostMatches) return false;

  return engine === 'google'
    ? parsed.pathname === '/search'
    : parsed.pathname === '/search' || parsed.pathname === '/images/search' || parsed.pathname === '/news/search';
}

export function matchesSearchUrl(actualUrl: string, expectedUrl: string): boolean {
  let actual: URL;
  let expected: URL;

  try {
    actual = new URL(actualUrl);
    expected = new URL(expectedUrl);
  } catch {
    return actualUrl === expectedUrl;
  }

  return actual.origin === expected.origin
    && actual.pathname === expected.pathname
    && actual.searchParams.get('q') === expected.searchParams.get('q');
}
