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
    // base64 data URL of the audio, captured in-page (bypasses hot-link/CORS).
    audioDataUrl?: string;
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
    // base64 data URL of the image, captured in-page (bypasses hot-link/CORS).
    dataUrl?: string;
  }>;
  synonyms: Array<{
    type: string;
    words: string;
  }>;
  advancedTranslations: Array<{
    type: string;
    content: string;
  }>;
  // Detailed (Collins/Oxford-style) definitions from `.se_lis`: a Chinese gloss
  // plus the English explanation.
  detailedDefinitions?: Array<{ cn: string; en: string }>;
  // Example sentences (`.sen_en` / `.sen_cn`) — English sentence + Chinese.
  examples?: Array<{ en: string; cn: string }>;
  voiceUrls: string[];
  // True when the page yielded at least one usable signal (definition, phonetic,
  // or image). Absent on older cached injections — treat undefined as unknown.
  hasContent?: boolean;
  // 'dict' = confirmed Bing dictionary page; 'non-dict' = region-redirected /
  // not a dictionary. Only a 'dict' page with no entry means the word is invalid.
  pageType?: 'dict' | 'non-dict';
  error: string | null;
  url?: string;
  tabId?: number;
}

// 必应词典 home. We load this once per tab then drive its search box, instead of
// hitting /dict/search?q= directly (which can region-redirect to web search).
const BING_DICT_HOME = 'https://cn.bing.com/dict';

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
      let tab: chrome.tabs.Tab | undefined;

      // Reuse an existing Bing dictionary tab when allowed.
      if (!openInNewTab) {
        const allTabs = await chrome.tabs.query({});
        tab = allTabs.find((t) => t.url && t.url.includes('bing.com/dict'));
        if (tab?.id) {
          await chrome.tabs.update(tab.id, { active: true });
        }
      }

      // Otherwise open the dictionary home (search box driven from there).
      if (!tab) {
        tab = await chrome.tabs.create({ url: BING_DICT_HOME, active: true });
      }

      if (!tab.id) {
        return createErrorResponse('Failed to create or access tab');
      }

      const translationData = await this.lookupInTab(tab.id, word);

      if (!translationData) {
        return createErrorResponse('No response from content script');
      }
      if (!translationData.success) {
        console.warn('[Bing Dictionary] Translation extraction failed:', translationData.error);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(translationData, null, 2) }],
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
   * Look up a word in a SPECIFIC, caller-owned tab by driving the on-page search
   * box (type the word + click search) rather than navigating to the ?q= URL.
   * This keeps the dictionary's session/market context (avoiding the region
   * redirect to web search) and mimics human interaction. Used by the parallel
   * translation worker's tab pool.
   */
  async lookupInTab(
    tabId: number,
    word: string,
    includeMedia = false,
  ): Promise<BingDictionaryResult> {
    await this.ensureOnDictPage(tabId);

    // Type into the search box and click search.
    let searchRes = await this.searchInTab(tabId, word);
    if (!searchRes?.found) {
      // The tab wasn't on a usable dictionary page — load the home and retry once.
      await chrome.tabs.update(tabId, { url: BING_DICT_HOME });
      await this.waitForTabComplete(tabId);
      searchRes = await this.searchInTab(tabId, word);
      if (!searchRes?.found) {
        return {
          success: false,
          word: null,
          phonetics: [],
          translations: [],
          pluralForms: [],
          sampleImages: [],
          synonyms: [],
          advancedTranslations: [],
          voiceUrls: [],
          hasContent: false,
          pageType: 'non-dict',
          error: 'Bing dictionary search box not found (region/redirect issue)',
          tabId,
        };
      }
    }

    // The click triggers a navigation to the result page; wait then extract.
    await this.waitForTabComplete(tabId);
    const tab = await this.tryGetTab(tabId);
    return this.extractFromTab(tabId, tab?.url || BING_DICT_HOME, includeMedia);
  }

  /**
   * Fetch image/audio binaries IN the dictionary page via the injected
   * BingMediaFetcher class library. Returns raw bytes (number[]) per URL so the
   * extension can cache them and rebuild data URLs locally — it never re-requests
   * the remote *.bing.net / mediamp3 URL from the popup/background (wrong
   * referrer/CORS → broken media).
   */
  async fetchMediaInTab(
    tabId: number,
    urls: string[],
  ): Promise<Array<{ url: string; ok: boolean; mime: string | null; bytes: number[] }>> {
    const unique = Array.from(new Set((urls || []).filter(Boolean)));
    if (unique.length === 0) return [];
    await this.injectContentScript(tabId, ['inject-scripts/bing-media-fetcher.js']);
    // Let the freshly-injected listener register before messaging it.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const resp = await this.sendMessageToTab(tabId, {
      action: 'bingDictionaryFetchMedia',
      urls: unique,
    });
    return (resp && (resp as any).results) || [];
  }

  /** Ensure the tab is on a bing.com/dict page; load the home if not. */
  private async ensureOnDictPage(tabId: number): Promise<void> {
    const tab = await this.tryGetTab(tabId);
    if (!tab || !tab.url || !tab.url.includes('bing.com/dict')) {
      await chrome.tabs.update(tabId, { url: BING_DICT_HOME });
      await this.waitForTabComplete(tabId);
    }
  }

  /** Inject the helper and trigger an on-page search (fill box + click). */
  private async searchInTab(
    tabId: number,
    word: string,
  ): Promise<{ found: boolean; error?: string } | undefined> {
    await this.injectContentScript(tabId, ['inject-scripts/bing-dictionary-helper.js']);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return this.sendMessageToTab(tabId, { action: 'bingDictionarySearch', word: word.trim() });
  }

  /**
   * Inject the helper and pull the dictionary data out of an already-navigated
   * tab. Shared by execute() and lookupInTab().
   */
  private async extractFromTab(
    tabId: number,
    bingDictUrl: string,
    includeMedia = false,
  ): Promise<BingDictionaryResult> {
    await this.injectContentScript(tabId, ['inject-scripts/bing-dictionary-helper.js']);

    // Give the freshly-injected content script a moment to register its listener.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const translationData: BingDictionaryResult = await this.sendMessageToTab(tabId, {
      action: TOOL_MESSAGE_TYPES.BING_DICTIONARY_FETCH_TRANSLATION,
      // Only the test/display path needs in-page base64 capture of images+audio;
      // bulk processing skips it to stay fast (audio is fetched separately).
      includeBinaries: includeMedia,
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

      // A just-triggered navigation can still report the PREVIOUS page as
      // "complete" for a few ms. Probe the status only after a short delay so a
      // stale "complete" can't resolve us onto the old page; by then the tab has
      // flipped to "loading" and we wait for the real "complete" event.
      setTimeout(() => {
        chrome.tabs.get(tabId).then(
          (tab) => {
            if (tab.status === 'complete') {
              finish();
            }
          },
          () => finish(),
        );
      }, 600);
    });
  }
}

export const bingDictionaryTool = new BingDictionaryTool();
