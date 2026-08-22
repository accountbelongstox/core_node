import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { logger } from '@/utils/logger';
import { arrayBufferToBase64 } from '@/utils/binary';
import { waitForTabComplete } from '@/utils/tab-readiness';
import { delay as waitForDelay, fetchWithTimeout } from '@/utils/async';

/**
 * HowToPronounce browser tool
 *
 * Drives a zh.howtopronounce.com/<word> tab and extracts pronunciation audio
 * (multi-clip mp3) + IPA + phonetic spelling + wiki/sentences. The audio mp3s
 * live on a cross-origin CDN (en-audio.howtopronounce.com) that sends NO
 * Access-Control-Allow-Origin, so they are fetched as bytes by the BACKGROUND
 * (which holds <all_urls> host permission and so bypasses CORS) - NOT in-page.
 * The content script only collects URLs + metadata (see howtopronounce-helper.js).
 *
 * Modeled on bing-dictionary.ts. Used internally by the Bing dictionary worker
 * (via lookupInTab) as the parallel "howtopronounce mode" that shares the same
 * word_translation task data.
 */

const LOG = 'HowToPronounce';
const HOWTO_BASE = 'https://zh.howtopronounce.com';
const HELPER_SCRIPT = 'inject-scripts/howtopronounce-helper.js';

/** Max audio clips to download per word (keeps the result payload lean). */
const MAX_AUDIO_CLIPS = 3;
/** Per-clip fetch budget (howtopronounce mp3s are ~10-30KB; allow headroom). */
const AUDIO_FETCH_TIMEOUT_MS = 12_000;
const HOWTO_TAB_COMPLETE_OPTIONS = {
  timeoutMs: 15_000,
  settleDelayMs: 400,
  statusProbeDelayMs: 600,
};

interface HowToPronounceParams {
  word: string;
  openInNewTab?: boolean;
}

export interface HowToPronounceAudioClip {
  url: string;
  description: string;
  base64: string;
  mime: string;
}

export interface HowToPronounceResult {
  success: boolean;
  word: string | null;
  // Audio clips downloaded as base64 (background-fetched). Ordered by
  // howtopronounce's vote ranking (best first); capped at MAX_AUDIO_CLIPS.
  audioClips: HowToPronounceAudioClip[];
  // All audio URLs found (before download) - persisted so a miss can be retried
  // without re-scraping, mirroring Bing's audio_url field.
  audioUrls: string[];
  ipa: string;
  phoneticSpelling: string;
  wiki: string[];
  sentences: Array<{ en?: string; cn?: string }>;
  hasContent: boolean;
  error: string | null;
  url?: string;
  tabId?: number;
}

/** Build the clean word-page URL: lowercased, spaces->hyphens, URL-encoded. */
function buildWordUrl(word: string): string {
  const slug = word.trim().toLowerCase().replace(/\s+/g, '-');
  return `${HOWTO_BASE}/${encodeURIComponent(slug)}`;
}

class HowToPronounceTool extends BaseBrowserToolExecutor {
  name = 'howtopronounce';

  async execute(args: HowToPronounceParams): Promise<ToolResult> {
    const { word, openInNewTab = false } = args;
    if (!word || word.trim() === '') {
      return createErrorResponse('Word parameter is required and cannot be empty');
    }
    logger.info(LOG, `Looking up word: "${word}"`);
    try {
      let tab: chrome.tabs.Tab | undefined;
      if (!openInNewTab) {
        const allTabs = await chrome.tabs.query({});
        tab = allTabs.find((t) => t.url && t.url.includes('howtopronounce.com'));
        if (tab?.id) await chrome.tabs.update(tab.id, { active: true });
      }
      if (!tab) {
        tab = await chrome.tabs.create({ url: buildWordUrl(word), active: true });
      }
      if (!tab.id) return createErrorResponse('Failed to create or access tab');
      const data = await this.lookupInTab(tab.id, word);
      if (!data) return createErrorResponse('No response from content script');
      return createJsonResponse(data, { space: 2 });
    } catch (error) {
      logger.error(LOG, 'Lookup error', error);
      return createErrorResponse(
        `Error looking up word in HowToPronounce: ${toErrorMessage(error)}`,
      );
    }
  }

