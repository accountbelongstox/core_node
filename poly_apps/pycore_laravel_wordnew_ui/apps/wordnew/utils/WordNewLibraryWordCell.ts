/**
 * WordNewLibraryWordCell - adapt a library word (+ optional on-demand resolved
 * media) into the WfNewBookVerseLang cell shape so the SAME sentence-audio
 * helpers (pickSentenceAudioUrl, readySentenceVariants) used by the book reader
 * work unchanged on the library table.
 *
 * Multi-audio source order (contract: read audioFiles ?? audioVariants):
 *   1. word.audioFiles (canonical, from the list payload)
 *   2. word.audioVariants (alias on the list payload)
 *   3. resolved.audioFiles (canonical, from word-media resolve)
 *   4. resolved.audioVariants (accent-based WfNewWordAudioVariant[], mapped up)
 */
import type {
  WfNewLibraryWord,
  WfNewWordMedia,
  WfNewBookVerseLang,
  WordNewAudioFileVariant,
} from '../api';

/** Map the accent-based per-word variants (us/uk) up to the file-variant shape. */
export function mapWordMediaVariants(resolved: WfNewWordMedia | undefined): WordNewAudioFileVariant[] {
  const files = resolved?.audioFiles ?? [];
  if (files.length) return files;
  const acc = resolved?.audioVariants ?? [];
  return acc
    .filter((v) => v && v.url)
    .map((v): WordNewAudioFileVariant => ({
      variantKey: v.accent,
      accent: v.accent === 'unknown' ? undefined : v.accent,
      url: v.url,
      hasFile: v.status === 'ready' && !!v.url,
      provider: 'word-media',
    }));
}

/** Build a book-reader-shaped cell from a library word + resolved media overlay. */
export function buildWordCell(
  word: WfNewLibraryWord,
  resolved: WfNewWordMedia | undefined,
): WfNewBookVerseLang {
  const files = word.audioFiles ?? word.audioVariants ?? mapWordMediaVariants(resolved);
  const audioUrl = word.audioUrl ?? resolved?.audioUrl ?? null;
  const hasAudio = !!word.hasAudio
    || !!audioUrl
    || files.some((f) => f.hasFile && f.url);
  const ttsStatus = word.ttsStatus
    ?? (resolved?.audioStatus === 'ready' ? 'completed' : resolved ? 'pending' : null);
  return {
    text: word.word,
    audio: audioUrl,
    hasAudio,
    ttsStatus,
    audioFiles: files,
    explanation: word.explanation ?? null,
  };
}
