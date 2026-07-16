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
}

export const WEB_SEARCH_PROGRESS_KEY = 'web_search_progress';

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
