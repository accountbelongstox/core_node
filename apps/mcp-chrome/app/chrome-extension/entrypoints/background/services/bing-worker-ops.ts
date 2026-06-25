/**
 * Bing worker diagnostics/ops — the ad-hoc scrape TEST path, relocated out of
 * BingDictionaryWorkerService to keep that file focused on the crawl loop +
 * lifecycle. This is a behavior-preserving RELOCATION (not a merge): it keeps the
 * test path's own mediaCache display semantics, distinct from the worker's
 * backend byte-capture (attachMedia). It REUSES bing-result (classify /
 * formatExplanation / normalizeWords) and the shared BingTabPool via injected
 * deps — it never touches the poll loop or submits to the backend.
 */

import { bingDictionaryTool, BingDictionaryResult } from '../tools/browser/bing-dictionary';
import { mediaCache } from '@/utils/media-cache';
import { BingTabPool } from './bing-tab-pool';
import { classify, formatExplanation, normalizeWords } from './bing-result';

/** One per-word row returned to the popup's scrape-test panel. */
export interface ScrapeTestResult {
  word: string;
  ok: boolean;
  invalid?: boolean;
  translation?: string;
  phonetic?: string;
  usPhonetic?: string;
  ukPhonetic?: string;
  definitions?: Array<{ partOfSpeech: string; definition: string }>;
  detailedDefinitions?: Array<{ cn: string; en: string }>;
  examples?: Array<{ en: string; cn: string }>;
  synonyms?: Array<{ type: string; words: string }>;
  webDefinitions?: Array<{ type: string; content: string }>;
  images?: number;
  audio?: boolean;
  audioUrl?: string;
  usAudioUrl?: string;
  ukAudioUrl?: string;
  imageUrls?: string[];
  // Debug: what was captured in-page as binary and cached (the cache "paths" are
  // the original remote URLs, which double as the cache keys).
  media?: Array<{ url: string; kind: 'image' | 'audio'; mime: string | null; bytes: number; cached: boolean }>;
  error?: string;
}

/** Dependencies the test path needs from the running service (no `this`). */
export interface ScrapeTestDeps {
  pool: BingTabPool;
  defaultTabCount: number;
  lookup: (
    tabId: number,
    word: string,
    includeMedia?: boolean,
  ) => Promise<{ data: BingDictionaryResult; tabId: number }>;
  setActiveTabs: (n: number) => void;
  setCurrentWord: (word: string | null) => void;
}

/**
 * Ad-hoc Bing scrape test driven from the popup. Scrapes the given word(s) live
 * across the parallel tab pool WITHOUT pulling from or posting to the backend,
 * returning a compact per-word result for display. Media is captured IN the page
 * (BingMediaFetcher) and cached as data URLs for display — never the backend
 * byte path. Behavior identical to the former service.testScrape().
 */
