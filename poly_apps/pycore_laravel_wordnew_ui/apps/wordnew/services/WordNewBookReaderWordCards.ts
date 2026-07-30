import { resolveAudioSync } from '../cache/WfNewAudioCache';
import { getSentenceWordTable, markSentenceWordsPlayed } from './WordNewSentenceWordTable';
import { speakBookText } from './WordNewBookReaderSpeech';

const WORD_CLIP_TIMEOUT_MS = 8000;
const MAX_WORDS_PER_SENTENCE = 40;

async function playWordClip(
  audioUrl: string | null | undefined,
  word: string,
  shouldContinue: () => boolean,
): Promise<void> {
  const url = audioUrl ? resolveAudioSync(audioUrl) ?? audioUrl : null;
  if (!url || !/^https?:\/\//.test(url)) {
    if (!shouldContinue()) return;
    await speakBookText(word, 'en', 0.9).catch(() => undefined);
    return;
  }
  return new Promise<void>((resolve) => {
    let done = false;
    let guard: ReturnType<typeof setTimeout>;
    let poll: ReturnType<typeof setInterval>;
    const audio = new Audio(url);
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      clearInterval(poll);
      try { audio.pause(); } catch { /* best-effort */ }
      resolve();
    };
    guard = setTimeout(finish, WORD_CLIP_TIMEOUT_MS);
    poll = setInterval(() => {
      if (!shouldContinue()) finish();
    }, 150);
    audio.onended = finish;
    audio.onerror = finish;
    void audio.play().catch(finish);
  });
}

export async function readWordCardsForSentence(
  sentenceText: string,
  shouldContinue: () => boolean,
  repeats = 1,
  mode: 'new' | 'all' = 'new',
): Promise<void> {
  const table = await getSentenceWordTable(sentenceText, 'en', 'zh').catch(() => []);
  const words = table
    .filter((word) => mode === 'all' || !word.played)
    .slice(0, MAX_WORDS_PER_SENTENCE);
  const played: string[] = [];
  const repeatCount = Math.max(1, Math.min(10, repeats));

  for (const word of words) {
    if (!shouldContinue()) return;
    for (let count = 0; count < repeatCount; count += 1) {
      if (!shouldContinue()) return;
      await playWordClip(word.audio_url, word.word, shouldContinue);
    }
    played.push(word.word);
  }

  if (played.length > 0) {
    await markSentenceWordsPlayed(played, 'en').catch(() => undefined);
  }
}
