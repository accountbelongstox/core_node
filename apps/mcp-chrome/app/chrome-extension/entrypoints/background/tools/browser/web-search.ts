import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { logger } from '@/utils/logger';
import { AsyncMutex, delay as waitForDelay } from '@/utils/async';
import {
  WEB_SEARCH_LAST_VERIFIED,
  buildSearchUrl,
  filterSearchImageResults,
  isEngineSearchUrl,
  matchesSearchUrl,
  isVerificationUrl,
  type WebSearchEngine,
  type WebSearchMode,
  type WebSearchResult,
  type WebSearchStatus,
} from '@/utils/web-search-core';
import { waitForTabComplete } from '@/utils/tab-readiness';

const LOG = 'Web Search Tool';
const HELPER_SCRIPT = 'inject-scripts/web-search-helper.js';
const IMAGE_RESULTS_SETTLE_TIMEOUT_MS = 5_000;
const IMAGE_RESULTS_RETRY_DELAY_MS = 500;
const WEB_SEARCH_MUTEX = new AsyncMutex();

interface WebSearchParams {
  query: string;
  engine?: WebSearchEngine;
  mode?: WebSearchMode;
  maxResults?: number;
  waitForVerification?: boolean;
  verificationTimeoutMs?: number;
  openInNewTab?: boolean;
  tabId?: number;
}

class WebSearchTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.WEB_SEARCH;

  async execute(args: WebSearchParams): Promise<ToolResult> {
    const release = await WEB_SEARCH_MUTEX.acquire();
    try {
      return await this.executeExclusive(args);
    } finally {
      release();
    }
  }

  private async executeExclusive(args: WebSearchParams): Promise<ToolResult> {
    const query = String(args.query || '').trim();
    if (!query) {
      return createErrorResponse('query is required');
    }

    const engine = args.engine === 'google' ? 'google' : 'bing';
    const mode: WebSearchMode = args.mode === 'images' || args.mode === 'news' ? args.mode : 'web';
    const maxResults = Math.max(1, Math.min(30, Number(args.maxResults) || 10));
    const waitForVerification = !!args.waitForVerification;
    const verificationTimeoutMs = Math.max(5_000, Number(args.verificationTimeoutMs) || 120_000);
    const url = buildSearchUrl(query, engine, mode);
    const started = Date.now();

    logger.info(LOG, `${engine}/${mode}: "${query}"`);

    try {
      let tabId = args.tabId;
      let tab: chrome.tabs.Tab | null | undefined;

      if (tabId) {
        tab = await this.tryGetTab(tabId);
      }

      if (!tab?.id) {
        if (!args.openInNewTab) {
          const allTabs = await chrome.tabs.query({});
          const reusableTabs = allTabs.filter((candidate) => (
            candidate.url && isEngineSearchUrl(candidate.url, engine)
          ));
          tab = [...reusableTabs].reverse().find((candidate) => (
            candidate.url && matchesSearchUrl(candidate.url, url)
          )) || reusableTabs[reusableTabs.length - 1];
        }
        if (!tab?.id) {
          // Drive the search tab in the BACKGROUND — readPage uses sendMessage,
          // which works on an inactive tab, so the user's focus is never stolen.
          tab = await chrome.tabs.create({ url, active: false });
        } else {
          if (!tab.url || !matchesSearchUrl(tab.url, url)) {
            await chrome.tabs.update(tab.id, { url, active: false });
          }
        }
      } else {
        if (!tab.url || !matchesSearchUrl(tab.url, url)) {
          await chrome.tabs.update(tab.id, { url, active: false });
        }
      }

      if (!tab?.id) {
        return createErrorResponse('Failed to open search tab');
      }
      tabId = tab.id;

      await waitForTabComplete(tabId, {
        timeoutMs: 20_000,
        settleDelayMs: 500,
        statusProbeDelayMs: 600,
        expectedUrl: url,
      });
      let status: Awaited<ReturnType<WebSearchTool['readPage']>>;
      try {
        status = await this.readPage(tabId, mode, maxResults);
      } catch (error) {
        logger.warn(LOG, `Search tab ${tabId} could not be inspected; retrying in a fresh tab`, error);
        const recoveryTab = await chrome.tabs.create({ url, active: false });
        if (!recoveryTab.id) throw error;
        tabId = recoveryTab.id;
        await waitForTabComplete(tabId, {
          timeoutMs: 20_000,
          settleDelayMs: 500,
          statusProbeDelayMs: 600,
          expectedUrl: url,
        });
        status = await this.readPage(tabId, mode, maxResults);
      }
      let finalStatus: WebSearchStatus = status.status;

      if (status.status === 'verification_required' && waitForVerification) {
        const cleared = await this.waitForVerificationClear(tabId, mode, maxResults, verificationTimeoutMs);
        status = cleared.payload;
        finalStatus = cleared.finalStatus;
      } else if (isVerificationUrl(status.url || tab.url || '')) {
        finalStatus = 'verification_required';
        status = {
          ...status,
          ok: false,
          status: 'verification_required',
          message: 'Search engine verification detected — solve CAPTCHA in the tab',
        };
      }

      if (mode === 'images' && finalStatus !== 'verification_required' && finalStatus !== 'verification_timeout') {
        status = await this.settleImageResults(tabId, maxResults, query, status);
        finalStatus = status.status;
      }

      const result: WebSearchResult = {
        ok: status.ok,
        status: finalStatus,
        query,
        engine,
        mode,
        message: status.message || (status.ok ? 'OK' : 'No results'),
        url: status.pageUrl || url,
        tabId,
        textResults: status.textResults || [],
        imageResults: status.imageResults || [],
        elapsedMs: Date.now() - started,
        lastVerified: WEB_SEARCH_LAST_VERIFIED,
        error: status.ok ? undefined : status.message,
      };

      return createJsonResponse(result, {
        isError: result.status === 'error',
        space: 2,
      });
    } catch (error) {
      logger.error(LOG, 'Search failed', error);
      return createErrorResponse(
        `Web search failed: ${toErrorMessage(error)}`,
      );
    }
  }

  private async readPage(
    tabId: number,
    mode: WebSearchMode,
    maxResults: number,
  ): Promise<{
    ok: boolean;
    status: WebSearchStatus;
    message: string;
    textResults: WebSearchResult['textResults'];
    imageResults: WebSearchResult['imageResults'];
    pageUrl?: string;
    url?: string;
  }> {
    await this.injectContentScript(tabId, [HELPER_SCRIPT]);
    await waitForDelay(300);
    const resp = await chrome.tabs.sendMessage(tabId, {
      action: 'webSearchExtract',
      mode: mode === 'news' ? 'web' : mode,
      maxResults,
    });
    if (!resp) {
      return {
        ok: false,
        status: 'error',
        message: 'No response from search helper',
        textResults: [],
        imageResults: [],
      };
    }
    return {
      ok: !!resp.ok,
      status: resp.status || (resp.ok ? 'ok' : 'no_results'),
      message: resp.message || '',
      textResults: resp.textResults || [],
      imageResults: resp.imageResults || [],
      pageUrl: resp.pageUrl,
    };
  }

  private async waitForVerificationClear(
    tabId: number,
    mode: WebSearchMode,
    maxResults: number,
    timeoutMs: number,
  ): Promise<{ finalStatus: WebSearchStatus; payload: Awaited<ReturnType<WebSearchTool['readPage']>> }> {
    const started = Date.now();
    await this.surfaceManualVerification(tabId);
    while (Date.now() - started < timeoutMs) {
      await this.injectContentScript(tabId, [HELPER_SCRIPT]);
      const verify = await chrome.tabs.sendMessage(tabId, { action: 'webSearchDetectVerification' });
      if (!verify?.required) {
        const payload = await this.readPage(tabId, mode, maxResults);
        return { finalStatus: payload.status, payload };
      }
      await waitForDelay(2000);
    }
    const payload = await this.readPage(tabId, mode, maxResults);
    return {
      finalStatus: payload.status === 'verification_required' ? 'verification_timeout' : payload.status,
      payload: {
        ...payload,
        ok: false,
        status: 'verification_timeout',
        message: 'Verification wait timed out — solve CAPTCHA in the search tab and retry',
      },
    };
  }

  private async surfaceManualVerification(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      if (typeof tab.windowId === 'number') {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      logger.info(LOG, `Manual verification required in tab ${tabId}`);
    } catch (error) {
      logger.warn(LOG, `Could not surface verification tab ${tabId}`, error);
    }
  }

  private async settleImageResults(
    tabId: number,
    maxResults: number,
    query: string,
    initial: Awaited<ReturnType<WebSearchTool['readPage']>>,
  ): Promise<Awaited<ReturnType<WebSearchTool['readPage']>>> {
    const started = Date.now();
    let current = initial;

    while (true) {
      const imageResults = filterSearchImageResults(current.imageResults || [], query);
      if (imageResults.length > 0) {
        return {
          ...current,
          ok: true,
          status: 'ok',
          imageResults,
        };
      }
      if (current.status === 'verification_required') return current;
      if (Date.now() - started >= IMAGE_RESULTS_SETTLE_TIMEOUT_MS) {
        return {
          ...current,
          ok: false,
          status: 'no_results',
          message: 'No query-matching image results found on page',
          imageResults: [],
        };
      }

      await waitForDelay(IMAGE_RESULTS_RETRY_DELAY_MS);
      current = await this.readPage(tabId, 'images', maxResults);
    }
  }

}

export const webSearchTool = new WebSearchTool();
