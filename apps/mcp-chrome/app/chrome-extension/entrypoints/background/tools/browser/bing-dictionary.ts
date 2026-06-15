import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';

interface BingDictionaryParams {
  word: string;
  openInNewTab?: boolean;
}

export interface BingDictionaryResult {
  success: boolean;
  word: string | null;
  phonetics: Array<{
    text: string;
    audioUrl: string | null;
    lang: string;
  }>;
  translations: Array<{
    partOfSpeech: string;
    definition: string;
  }>;
  pluralForms: string[];
  sampleImages: Array<{
    url: string;
    alt: string;
  }>;
  synonyms: Array<{
    type: string;
    words: string;
  }>;
  advancedTranslations: Array<{
    type: string;
    content: string;
  }>;
  voiceUrls: string[];
  error: string | null;
  url?: string;
  tabId?: number;
}

class BingDictionaryTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.BING_DICTIONARY;

  /**
   * Execute Bing Dictionary translation lookup
   */
  async execute(args: BingDictionaryParams): Promise<ToolResult> {
    const { word, openInNewTab = false } = args;

    if (!word || word.trim() === '') {
      return createErrorResponse('Word parameter is required and cannot be empty');
    }

    console.log(`[Bing Dictionary] Looking up word: "${word}"`);

    try {
      // Construct Bing Dictionary URL
      const searchWord = encodeURIComponent(word.trim());
      const bingDictUrl = `https://www.bing.com/dict/search?q=${searchWord}`;

      console.log(`[Bing Dictionary] Target URL: ${bingDictUrl}`);

      let tab: chrome.tabs.Tab | undefined;

      // Check if we should reuse an existing Bing Dictionary tab
      if (!openInNewTab) {
        const allTabs = await chrome.tabs.query({});

        // Find tabs with Bing Dictionary open
        const bingDictTabs = allTabs.filter((t) => {
          return t.url && t.url.includes('bing.com/dict');
        });

        if (bingDictTabs.length > 0) {
          // Reuse the first Bing Dictionary tab found
          tab = bingDictTabs[0];
          console.log(
            `[Bing Dictionary] Reusing existing tab ID: ${tab.id}, navigating to: ${bingDictUrl}`,
          );

          // Navigate to the new search URL
          if (tab.id) {
            await chrome.tabs.update(tab.id, {
              url: bingDictUrl,
              active: true,
            });
          }
        }
      }

      // If no existing tab or openInNewTab is true, create a new tab
      if (!tab) {
        console.log(`[Bing Dictionary] Creating new tab for: ${bingDictUrl}`);
        tab = await chrome.tabs.create({
          url: bingDictUrl,
          active: true,
        });
      }

      if (!tab.id) {
        return createErrorResponse('Failed to create or access tab');
      }

      // Wait for the navigation to settle, then inject + extract.
      await this.waitForTabComplete(tab.id);

      const translationData = await this.extractFromTab(tab.id, bingDictUrl);

      if (!translationData) {
        return createErrorResponse('No response from content script');
      }

      if (!translationData.success) {
        console.warn('[Bing Dictionary] Translation extraction failed:', translationData.error);
      }

      console.log('[Bing Dictionary] Translation data retrieved successfully');

      // Return formatted result
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(translationData, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('[Bing Dictionary] Error:', error);
      return createErrorResponse(
        `Error looking up word in Bing Dictionary: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Look up a word in a SPECIFIC, caller-owned tab. Used by the parallel
   * translation worker, which manages a pool of Bing dictionary tabs and drives
   * several lookups concurrently. Navigates the given tab to the search URL,
   * waits for load, injects the helper, and returns the parsed result (incl.
   * phonetics[].audioUrl and sampleImages).
   */
  async lookupInTab(tabId: number, word: string): Promise<BingDictionaryResult> {
    const searchWord = encodeURIComponent(word.trim());
    const bingDictUrl = `https://www.bing.com/dict/search?q=${searchWord}`;

    await chrome.tabs.update(tabId, { url: bingDictUrl });
    await this.waitForTabComplete(tabId);

    return this.extractFromTab(tabId, bingDictUrl);
  }

  /**
   * Inject the helper and pull the dictionary data out of an already-navigated
   * tab. Shared by execute() and lookupInTab().
   */
  private async extractFromTab(tabId: number, bingDictUrl: string): Promise<BingDictionaryResult> {
    await this.injectContentScript(tabId, ['inject-scripts/bing-dictionary-helper.js']);

    // Give the freshly-injected content script a moment to register its listener.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const translationData: BingDictionaryResult = await this.sendMessageToTab(tabId, {
      action: TOOL_MESSAGE_TYPES.BING_DICTIONARY_FETCH_TRANSLATION,
    });

    if (translationData) {
      translationData.url = bingDictUrl;
      translationData.tabId = tabId;
    }

    return translationData;
  }

  /**
   * Resolve once the tab finishes loading. Prefers the chrome.tabs "complete"
   * status event over a fixed sleep, with a hard timeout fallback so a hung
   * navigation can never wedge the worker.
   */
  private waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          chrome.tabs.onUpdated.removeListener(onUpdated);
        } catch {
          // listener may already be gone
        }
        clearTimeout(timer);
        // Small settle delay so late-rendered dictionary nodes are present.
        setTimeout(resolve, 400);
      };

      const onUpdated = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && info.status === 'complete') {
          finish();
        }
      };

      const timer = setTimeout(finish, timeoutMs);
      chrome.tabs.onUpdated.addListener(onUpdated);

      // The tab may already be "complete" before we attached the listener.
      chrome.tabs.get(tabId).then(
        (tab) => {
          if (tab.status === 'complete') {
            finish();
          }
        },
        () => finish(),
      );
    });
  }
}

export const bingDictionaryTool = new BingDictionaryTool();
