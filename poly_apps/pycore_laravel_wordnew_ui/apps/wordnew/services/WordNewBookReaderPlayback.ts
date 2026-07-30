/**
 * WordNewBookReaderPlayback — bilingual sequence playback engine for the book reader.
 * Backend MP3 first; falls back to browser speech (Edge Read Aloud / speechSynthesis).
 */
import type { WfNewBookVerse } from '../api';
import type { WfNewReaderPlayStep } from '../api/types/bookProgress';
import {
  cancelBookSpeech, pauseBookSpeech, resumeBookSpeech, speakBookText,
} from './WordNewBookReaderSpeech';

export interface WordNewBookReaderPlaybackSettings {
  sequence: WfNewReaderPlayStep[];
  speedByLang: Record<string, number>;
  autoAdvance: boolean;
  repeatOne: boolean;
}

/**
 * Word cards (English only): `before` reads words then the sentence sequence;
 * `after` reads the sentence sequence once, then words, then the sequence again.
 * `readForVerse` must be best-effort and honor `shouldContinue`.
 */
export interface WordNewBookReaderWordCards {
  isEnabled: () => boolean;
  getPosition: () => 'before' | 'after';
  readForVerse: (verse: WfNewBookVerse, shouldContinue: () => boolean) => Promise<void>;
}

export interface WordNewBookReaderPlaybackDeps {
  getVerses: () => WfNewBookVerse[];
  getSettings: () => WordNewBookReaderPlaybackSettings;
  useBrowserTts: () => boolean;
  onPlayingKey: (key: string | null) => void;
  onPlaying: (playing: boolean) => void;
  onPaused: (paused: boolean) => void;
  onVerseActive: (verse: WfNewBookVerse | null) => void;
  onProgress: (verse: WfNewBookVerse, page: number) => void;
  onLiveReadText?: (text: string, lang: string) => void;
  loadVerses: (chapterIndex: number | null, page: number, opts?: { keepOnError?: boolean; requirePlaying?: boolean }) => Promise<WfNewBookVerse[] | null>;
  getChapterIndex: () => number | null;
  getPage: () => number;
  getLastPage: () => number;
  goNextChapter: () => Promise<boolean>;
  resolveAudioUrl: (verse: WfNewBookVerse, lang: string, shouldContinue?: () => boolean) => Promise<string | null>;
  bumpMissingAudio: (verse: WfNewBookVerse, lang: string, text: string) => void;
  /** Optional word-card hook (English only) — read unrecited group words
   *  around the sentence audio. */
  wordCards?: WordNewBookReaderWordCards;
}

const keyOf = (v: WfNewBookVerse, lang: string) => `${v.grain}-${v.seq}-${lang}`;

export class WordNewBookReaderPlayback {
  private audio: HTMLAudioElement | null = null;
  private playing = false;
  private paused = false;
  private usingSpeech = false;
  private playToken = 0;
  private loadSeq = 0;
  private stepIndex = 0;
  private repeatLeft = 0;
  private currentVerse: WfNewBookVerse | null = null;
  private currentLang = '';
  private emptyCross = 0;
  private readonly maxEmptyCross = 8;

  constructor(private readonly deps: WordNewBookReaderPlaybackDeps) {}

  isPlaying(): boolean {
    return this.playing;
  }

  isPaused(): boolean {
    return this.paused;
  }

  stop(): void {
    this.loadSeq += 1;
    this.playToken += 1;
    this.playing = false;
    this.paused = false;
    this.usingSpeech = false;
    this.stepIndex = 0;
    this.repeatLeft = 0;
    this.currentVerse = null;
    this.currentLang = '';
    this.emptyCross = 0;
    if (this.audio) {
      try { this.audio.pause(); } catch { /* ignore */ }
      this.audio.onended = null;
      this.audio.onerror = null;
    }
    cancelBookSpeech();
    this.deps.onPlayingKey(null);
    this.deps.onPlaying(false);
    this.deps.onPaused(false);
    this.deps.onVerseActive(null);
    this.deps.onLiveReadText?.('', '');
  }

  pause(): void {
    if (!this.playing) return;
    this.paused = true;
    if (this.usingSpeech) pauseBookSpeech();
    else { try { this.audio?.pause(); } catch { /* ignore */ } }
    this.deps.onPaused(true);
  }

  resume(): void {
    if (!this.playing || !this.paused) return;
    this.paused = false;
    this.deps.onPaused(false);
    if (this.usingSpeech) resumeBookSpeech();
    else if (this.audio) void this.audio.play().catch(() => this.stop());
    else if (this.currentVerse) void this.runStep(this.currentVerse, this.stepIndex);
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else if (this.playing) this.pause();
  }

