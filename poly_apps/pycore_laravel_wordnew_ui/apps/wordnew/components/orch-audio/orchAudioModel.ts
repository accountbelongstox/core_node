import { BookOpen, Sparkles, AudioLines, type LucideIcon } from 'lucide-react';
import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import type {
  WfNewBookVerse,
  WfNewBookVerseLang,
  WfNewOrchAudioDetail,
  WfNewOrchAudioSegment,
  WfNewOrchAudioSentence,
  WfNewOrchAudioSource,
  WfNewReaderPlayStep,
} from '../../api';
import { wordNewArticlePlaybackHighlighter } from '../../services/WordNewArticlePlaybackHighlighter';

export type OrchAudioPlayMode = 'segments' | 'sentences';
export type OrchAudioRepeatMode = 'off' | 'one' | 'all';

export interface OrchAudioPlaybackSettings {
  mode: OrchAudioPlayMode;
  repeat: OrchAudioRepeatMode;
  rate: number;
  sentenceRepeat: number;
  bilingual: boolean;
  wordsBefore: boolean;
}

export const ORCH_AUDIO_LIMITS = Object.freeze({
  minRate: 0.25,
  maxRate: 4,
  maxSentenceRepeat: 10,
});

export const ORCH_SEGMENT_GRAIN = 'orch-segment';
export const ORCH_SENTENCE_GRAIN = 'orch-sentence';

const DEFAULT_SETTINGS: OrchAudioPlaybackSettings = {
  mode: 'segments',
  repeat: 'off',
  rate: 1,
  sentenceRepeat: 1,
  bilingual: false,
  wordsBefore: false,
};

interface OrchAudioSourceView {
  labelKey: string;
  icon: LucideIcon;
  badgeClass: string;
}