export async function runScrapeTest(
  rawWords: string[],
  tabCount: number | undefined,
  deps: ScrapeTestDeps,
): Promise<ScrapeTestResult[]> {
  const words = normalizeWords(rawWords);
  if (words.length === 0) return [];

  // Parallelism only helps with many words. Never open more tabs than there are
  // words — a single-word test uses exactly ONE tab (tabCount is only the cap).
  const want = Math.min(words.length, tabCount ?? deps.defaultTabCount ?? 3);
  const tabIds = await deps.pool.ensure(want, true);
  deps.setActiveTabs(deps.pool.size);
  const results: ScrapeTestResult[] = [];
  let nextIndex = 0;

  const runSlot = async (initialTabId: number): Promise<void> => {
    let tabId = initialTabId;
    while (true) {
      const i = nextIndex++;
      if (i >= words.length) break;
      const w = words[i];
      deps.setCurrentWord(w.word);
      try {
        // Extraction returns URLs only; the binaries are fetched in-page by the
        // injected BingMediaFetcher class library (includeMedia=false here). Heal
        // a dead/discarded tab transparently and keep the fresh id.
        const looked = await deps.lookup(tabId, w.word, false);
        tabId = looked.tabId;
        const data = looked.data;
        const classification = classify(data).kind;
        if (classification === 'translated' && data) {
          const formatted = formatExplanation(data);

          // Identify the US/UK pronunciation tracks (Bing labels UK 'en-GB').
          const phonetics = data.phonetics || [];
          const usP = phonetics.find((p: any) => p.lang && p.lang.includes('US'));
          const ukP = phonetics.find(
            (p: any) => p.lang && (p.lang.includes('GB') || p.lang.includes('UK')),
          );
          const usAudioRemote = (usP && usP.audioUrl) || undefined;
          const ukAudioRemote = (ukP && ukP.audioUrl) || undefined;
          const imageRemote = (data.sampleImages || [])
            .map((s: any) => s.url)
            .filter(Boolean)
            .slice(0, 6);

          // Persistent local cache: load it, then ONLY fetch what we don't already
          // have stored locally. Binaries are captured IN the page as raw bytes; we
          // NEVER request the remote *.bing.net / mediamp3 URL directly.
          await mediaCache.init();
          const allMedia = [...imageRemote, usAudioRemote, ukAudioRemote].filter(
            (u): u is string => typeof u === 'string' && u.length > 0,
          );
          const toFetch = allMedia.filter((u) => !mediaCache.has(u));
          const captured = toFetch.length
            ? await bingDictionaryTool.fetchMediaInTab(tabId, toFetch)
            : [];
          for (const m of captured) {
            if (m.ok && m.bytes && m.bytes.length) {
              mediaCache.put(m.url, m.bytes, m.mime || undefined);
            }
          }

          const debugMedia = allMedia.map((u) => {
            const e = mediaCache.get(u);
            return {
              url: u,
              kind: (u === usAudioRemote || u === ukAudioRemote ? 'audio' : 'image') as
                | 'audio'
                | 'image',
              mime: e ? e.mime : null,
              bytes: e ? e.len : 0,
              cached: !!e,
            };
          });

          // Build data URLs from the cached BYTES (no remote re-request).
          const fromCache = (u?: string) => (u ? mediaCache.toDataUrl(u) || undefined : undefined);
          const imageUrls = imageRemote
            .map((u: string) => fromCache(u))
            .filter((u): u is string => !!u)
            .slice(0, 6);
          const usAudioUrl = fromCache(usAudioRemote);
          const ukAudioUrl = fromCache(ukAudioRemote);
          const audioUrl = usAudioUrl || ukAudioUrl;

          results.push({
            word: w.word,
            ok: true,
            translation: formatted.text,
            phonetic: formatted.phonetic || formatted.us_phonetic || formatted.uk_phonetic || '',
            usPhonetic: formatted.us_phonetic,
            ukPhonetic: formatted.uk_phonetic,
            definitions: data.translations,
            detailedDefinitions: data.detailedDefinitions,
            examples: data.examples,
            synonyms: data.synonyms,
            webDefinitions: data.advancedTranslations,
            images: imageUrls.length,
            audio: !!(usAudioUrl || ukAudioUrl),
            audioUrl,
            usAudioUrl,
            ukAudioUrl,
            imageUrls,
            media: debugMedia,
          });
        } else if (classification === 'invalid') {
          results.push({ word: w.word, ok: false, invalid: true, error: 'No Bing entry' });
        } else {
          results.push({ word: w.word, ok: false, error: 'Lookup failed (transient)' });
        }
      } catch (error: any) {
        results.push({ word: w.word, ok: false, error: error?.message || 'Error' });
      }
    }
  };

  await Promise.all(tabIds.map((tabId) => runSlot(tabId)));
  deps.setCurrentWord(null);

  // Preserve the user's input order.
  const order = new Map(words.map((w, i) => [w.word, i]));
  results.sort((a, b) => (order.get(a.word) ?? 0) - (order.get(b.word) ?? 0));
  return results;
}
