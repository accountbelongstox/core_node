import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { logger } from '@/utils/logger';
// The single, parameter-free dictionary URL (no ?mkt / ?q=). Aliased as
// BING_DICT_HOME: we load it once per tab then drive the search box via WebOps.
import { BING_DICT_URL as BING_DICT_HOME } from '../../services/bing-tab-pool';
// tab-controller is a LEAF (imports only chrome + logger) — no import cycle.
import { tabController } from '../../services/tab-controller';

// Shared human-simulation library, co-injected FIRST so the Bing helper can use
// self.__WebOps (humanType/submitForm/waitFor) to operate the page like a human.
const WEB_OPS_SCRIPT = 'inject-scripts/web-ops.js';
const BING_HELPER_SCRIPT = 'inject-scripts/bing-dictionary-helper.js';

const LOG = 'Bing Dictionary';

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
  // True on a CONFIRMED Bing "No results found for <word>" page — a definitive
  // no-entry; the word is invalid (becomes a placeholder), never a transient.
  noEntry?: boolean;
  // True on a machine-translation-only page (.lf_area .smt_hw, no real .qdef
  // entry). Bing has no genuine dictionary record — treated as invalid (the
  // reference scraper deletes such words), not a transient failure.
  computerTranslate?: boolean;
  // True on Bing's SOFT OUTAGE page ("It's not you, it's us" / "Bing isn't
  // available right now"). A GLOBAL transient — the worker pauses 30s + probes;
  // words are NEVER invalidated by an outage.
  outage?: boolean;
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

    logger.info(LOG, `Looking up word: "${word}"`);

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
        logger.warn(LOG, 'Translation extraction failed', translationData.error);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(translationData, null, 2) }],
        isError: false,
      };
    } catch (error) {
      logger.error(LOG, 'Lookup error', error);
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
    await this.injectContentScript(tabId, [WEB_OPS_SCRIPT, BING_HELPER_SCRIPT]);
    await new Promise((resolve) => setTimeout(resolve, 250));
    // Re-confirm the tab is foreground right before typing — a concurrent slot
    // may have stolen focus between the worker's activate and here. Skip while a
    // pause is active (yielding to the user). Best-effort; never blocks a search.
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.active !== true && !tabController.isPaused()) {
        await tabController.activate(tabId);
      }
    } catch {
      // tab gone — the lookup's healing replaces it.
    }
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
    await this.injectContentScript(tabId, [WEB_OPS_SCRIPT, BING_HELPER_SCRIPT]);

    // Give the freshly-injected content script a moment to register its listener.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const msg = {
      action: TOOL_MESSAGE_TYPES.BING_DICTIONARY_FETCH_TRANSLATION,
      // Only the test/display path needs in-page base64 capture of images+audio;
      // bulk processing skips it to stay fast (audio is fetched separately).
      includeBinaries: includeMedia,
    };

    // IMPORTANT: use chrome.tabs.sendMessage DIRECTLY here, not the base
    // sendMessageToTab — the base THROWS whenever the response carries an
    // `error` field, but for the extract result `error` is a LEGITIMATE part of
    // the structured payload (e.g. a confirmed "No results found" no-entry page
    // also sets noEntry=true/success=true). Throwing it would mis-count an
    // INVALID word as a FAILURE and bypass classify(). So we RETURN the resolved
    // result as-is (classify() then maps noEntry -> invalid -> invalid_words[]).
    // Only a genuine TRANSPORT rejection (content script not present:
    // "Could not establish connection / Receiving end does not exist") is a real
    // error — on that we re-inject once and retry; if it still fails we throw so
    // the worker's tab-healing (isDeadTabError) can replace the tab.
    let translationData: BingDictionaryResult;
    try {
      translationData = await chrome.tabs.sendMessage(tabId, msg);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      if (/Could not establish connection|Receiving end does not exist/i.test(m)) {
        await this.injectContentScript(tabId, [WEB_OPS_SCRIPT, BING_HELPER_SCRIPT]);
        await new Promise((resolve) => setTimeout(resolve, 400));
        translationData = await chrome.tabs.sendMessage(tabId, msg);
      } else {
        throw err;
      }
    }

    if (translationData) {
      translationData.url = bingDictUrl;
      translationData.tabId = tabId;
    }

    return translationData;
  }

  /**
   * Public full-load barrier: wait until the tab is idle (not loading/spinning)
   * before the caller advances. ALWAYS delegates to waitForTabComplete — which
   * includes the 600ms delayed-status probe that guards the "stale complete from
   * the previous page" race — so a single immediate status==='complete' read is
   * never trusted. Bounded by waitForTabComplete's 15s hard timeout.
   */
  async waitForTabIdle(tabId: number): Promise<void> {
    await this.waitForTabComplete(tabId);
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
