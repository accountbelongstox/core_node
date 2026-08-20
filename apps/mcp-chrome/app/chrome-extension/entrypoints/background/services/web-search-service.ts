/**
 * Web search service — Google/Bing tab automation with verification wait.
 * Callable from popup, Duoreader importer, and MCP tool.
 * Last verified: 2026-07-11
 */

import { logger } from '@/utils/logger';
import { toErrorMessage } from '@/utils/errors';
import { delay as waitForDelay } from '@/utils/async';
import { createProgressStorage } from '@/utils/progress-storage';
import { webSearchTool } from '../tools/browser/web-search';
import { COVER_SEARCH_MAX, normalizeCoverUrls } from '@/utils/cover-playback';
import {
  peekCoverSearchCache,
  saveCoverSearchCache,
} from '@/utils/web-search-cover-cache';
import {
  WEB_SEARCH_LAST_VERIFIED,
  WEB_SEARCH_PROGRESS_KEY,
  type BookCoverSearchResult,
  type WebSearchEngine,
  type WebSearchMode,
  type WebSearchProgress,
  type WebSearchRequest,
  type WebSearchResult,
  bookCoverQuery,
  buildSearchUrl,
  emptyWebSearchProgress,
  filterBookCoverImageResults,
} from '@/utils/web-search-core';

const LOG = 'Web Search';
const webSearchProgressStorage = createProgressStorage<WebSearchProgress>(
  WEB_SEARCH_PROGRESS_KEY,
  emptyWebSearchProgress,
);

export async function saveWebSearchProgress(patch: Partial<WebSearchProgress>): Promise<void> {
  await webSearchProgressStorage.update(patch);
}

export async function getWebSearchProgress(): Promise<WebSearchProgress> {
  return webSearchProgressStorage.get();
}

/**
 * Primary API for extension modules and MCP tool.
 */
export async function runWebSearch(request: WebSearchRequest): Promise<WebSearchResult> {
  const started = Date.now();
  const engine = request.engine || 'bing';
  const mode = request.mode || 'web';
  const query = String(request.query || '').trim();

  await saveWebSearchProgress({
    running: true,
    phase: 'Searching',
    detail: `${engine} · ${mode}`,
    query,
    engine,
    mode,
    status: 'idle',
    tabId: request.tabId ?? null,
  });

  if (!query) {
    await saveWebSearchProgress({ running: false, phase: 'Error', detail: 'Empty query', status: 'error' });
    return {
      ok: false,
      status: 'error',
      query: '',
      engine,
      mode,
      message: 'Query is required',
      url: '',
      textResults: [],
      imageResults: [],
      elapsedMs: Date.now() - started,
      lastVerified: WEB_SEARCH_LAST_VERIFIED,
      error: 'Query is required',
    };
  }

  if (mode === 'images' && !request.skipCoverCache) {
    const cached = await peekCoverSearchCache(query, engine);
    if (cached.hit) {
      const imageResults = cached.manifest.images.map((rec) => ({
        title: query,
        imageUrl: rec.remoteUrl,
        thumbnailUrl: rec.remoteUrl,
        pageUrl: rec.remoteUrl,
        width: 0,
        height: 0,
        engine,
      }));
      const message = `Image results from OPFS cache (${imageResults.length})`;
      logger.info(LOG, `${message} · ${cached.manifest.cacheKey}`);
      await saveWebSearchProgress({
        running: false,
        phase: 'Done',
        detail: message,
        query,
        engine,
        mode,
        status: 'ok',
        tabId: request.tabId ?? null,
      });
      return {
        ok: true,
        status: 'ok',
        query,
        engine,
        mode,
        message,
        url: buildSearchUrl(query, engine, mode),
        tabId: request.tabId,
        textResults: [],
        imageResults,
        elapsedMs: Date.now() - started,
        lastVerified: WEB_SEARCH_LAST_VERIFIED,
        fromCache: true,
        cacheKey: cached.manifest.cacheKey,
      };
    }
  }

  try {
    const toolResult = await webSearchTool.execute({
      query,
      engine,
      mode,
      maxResults: request.maxResults ?? 10,
      waitForVerification: request.waitForVerification ?? false,
      verificationTimeoutMs: request.verificationTimeoutMs ?? 120_000,
      openInNewTab: request.openInNewTab ?? false,
      tabId: request.tabId,
    });

    const text = toolResult.content?.[0]?.type === 'text' ? toolResult.content[0].text : '';
    let parsed = text ? JSON.parse(text) as WebSearchResult : null;
    if (!parsed) {
      throw new Error('Empty tool response');
    }

    await saveWebSearchProgress({
      running: false,
      phase: parsed.status === 'verification_required' || parsed.status === 'verification_timeout'
        ? 'Verification'
        : parsed.ok ? 'Done' : 'No results',
      detail: parsed.message,
      query,
      engine: parsed.engine,
      mode: parsed.mode,
      status: parsed.status,
      tabId: parsed.tabId ?? null,
    });

    if (
      mode === 'images'
      && !request.skipCoverCache
      && parsed.ok
      && parsed.status === 'ok'
      && parsed.imageResults.length
    ) {
      const remoteUrls = parsed.imageResults.map((hit) => hit.imageUrl).filter(Boolean);
      const saved = await saveCoverSearchCache(query, engine, remoteUrls);
      if (!saved.skipped) {
        parsed = {
          ...parsed,
          message: `${parsed.message} (cached ${saved.savedUrls.length})`,
          cacheKey: saved.cacheKey,
          fromCache: false,
        };
      }
    }

    return parsed;
  } catch (err) {
    const message = toErrorMessage(err);
    logger.error(LOG, message, err);
    await saveWebSearchProgress({ running: false, phase: 'Error', detail: message, status: 'error' });
    return {
      ok: false,
      status: 'error',
      query,
      engine,
      mode,
      message,
      url: buildSearchUrl(query, engine, mode),
      textResults: [],
      imageResults: [],
      elapsedMs: Date.now() - started,
      lastVerified: WEB_SEARCH_LAST_VERIFIED,
      error: message,
    };
  }
}

