/**
 * WfBookReaderWordCards — the book reader's "显示单词卡片" (show word cards)
 * feature, modeled on the shelf word-recite surface.
 *
 * ENGLISH ONLY: tokens are extracted from the sentence's ENGLISH cell and
 * matched against the user's Default Vocabulary Group (an English word list);
 * the UI label states this limitation and non-English sentences simply match
 * nothing.
 *
 * Flow per sentence about to be read (driven by WfBookReaderPlayback):
 *   1. extract English word tokens from the sentence text;
 *   2. match them (lowercased) against the Default Vocabulary Group words —
 *      the group word list is loaded ONCE per session (getWordGroups →
 *      getVocabulary) and cached here, never refetched per sentence;
 *   3. keep only words NOT yet recited — backend read count rc === 0 via the
 *      local wfNewStudyProgress records (seeded best-effort from the backend
 *      progress blob on first load; a word with no record counts as rc 0);
 *   4. read each matched word aloud in sentence order BEFORE or AFTER the
 *      sentence audio (configurable, readerWordCardPosition).
 *
 * Word audio goes through WfNewAudioCache.resolveAudioSync (local cache first;
 * a miss plays the remote URL and caches in the background). Everything is
 * best-effort and non-blocking: every clip has a hard timeout like the recite
 * controller's guard, and a missing/failed clip falls through to the next word
 * so the reader never freezes.
 */
import { wfNewApi, DEFAULT_VOCAB_GROUP_NAME, type Word } from '../api';
import { wfNewStudyProgress } from '../components/study/WfNewStudyProgress';
import { wfProgressCenter } from './WfProgressCenter';
import { resolveAudioSync } from '../cache/WfNewAudioCache';

/** Hard ceiling per word clip so a stuck/missing clip can never freeze the loop
 *  (mirrors the recite controller's 8s guard). */
const WORD_CLIP_TIMEOUT_MS = 8000;
/** Cap on words read per sentence so a dense sentence cannot flood the queue. */
const MAX_WORDS_PER_SENTENCE = 6;

interface WordCardIndex {
  gid: string;
  /** lowercased word text → group word (entries with audio win). */
  byText: Map<string, Word>;
}

/** Session-cached default-group index (null = unavailable / guest). */
let indexPromise: Promise<WordCardIndex | null> | null = null;

/**
 * Load the Default Vocabulary Group word list once per session. The backend
 * progress blob is ingested into wfNewStudyProgress on the same pass so the
 * rc === 0 filter reflects REAL backend read counts, not just local marks.
 * Best-effort: any failure degrades to null (word cards silently off).
 */
export function ensureWordCardIndex(): Promise<WordCardIndex | null> {
  if (indexPromise) return indexPromise;
  indexPromise = (async (): Promise<WordCardIndex | null> => {
    try {
      if (!wfNewApi.isAuthenticated()) return null;
      const groups = await wfNewApi.getWordGroups();
      const group = groups.find((g) => g.name === DEFAULT_VOCAB_GROUP_NAME) ?? groups[0];
      if (!group) return null;
      const gid = group.id;
      try {
        const blob = await wfProgressCenter.getBlob(gid);
        wfNewStudyProgress.ingestBlob(gid, blob);
      } catch {
        /* progress enrichment is best-effort; local records still apply */
      }
      const words = await wfNewApi.getVocabulary(gid);
      const byText = new Map<string, Word>();
      for (const w of words) {
        const key = (w.text || '').trim().toLowerCase();
        if (!key) continue;
        const prev = byText.get(key);
        if (!prev || (!prev.audioUrl && w.audioUrl)) byText.set(key, w);
      }
      return { gid, byText };
    } catch (e) {
      console.warn('[wordnew] Word-card group load failed (feature off).', e);
      return null;
    }
  })();
  return indexPromise;
}

/**
 * English word tokens of a sentence, in order, deduped, matched against the
 * group index and filtered to NOT-yet-recited words (rc === 0 via
 * wfNewStudyProgress.recordOf). Returns at most MAX_WORDS_PER_SENTENCE.
 */
export function matchUnrecitedWords(index: WordCardIndex, sentenceText: string): Word[] {
  const tokens = sentenceText.match(/[A-Za-z]+(?:['’][a-z]+)?/g) || [];
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const raw of tokens) {
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const word = index.byText.get(key);
    if (!word) continue;
    // "Not yet recited" = backend read count 0; no local record counts as 0.
    if ((wfNewStudyProgress.recordOf(index.gid, word.id)?.rc ?? 0) > 0) continue;
    out.push(word);
    if (out.length >= MAX_WORDS_PER_SENTENCE) break;
  }
  return out;
}

/**
 * Play one word clip once; resolves when it ends, errors, or hits the hard
 * timeout. Audio resolves through resolveAudioSync (local cache first, remote
 * URL otherwise + background cache fill). Never throws, never freezes.
 */
function playWordClip(word: Word, shouldContinue: () => boolean): Promise<void> {
  return new Promise<void>((resolve) => {
    const url = resolveAudioSync(word.audioUrl) ?? word.audioUrl;
    if (!url || !/^https?:\/\//.test(url)) return resolve();
    let done = false;
    const guard = setTimeout(() => finish(), WORD_CLIP_TIMEOUT_MS);
    const poll = setInterval(() => {
      if (!shouldContinue()) finish();
    }, 150);
    const audio = new Audio(url);
    function finish(): void {
      if (done) return;
      done = true;
      clearTimeout(guard);
      clearInterval(poll);
      try { audio.pause(); } catch { /* ignore */ }
      resolve();
    }
    audio.onended = () => finish();
    audio.onerror = () => finish();
    void audio.play().catch(() => finish());
  });
}

/**
 * Read the not-yet-recited Default Vocabulary Group words of one sentence
 * aloud in sequence. Best-effort: loads the session index lazily, and any
 * failure (guest, offline, missing clip) just falls through so the sentence
 * audio is never blocked.
 */
export async function readWordCardsForSentence(
  sentenceText: string,
  shouldContinue: () => boolean,
): Promise<void> {
  const index = await ensureWordCardIndex();
  if (!index || !shouldContinue()) return;
  const words = matchUnrecitedWords(index, sentenceText);
  for (const word of words) {
    if (!shouldContinue()) return;
    await playWordClip(word, shouldContinue);
  }
}
