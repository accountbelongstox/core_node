import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { logger } from '@/utils/logger';
import {
  WEB_SEARCH_LAST_VERIFIED,
  buildSearchUrl,
  engineHost,
  isVerificationUrl,
  type WebSearchEngine,
  type WebSearchMode,
  type WebSearchResult,
  type WebSearchStatus,
} from '@/utils/web-search-core';

const LOG = 'Web Search Tool';
const HELPER_SCRIPT = 'inject-scripts/web-search-helper.js';

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
      let tab: chrome.tabs.Tab | undefined;

      if (tabId) {
        tab = await this.tryGetTab(tabId);
      }

      if (!tab?.id) {
        if (!args.openInNewTab) {
          const allTabs = await chrome.tabs.query({});
          tab = allTabs.find((t) => t.url && t.url.includes(engineHost(engine)));
        }
        if (!tab?.id) {
          // Drive the search tab in the BACKGROUND — readPage uses sendMessage,
          // which works on an inactive tab, so the user's focus is never stolen.
          tab = await chrome.tabs.create({ url, active: false });
        } else {
          // Reuse: navigate without foregrounding (don't force-activate).
          await chrome.tabs.update(tab.id, { url, active: false });
        }
      } else {
        await chrome.tabs.update(tab.id, { url, active: false });
      }

      if (!tab?.id) {
        return createErrorResponse('Failed to open search tab');
      }
      tabId = tab.id;

      await this.waitForTabComplete(tabId);
      let status = await this.readPage(tabId, mode, maxResults);
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

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: !result.ok && result.status !== 'verification_required',
      };
    } catch (error) {
      logger.error(LOG, 'Search failed', error);
      return createErrorResponse(
        `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
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
    await new Promise((r) => setTimeout(r, 300));
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
    while (Date.now() - started < timeoutMs) {
      await this.injectContentScript(tabId, [HELPER_SCRIPT]);
      const verify = await chrome.tabs.sendMessage(tabId, { action: 'webSearchDetectVerification' });
      if (!verify?.required) {
        const payload = await this.readPage(tabId, mode, maxResults);
        return { finalStatus: payload.status, payload };
      }
      await new Promise((r) => setTimeout(r, 2000));
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

  private waitForTabComplete(tabId: number, timeoutMs = 20_000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          chrome.tabs.onUpdated.removeListener(onUpdated);
        } catch {
          // ignore
        }
        clearTimeout(timer);
        setTimeout(resolve, 500);
      };
      const onUpdated = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && info.status === 'complete') finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(() => {
        chrome.tabs.get(tabId).then((tab) => {
          if (tab.status === 'complete') finish();
        }, finish);
      }, 600);
    });
  }
}

export const webSearchTool = new WebSearchTool();