const SOURCE_VIEWS: Record<string, OrchAudioSourceView> = {
  vocab_book: { labelKey: 'orchAudio.source.vocab_book', icon: BookOpen, badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  prompt_rewrite: { labelKey: 'orchAudio.source.prompt_rewrite', icon: Sparkles, badgeClass: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20' },
};

/** Source ids with dedicated presentation, used until the backend lists its own. */
export const ORCH_AUDIO_KNOWN_SOURCES: readonly WfNewOrchAudioSource[] = Object.freeze(Object.keys(SOURCE_VIEWS));

const FALLBACK_SOURCE_VIEW: OrchAudioSourceView = {
  labelKey: 'orchAudio.source.other',
  icon: AudioLines,
  badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
};

/** Presentation for a backend source id; unknown ids fall back to a generic badge. */
export function orchAudioSourceView(source: WfNewOrchAudioSource): OrchAudioSourceView {
  return SOURCE_VIEWS[source] ?? FALLBACK_SOURCE_VIEW;
}

export function orchAudioSourceLabel(
  source: WfNewOrchAudioSource,
  trans: (key: string, replacements?: Record<string, string | number>) => string,
): string {
  const view = SOURCE_VIEWS[source];
  return view ? trans(view.labelKey) : trans(FALLBACK_SOURCE_VIEW.labelKey, { source });
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export function normalizeOrchAudioSettings(stored: Partial<OrchAudioPlaybackSettings>): OrchAudioPlaybackSettings {
  return {
    mode: stored.mode === 'sentences' ? 'sentences' : 'segments',
    repeat: stored.repeat === 'one' || stored.repeat === 'all' ? stored.repeat : 'off',
    rate: clamp(stored.rate, ORCH_AUDIO_LIMITS.minRate, ORCH_AUDIO_LIMITS.maxRate, DEFAULT_SETTINGS.rate),
    sentenceRepeat: Math.trunc(clamp(stored.sentenceRepeat, 1, ORCH_AUDIO_LIMITS.maxSentenceRepeat, 1)),
    bilingual: stored.bilingual === true,
    wordsBefore: stored.wordsBefore === true,
  };
}

export function mergeOrchAudioSettings(
  current: OrchAudioPlaybackSettings,
  patch: Partial<OrchAudioPlaybackSettings>,
): OrchAudioPlaybackSettings {
  return normalizeOrchAudioSettings({ ...current, ...patch });
}

export function loadOrchAudioSettings(): OrchAudioPlaybackSettings {
  try {
    return normalizeOrchAudioSettings(
      StorageManager.get<Partial<OrchAudioPlaybackSettings>>(StorageKeys.WORDNEW_ORCH_AUDIO_PLAYER, {}),
    );
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveOrchAudioSettings(settings: OrchAudioPlaybackSettings): void {
  try {
    StorageManager.set(StorageKeys.WORDNEW_ORCH_AUDIO_PLAYER, settings);
  } catch {
    // Settings are a per-device convenience; playback never depends on storage.
  }
}

/** Languages present in the item, primary language first. */
export function orchAudioLanguages(
  detail: WfNewOrchAudioDetail,
  sentences: readonly WfNewOrchAudioSentence[],
): string[] {
  const langs = new Set<string>([detail.item.language]);
  for (const sentence of sentences) {
    langs.add(sentence.language);
    Object.keys(sentence.languages).forEach((lang) => langs.add(lang));
  }
  return [...langs];
}

export function orchAudioPlaySequence(
  langs: string[],
  settings: OrchAudioPlaybackSettings,
): WfNewReaderPlayStep[] {
  const [primary, ...others] = langs;
  const sequence: WfNewReaderPlayStep[] = [{ lang: primary || 'en', repeat: settings.sentenceRepeat }];
  if (settings.bilingual) others.forEach((lang) => sequence.push({ lang, repeat: 1 }));
  return sequence;
}

type SentenceAt = (position: number) => WfNewOrchAudioSentence | undefined;

/** Sentence verses are keyed by position (unique, and what segments refer to). */
export function sentenceToVerse(sentence: WfNewOrchAudioSentence): WfNewBookVerse {
  const languages: Record<string, WfNewBookVerseLang> = {};
  for (const [lang, text] of Object.entries(sentence.languages)) {
    const audio = lang === sentence.language ? sentence.audioUrl : null;
    languages[lang] = { text, audio, hasAudio: !!audio };
  }
  return {
    grain: ORCH_SENTENCE_GRAIN,
    seq: sentence.position,
    ref: String(sentence.position + 1),
    text: sentence.text,
    language: sentence.language,
    languages,
  };
}

/** Loaded sentences of a segment's position range (unloaded pages are skipped). */
export function segmentSentences(
  segment: WfNewOrchAudioSegment,
  sentenceAt: SentenceAt,
): WfNewOrchAudioSentence[] {
  const out: WfNewOrchAudioSentence[] = [];
  for (let position = segment.start; position <= segment.end; position += 1) {
    const sentence = sentenceAt(position);
    if (sentence) out.push(sentence);
  }
  return out;
}

/** `fallbackText` keeps the verse playable (the engine skips empty text) while
 * the segment's sentence pages are still loading. */
export function segmentToVerse(
  segment: WfNewOrchAudioSegment,
  sentenceAt: SentenceAt,
  language: string,
  fallbackText: string,
): WfNewBookVerse {
  const text = segmentSentences(segment, sentenceAt).map((sentence) => sentence.text).join(' ') || fallbackText;
  return {
    grain: ORCH_SEGMENT_GRAIN,
    seq: segment.index,
    ref: String(segment.index),
    text,
    language,
    languages: { [language]: { text, audio: segment.url, hasAudio: !!segment.url } },
  };
}

/** Sentence position audible inside a segment clip. The per-segment `timeline`
 * is authoritative (the latest sentence entry that has started, so word clips
 * keep their sentence highlighted); the length-weighted estimate over the
 * range is only the fallback for segments delivered without one. */
export function activeSegmentSentencePosition(
  segment: WfNewOrchAudioSegment,
  sentenceAt: SentenceAt,
  currentTime: number,
  duration: number,
): number | null {
  const positionMs = currentTime * 1000;
  const timed = segment.timeline.filter((entry) => entry.type === 'sentence');
  if (timed.length > 0) {
    let hit = -1;
    timed.forEach((entry, index) => { if (entry.startMs <= positionMs) hit = index; });
    if (hit < 0) return null;
    const { seq } = timed[hit];
    if (seq != null) {
      for (let position = segment.start; position <= segment.end; position += 1) {
        if (sentenceAt(position)?.seq === seq) return position;
      }
    }
    const position = segment.start + hit;
    return position <= segment.end ? position : null;
  }
  const texts: string[] = [];
  for (let position = segment.start; position <= segment.end; position += 1) {
    texts.push(sentenceAt(position)?.text ?? '');
  }
  const ratios = wordNewArticlePlaybackHighlighter.segmentSentences(texts);
  const index = wordNewArticlePlaybackHighlighter.currentIndex(ratios, currentTime, duration);
  return index >= 0 ? segment.start + index : null;
}