  /**
   * Look up a word in a caller-owned tab by navigating to /<word>, then
   * extracting pronunciation data. Used by the parallel pronunciation source
   * (the Bing worker's howtopronounce mode). Fail-soft: never throws to the
   * caller - returns a result with success=false on any error so the Bing
   * worker's word lookup is never failed by a howtopronounce miss.
   */
  async lookupInTab(tabId: number, word: string): Promise<HowToPronounceResult> {
    const wordUrl = buildWordUrl(word);
    try {
      await chrome.tabs.update(tabId, { url: wordUrl });
      await waitForTabComplete(tabId, HOWTO_TAB_COMPLETE_OPTIONS);
      let data = await this.extractFromTab(tabId, wordUrl);
      // Search-box fallback: a direct /<word> nav occasionally lands on a
      // no-result page for phrases; retry once via the on-page search box.
      if (!data || !data.hasContent) {
        logger.info(LOG, `Direct nav yielded no content for "${word}"; trying search box`);
        await chrome.tabs.update(tabId, { url: HOWTO_BASE });
        await waitForTabComplete(tabId, HOWTO_TAB_COMPLETE_OPTIONS);
        const searchRes = await this.sendToHelper(tabId, { action: 'htpSearch', word: word.trim() });
        if (searchRes?.found) {
          await waitForTabComplete(tabId, HOWTO_TAB_COMPLETE_OPTIONS);
          data = await this.extractFromTab(tabId, `${HOWTO_BASE}/<${word}>`);
        }
      }
      if (!data) {
        return this.emptyResult(wordUrl, tabId, 'No response from HowToPronounce page');
      }
      // Download the top audio clips as base64 in the BACKGROUND (CORS bypass
      // via <all_urls> host permission - the page cannot fetch them).
      if (data.audioUrls.length > 0) {
        const clips = data.audioUrls
          .slice(0, MAX_AUDIO_CLIPS)
          .map((url) => ({ url }));
        data.audioClips = await this.fetchAudioClips(clips);
      }
      data.url = wordUrl;
      data.tabId = tabId;
      return data;
    } catch (error) {
      logger.warn(LOG, `lookupInTab failed for "${word}":`, error);
      return this.emptyResult(wordUrl, tabId, toErrorMessage(error));
    }
  }

  /** Inject the helper, ask it for the rendered pronunciation data. */
  private async extractFromTab(tabId: number, url: string): Promise<HowToPronounceResult | null> {
    const raw = await this.sendToHelper(tabId, { action: 'htpFetchPronunciation', waitMs: 8000 }, 300);
    if (!raw) return null;
    const result: HowToPronounceResult = {
      success: !!raw.success,
      word: raw.word || null,
      audioClips: [],
      audioUrls: Array.isArray(raw.audio) ? raw.audio.map((a: any) => a.url).filter(Boolean) : [],
      ipa: raw.ipa || '',
      phoneticSpelling: raw.phoneticSpelling || '',
      wiki: Array.isArray(raw.wiki) ? raw.wiki : [],
      sentences: Array.isArray(raw.sentences) ? raw.sentences : [],
      hasContent: !!raw.hasContent,
      error: raw.error || null,
      url,
      tabId,
    };
    return result;
  }

  /**
   * Download the chosen audio URLs as base64 clips in the service-worker
   * background. The extension holds <all_urls> host permission, so cross-origin
   * fetch to en-audio.howtopronounce.com (no ACAO) succeeds here where an
   * in-page fetch would be CORS-blocked. Best-effort: a failed clip is skipped,
   * never thrown.
   */
  async fetchAudioClips(
    clips: Array<{ url: string; description?: string }>,
  ): Promise<HowToPronounceAudioClip[]> {
    const out: HowToPronounceAudioClip[] = [];
    await Promise.all(
      clips.map(async (c) => {
        try {
          const res = await fetchWithTimeout(
            c.url,
            AUDIO_FETCH_TIMEOUT_MS,
            { cache: 'no-store' },
          );
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          if (!buf || buf.byteLength === 0) return;
          const mime = (res.headers.get('content-type') || '').split(';')[0].trim() || 'audio/mpeg';
          out.push({
            url: c.url,
            description: c.description || '',
            base64: arrayBufferToBase64(buf),
            mime,
          });
        } catch (error) {
          logger.debug(LOG, `audio fetch failed for ${c.url}:`, error);
        }
      }),
    );
    // Preserve original order (by vote ranking).
    const byUrl = new Map(out.map((c) => [c.url, c]));
    return clips.map((c) => byUrl.get(c.url)).filter((c): c is HowToPronounceAudioClip => !!c);
  }

  private emptyResult(url: string, tabId: number, error: string): HowToPronounceResult {
    return {
      success: false,
      word: null,
      audioClips: [],
      audioUrls: [],
      ipa: '',
      phoneticSpelling: '',
      wiki: [],
      sentences: [],
      hasContent: false,
      error,
      url,
      tabId,
    };
  }

  /**
   * Inject the helper and message the page via chrome.tabs.sendMessage DIRECTLY
   * (not the base sendMessageToTab, which THROWS on a response carrying an
   * `error` field - and the helper legitimately returns error as part of its
   * structured payload). Mirrors bing-dictionary.ts:sendToHelper. Re-injects
   * once on a transport rejection ("Receiving end does not exist").
   */
  private async sendToHelper(
    tabId: number,
    message: Record<string, unknown>,
    settleMs = 300,
  ): Promise<any> {
    await this.injectContentScript(tabId, [HELPER_SCRIPT]);
    await waitForDelay(settleMs);
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      const m = toErrorMessage(err);
      if (/Could not establish connection|Receiving end does not exist/i.test(m)) {
        await this.injectContentScript(tabId, [HELPER_SCRIPT]);
        await waitForDelay(400);
        return await chrome.tabs.sendMessage(tabId, message);
      }
      throw err;
    }
  }

  /** Public full-load barrier (mirrors bing-dictionary.ts:waitForTabIdle). */
  async waitForTabIdle(tabId: number): Promise<void> {
    await waitForTabComplete(tabId, HOWTO_TAB_COMPLETE_OPTIONS);
  }
}

export const howToPronounceTool = new HowToPronounceTool();
