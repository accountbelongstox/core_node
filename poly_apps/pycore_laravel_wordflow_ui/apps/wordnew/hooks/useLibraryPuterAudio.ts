/**
 * useLibraryPuterAudio - auto-generate missing word audio via Puter.js for the
 * library table view (WfNewLibraryPage).
 *
 * Behavior (gated by the `usePuterAudio` setting, default ON):
 *   - On every page load, enqueue EVERY word on the current page whose audio is
 *     missing; synthesize sequentially (250ms pacing, like the reference
 *     puter_word_audio.html) and upload each clip to Laravel (saveWordAudio) so
 *     hasAudio sticks on the next page load.
 *   - Prefetch the NEXT 3 pages (page+1..page+3) the same way so audio is ready
 *     before the user navigates. Each page switch re-derives the 3-page window.
 *   - Dedup by md5: a word already attempted (or already has audio) is never
 *     re-synthesized. Current-page words are prioritized (queue front) ahead of
 *     prefetch words (queue back).
 *   - Local playback: on success the word's audioUrl is set to the Puter blob
 *     URL via onAudioReady; Laravel persistence is the durable copy.
 *
 * Only calls the WfNewApi layer (no direct network/commands).
 */
import { useEffect, useRef } from 'react';
import { wfNewApi, type WfNewLibraryWord } from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { puterSynthesizeWord, blobToBase64, langNameToCode } from './puterAudio';
import { mapUiAccent } from './wfWordAudioFallback';

const PREFETCH_AHEAD = 3;
const PACING_MS = 250;

interface QueueItem {
  md5: string;
  word: string;
  lang: string;
  accent: 'us' | 'uk' | null;
  isCurrent: boolean;
}

interface UseLibraryPuterAudioOpts {
  libraryId: string;
  page: number;
  perPage: number;
  lastPage: number;
  lang: string;
  words: WfNewLibraryWord[];
  enabled: boolean;
  onAudioReady: (md5: string, audioUrl: string) => void;
}

export function useLibraryPuterAudio(opts: UseLibraryPuterAudioOpts): void {
  const { libraryId, page, perPage, lastPage, lang, words, enabled, onAudioReady } = opts;

  const stateRef = useRef({
    processed: new Set<string>(),
    queue: [] as QueueItem[],
    running: false,
    stop: false,
    prefetched: new Set<number>(),
  });
  const latestRef = useRef({ enabled, lang, libraryId, perPage, lastPage, page, words, onAudioReady });
  latestRef.current = { enabled, lang, libraryId, perPage, lastPage, page, words, onAudioReady };

  const pumpRef = useRef<() => Promise<void>>(async () => {});
  const enqueueRef = useRef<(w: { md5: string; word: string }, isCurrent: boolean) => void>(() => {});

  pumpRef.current = async () => {
    const s = stateRef.current;
    if (s.running) return;
    s.running = true;
    try {
      while (!s.stop) {
        const L = latestRef.current;
        if (!L.enabled) break;
        const item = s.queue.shift();
        if (!item) break;
        try {
          const result = await puterSynthesizeWord(item.word, item.lang, item.accent);
          if (result) {
            const b64 = await blobToBase64(result.blob);
            await wfNewApi.saveWordAudio({
              md5: item.md5,
              lang: item.lang,
              audio_base64: b64,
              provider: 'puter',
              accent: item.accent ?? undefined,
            }).catch(() => {});
            latestRef.current.onAudioReady(item.md5, result.objectUrl);
          }
        } catch {
          // Skip one bad word; the queue keeps draining.
        }
        s.processed.add(item.md5);
        await new Promise((r) => setTimeout(r, PACING_MS));
      }
    } finally {
      s.running = false;
    }
  };

  enqueueRef.current = (w, isCurrent) => {
    const s = stateRef.current;
    const L = latestRef.current;
    if (!w.md5 || !w.word) return;
    if (s.processed.has(w.md5)) return;
    if (s.queue.some((q) => q.md5 === w.md5)) return;
    const accent = langNameToCode(L.lang) === 'en'
      ? mapUiAccent(wfNewSettings.get('voiceAccent'))
      : null;
    const item: QueueItem = { md5: w.md5, word: w.word, lang: L.lang, accent, isCurrent };
    if (isCurrent) s.queue.unshift(item);
    else s.queue.push(item);
    void pumpRef.current();
  };

  // Reset everything when the library changes.
  useEffect(() => {
    stateRef.current = {
      processed: new Set(),
      queue: [],
      running: false,
      stop: false,
      prefetched: new Set(),
    };
  }, [libraryId]);

  // Stop the worker on unmount.
  useEffect(() => {
    stateRef.current.stop = false;
    return () => { stateRef.current.stop = true; };
  }, []);

  // Current-page words: enqueue every audio-less word (priority front).
  useEffect(() => {
    if (!enabled) return;
    for (const w of words) {
      if (!w.hasAudio) enqueueRef.current(w, true);
    }
  }, [libraryId, enabled, words, lang]);

  // Prefetch window: next PREFETCH_AHEAD pages; each switch re-derives it.
  useEffect(() => {
    if (!enabled) return;
    for (let i = 1; i <= PREFETCH_AHEAD; i++) {
      const p = page + i;
      if (p > lastPage) break;
      if (stateRef.current.prefetched.has(p)) continue;
      stateRef.current.prefetched.add(p);
      wfNewApi
        .getLibraryWords(libraryId, { page: p, perPage })
        .then((res) => {
          for (const w of res.words) {
            if (!w.hasAudio) enqueueRef.current(w, false);
          }
        })
        .catch(() => {});
    }
  }, [libraryId, page, perPage, lastPage, enabled, lang]);
}