/**
 * Resolve up to COVER_SEARCH_MAX book covers via image search (Google then Bing).
 */
export async function searchBookCoverUrls(
  title: string,
  author: string,
  options: { waitForVerification?: boolean; preferEngine?: WebSearchEngine } = {},
): Promise<BookCoverSearchResult> {
  const query = bookCoverQuery(title, author);
  const prefer = options.preferEngine || 'google';
  const engines: WebSearchEngine[] = prefer === 'google' ? ['google', 'bing'] : ['bing', 'google'];
  const attempts: NonNullable<BookCoverSearchResult['attempts']> = [];

  for (const engine of engines) {
    const cached = await peekCoverSearchCache(query, engine);
    if (cached.hit) {
      logger.info(LOG, `Cover cache hit (${engine}): ${cached.remoteUrls.length} image(s) · ${cached.manifest.cacheKey}`);
      return {
        ok: true,
        coverUrls: cached.remoteUrls,
        coverUrl: cached.remoteUrls[0] || '',
        sourceEngine: engine,
        status: 'ok',
        message: `Covers from OPFS cache (${cached.remoteUrls.length})`,
        fromCache: true,
        cacheKey: cached.manifest.cacheKey,
      };
    }

    const result = await runWebSearch({
      query,
      engine,
      mode: 'images',
      maxResults: COVER_SEARCH_MAX,
      waitForVerification: options.waitForVerification ?? false,
      verificationTimeoutMs: 90_000,
      openInNewTab: false,
      skipCoverCache: true,
    });
    const coverResults = filterBookCoverImageResults(result.imageResults, title, author);
    attempts.push({
      engine,
      status: result.status,
      resultCount: coverResults.length,
      message: result.message,
    });

    if (result.status === 'verification_required' || result.status === 'verification_timeout') {
      if (engine === engines[engines.length - 1]) {
        return {
          ok: false,
          coverUrls: [],
          coverUrl: '',
          sourceEngine: engine,
          status: result.status,
          message: result.message,
          attempts,
        };
      }
      continue;
    }

    const remoteUrls = coverResults
      .map((hit) => hit.imageUrl)
      .filter(Boolean)
      .slice(0, COVER_SEARCH_MAX);

    if (remoteUrls.length) {
      const saved = await saveCoverSearchCache(query, engine, remoteUrls);
      const coverUrls = saved.savedUrls.length ? saved.savedUrls : remoteUrls;
      return {
        ok: true,
        coverUrls,
        coverUrl: coverUrls[0],
        sourceEngine: engine,
        status: 'ok',
        message: saved.skipped
          ? `Covers from ${engine} images (${coverUrls.length}, cache skip)`
          : `Covers from ${engine} images (${coverUrls.length}, cached)`,
        fromCache: false,
        cacheKey: saved.cacheKey,
      };
    }
  }

  return {
    ok: false,
    coverUrls: [],
    coverUrl: '',
    sourceEngine: '',
    status: 'no_results',
    message: 'No cover images found',
    attempts,
  };
}

async function loadCachedCoverUrls(title: string, author: string): Promise<string[] | null> {
  const query = bookCoverQuery(title, author);
  const engines: WebSearchEngine[] = ['google', 'bing'];
  for (const engine of engines) {
    const cached = await peekCoverSearchCache(query, engine);
    if (cached.hit && cached.remoteUrls.length) {
      return cached.remoteUrls;
    }
  }
  return null;
}

export async function enrichBookCovers<
  T extends { titleEn: string; authorEn: string; coverUrl: string; coverUrls?: string[] },
>(
  books: T[],
  options: { waitForVerification?: boolean; onlyMissing?: boolean } = {},
): Promise<T[]> {
  const onlyMissing = options.onlyMissing !== false;
  const out: T[] = [];

  for (const book of books) {
    const existing = book.coverUrls?.length ? book.coverUrls : book.coverUrl ? [book.coverUrl] : [];
    if (onlyMissing) {
      const cachedUrls = await loadCachedCoverUrls(book.titleEn, book.authorEn);
      if (cachedUrls?.length) {
        const coverUrls = normalizeCoverUrls(existing[0] || book.coverUrl, cachedUrls);
        out.push({
          ...book,
          coverUrls,
          coverUrl: coverUrls[0] || book.coverUrl || '',
        });
        continue;
      }
    }

    await saveWebSearchProgress({
      running: true,
      phase: 'Book cover',
      detail: book.titleEn,
      query: bookCoverQuery(book.titleEn, book.authorEn),
      engine: 'google',
      mode: 'images',
      status: 'idle',
      tabId: null,
    });

    const cover = await searchBookCoverUrls(book.titleEn, book.authorEn, {
      waitForVerification: options.waitForVerification ?? false,
    });

    const coverUrls = cover.ok && cover.coverUrls.length
      ? normalizeCoverUrls(existing[0] || book.coverUrl, cover.coverUrls)
      : existing;

    out.push({
      ...book,
      coverUrls,
      coverUrl: coverUrls[0] || book.coverUrl || '',
    });

    await waitForDelay(800);
  }

  await saveWebSearchProgress({ running: false, phase: 'Idle', detail: '', status: 'idle' });
  return out;
}