  async playFrom(verse: WfNewBookVerse, startLang?: string): Promise<void> {
    this.stop();
    this.playing = true;
    this.deps.onPlaying(true);
    this.currentVerse = verse;
    this.deps.onVerseActive(verse);
    this.deps.onProgress(verse, this.deps.getPage());
    const seq = this.deps.getSettings().sequence.length
      ? this.deps.getSettings().sequence
      : [{ lang: 'en', repeat: 1 }];
    let stepIdx = 0;
    if (startLang) {
      const hit = seq.findIndex((s) => s.lang === startLang);
      if (hit >= 0) stepIdx = hit;
    }
    await this.runStep(verse, stepIdx);
  }

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) this.audio = new Audio();
    return this.audio;
  }

  private getSpeed(lang: string): number {
    return this.deps.getSettings().speedByLang[lang] ?? 1;
  }

  private async playSpeechStep(
    verse: WfNewBookVerse,
    lang: string,
    text: string,
    repeats: number,
    token: number,
  ): Promise<boolean> {
    this.usingSpeech = true;
    this.deps.onPlayingKey(keyOf(verse, lang));
    this.deps.onLiveReadText?.(text, lang);
    const speed = this.getSpeed(lang);
    for (let i = 0; i < repeats; i += 1) {
      if (this.playToken !== token || !this.playing || this.paused) return false;
      try {
        await speakBookText(text, lang, speed);
      } catch {
        this.usingSpeech = false;
        return false;
      }
      while (this.paused && this.playing && this.playToken === token) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    this.usingSpeech = false;
    return true;
  }

  /**
   * Word cards around the sentence audio (English only). Guarded by the current
   * play token so a stop/jump mid-reading cancels it.
   */
  private async runWordCards(verse: WfNewBookVerse, pos: 'before' | 'after', token: number): Promise<void> {
    const wc = this.deps.wordCards;
    if (!wc || !wc.isEnabled() || wc.getPosition() !== pos) return;
    if (!this.playing || this.playToken !== token) return;
    try {
      await wc.readForVerse(verse, () => this.playing && this.playToken === token && !this.paused);
    } catch {
      /* best-effort — a word-card failure never blocks the sentence */
    }
    while (this.paused && this.playing && this.playToken === token) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  private async runStep(
    verse: WfNewBookVerse,
    stepIdx: number,
    sentenceReplay = false,
  ): Promise<void> {
    if (!this.playing || this.paused) return;
    const token = (this.playToken += 1);
    const settings = this.deps.getSettings();
    const seq = settings.sequence.length ? settings.sequence : [{ lang: 'en', repeat: 1 }];
    if (stepIdx >= seq.length) {
      if (
        !sentenceReplay
        && this.deps.wordCards?.isEnabled()
        && this.deps.wordCards.getPosition() === 'after'
      ) {
        await this.runWordCards(verse, 'after', token);
        if (!this.playing || this.playToken !== token) return;
        await this.runStep(verse, 0, true);
        return;
      }
      if (settings.repeatOne) {
        await this.runStep(verse, 0);
        return;
      }
      await this.advanceFrom(verse);
      return;
    }
    const step = seq[stepIdx];
    const lang = step.lang;
    const cell = verse.languages?.[lang];
    const text = cell?.text?.trim() ?? '';
    this.stepIndex = stepIdx;
    this.currentLang = lang;
    this.repeatLeft = step.repeat;

    // Word cards configured 'before' read ahead of the sentence's first step
    // (a mid-sequence startLang jump skips them deliberately).
    if (stepIdx === 0 && !sentenceReplay) {
      await this.runWordCards(verse, 'before', token);
      if (!this.playing || this.playToken !== token) return;
    }

    if (!text) {
      await this.runStep(verse, stepIdx + 1, sentenceReplay);
      return;
    }

    let url: string | null = null;
    const hasReadyClip = !!(cell?.hasAudio || cell?.audioFiles?.some((f) => f.hasFile && f.url));
    if (!hasReadyClip) {
      this.deps.bumpMissingAudio(verse, lang, text);
    }
    url = await this.deps.resolveAudioUrl(
      verse, lang, () => this.playing && this.playToken === token,
    );

    if (!this.playing || this.playToken !== token) return;

    if (url) {
      this.emptyCross = 0;
      this.usingSpeech = false;
      this.deps.onLiveReadText?.(text, lang);
      this.deps.onPlayingKey(keyOf(verse, lang));
      const audio = this.ensureAudio();
      audio.pause();
      audio.src = url;
      audio.playbackRate = this.getSpeed(lang);
      audio.onended = () => {
        if (this.playToken !== token || !this.playing) return;
        this.repeatLeft -= 1;
        if (this.repeatLeft > 0) {
          audio.currentTime = 0;
          audio.playbackRate = this.getSpeed(lang);
          void audio.play().catch(() => this.stop());
          return;
        }
        void this.runStep(verse, stepIdx + 1, sentenceReplay);
      };
      audio.onerror = () => {
        if (this.playToken !== token) return;
        void this.fallbackSpeechOrSkip(
          verse, lang, text, step.repeat, stepIdx, token, sentenceReplay,
        );
      };
      void audio.play().catch(() => {
        void this.fallbackSpeechOrSkip(
          verse, lang, text, step.repeat, stepIdx, token, sentenceReplay,
        );
      });
      return;
    }

    await this.fallbackSpeechOrSkip(
      verse, lang, text, step.repeat, stepIdx, token, sentenceReplay,
    );
  }

  private async fallbackSpeechOrSkip(
    verse: WfNewBookVerse,
    lang: string,
    text: string,
    repeats: number,
    stepIdx: number,
    token: number,
    sentenceReplay: boolean,
  ): Promise<void> {
    if (!this.playing || this.playToken !== token) return;
    // Backend audio missing: ALWAYS try the browser's speech engine first so
    // playback never stalls on a sentence laravel is still generating. The
    // reader bumps laravel's priority for the sentence in parallel (see
    // bumpMissingAudio), and WordNewBookReaderSpeech.pickVoice prefers Microsoft
    // Natural / Edge neural voices - i.e. the Edge Read Aloud voice. If the
    // browser has no speechSynthesis (headless / unsupported) speakBookText
    // rejects and we fall through to the skip path. The readerBrowserTts
    // setting no longer gates this missing-audio fallback: a sentence without
    // audio is always read aloud while laravel generates the real clip.
    const ok = await this.playSpeechStep(verse, lang, text, repeats, token);
    if (ok && this.playing && this.playToken === token) {
      this.emptyCross = 0;
      await this.runStep(verse, stepIdx + 1, sentenceReplay);
      return;
    }
    this.emptyCross += 1;
    if (this.emptyCross >= this.maxEmptyCross) {
      this.stop();
      return;
    }
    await this.runStep(verse, stepIdx + 1, sentenceReplay);
  }

  /**
   * Manual previous/next sentence (floating console). Always (re)starts
   * playback from the target sentence — the console's step buttons double as
   * "play from here". Next at the last sentence of the page force-crosses to
   * the next page/chapter even when autoAdvance is off; previous at the first
   * sentence crosses to the previous page's LAST sentence when one exists.
   */
  async stepSentence(delta: 1 | -1): Promise<void> {
    const verse = this.currentVerse;
    if (!verse) return;
    const list = this.deps.getVerses();
    const idx = list.findIndex((v) => v.grain === verse.grain && v.seq === verse.seq);
    if (delta > 0) {
      if (idx >= 0 && idx < list.length - 1) {
        await this.playFrom(list[idx + 1]);
        return;
      }
      await this.advanceFrom(verse, true);
      return;
    }
    if (idx > 0) {
      await this.playFrom(list[idx - 1]);
      return;
    }
    const page = this.deps.getPage();
    if (page > 1) {
      const myLoad = (this.loadSeq += 1);
      const items = await this.deps.loadVerses(this.deps.getChapterIndex(), page - 1, { keepOnError: true });
      if (this.loadSeq !== myLoad || !items?.length) return;
      await this.playFrom(items[items.length - 1]);
    }
  }

  /** `force` = manual next-sentence at a page/chapter boundary: cross over
   *  even when autoAdvance is off (autoAdvance only gates the AUTO pass). */
  private async advanceFrom(verse: WfNewBookVerse, force = false): Promise<void> {
    const settings = this.deps.getSettings();
    if (!settings.autoAdvance && !force) {
      this.stop();
      return;
    }
    const list = this.deps.getVerses();
    const idx = list.findIndex((v) => v.grain === verse.grain && v.seq === verse.seq);
    if (idx >= 0 && idx < list.length - 1) {
      const next = list[idx + 1];
      this.currentVerse = next;
      this.deps.onVerseActive(next);
      this.deps.onProgress(next, this.deps.getPage());
      await this.runStep(next, 0);
      return;
    }
    const page = this.deps.getPage();
    const lastPage = this.deps.getLastPage();
    if (page < lastPage) {
      const myLoad = (this.loadSeq += 1);
      const items = await this.deps.loadVerses(this.deps.getChapterIndex(), page + 1, { keepOnError: true, requirePlaying: true });
      if (!this.playing || this.loadSeq !== myLoad || !items?.length) {
        if (this.playing) this.stop();
        return;
      }
      const next = items[0];
      this.currentVerse = next;
      this.deps.onVerseActive(next);
      this.deps.onProgress(next, page + 1);
      await this.runStep(next, 0);
      return;
    }
    const moved = await this.deps.goNextChapter();
    if (!moved) this.stop();
  }
}
