/**
 * WordNewLibraryPlayback - top-to-bottom word playback engine for the library table.
 *
 * Mirrors WordNewBookReaderPlayback but simpler: each node is ONE word (single
 * language, no bilingual sequence, no chapters). Backend MP3 first; when a word
 * has no ready clip the deps.resolveAudioUrl polls the sentence-audio scheduler
 * (which both resolves AND bumps priority). On clip end -> advanceFrom to the
 * next word in the page (autoAdvance), or stop.
 *
 * Clicking another row calls playFrom(thatWord) which re-roots currentNode and
 * keeps playing from there (matches the book reader "click row -> playFrom").
 */
import type { WfNewLibraryWord } from '../api';
import { ensureAudio } from '../runtime-store/WfNewAudioCache';

export interface WordNewLibraryPlaybackDeps {
  /** Current ordered word list (the rendered page). */
  getWords: () => WfNewLibraryWord[];
  /** Library language used to resolve/bump missing audio. */
  getLang: () => string;
  autoAdvance: () => boolean;
  onPlayingKey: (key: string | null) => void;
  onPlaying: (playing: boolean) => void;
  onPaused: (paused: boolean) => void;
  onWordActive: (word: WfNewLibraryWord | null) => void;
  /** Resolve an absolute MP3 url for the word (may poll the sentence-audio
   *  scheduler). Return null to give up on this word. */
  resolveAudioUrl: (word: WfNewLibraryWord, shouldContinue?: () => boolean) => Promise<string | null>;
  /** Priority nudge for a word whose clip is missing (Laravel relay). */
  bumpMissingAudio: (word: WfNewLibraryWord, lang: string) => void;
}

const keyOf = (w: WfNewLibraryWord, lang: string) => `${w.md5 || w.index}:${lang}`;

export class WordNewLibraryPlayback {
  private audio: HTMLAudioElement | null = null;
  private playing = false;
  private paused = false;
  private playToken = 0;
  private currentWord: WfNewLibraryWord | null = null;
  private currentLang = '';
  private emptyCross = 0;
  private readonly maxEmptyCross = 8;

  constructor(private readonly deps: WordNewLibraryPlaybackDeps) {}

  isPlaying(): boolean { return this.playing; }
  isPaused(): boolean { return this.paused; }

  currentKey(): string | null {
    return this.currentWord ? keyOf(this.currentWord, this.currentLang) : null;
  }

  stop(): void {
    this.playToken += 1;
    this.playing = false;
    this.paused = false;
    this.currentWord = null;
    this.currentLang = '';
    this.emptyCross = 0;
    if (this.audio) {
      try { this.audio.pause(); } catch { /* ignore */ }
      this.audio.onended = null;
      this.audio.onerror = null;
    }
    this.deps.onPlayingKey(null);
    this.deps.onPlaying(false);
    this.deps.onPaused(false);
    this.deps.onWordActive(null);
  }

  pause(): void {
    if (!this.playing) return;
    this.paused = true;
    try { this.audio?.pause(); } catch { /* ignore */ }
    this.deps.onPaused(true);
  }

  resume(): void {
    if (!this.playing || !this.paused) return;
    this.paused = false;
    this.deps.onPaused(false);
    if (this.audio) void this.audio.play().catch(() => this.stop());
    else if (this.currentWord) void this.runWord(this.currentWord);
  }

  togglePause(): void {
    if (this.paused) this.resume();
    else if (this.playing) this.pause();
  }

  /** Begin playing from `word` (re-roots currentNode). Continues to subsequent
   *  words while autoAdvance is on. */
  async playFrom(word: WfNewLibraryWord): Promise<void> {
    this.stop();
    this.playing = true;
    this.deps.onPlaying(true);
    this.currentWord = word;
    this.currentLang = this.deps.getLang();
    this.deps.onWordActive(word);
    await this.runWord(word);
  }

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) this.audio = new Audio();
    return this.audio;
  }

  private async runWord(word: WfNewLibraryWord): Promise<void> {
    if (!this.playing || this.paused) return;
    const token = (this.playToken += 1);
    const lang = this.deps.getLang();
    this.currentLang = lang;
    this.currentWord = word;
    this.deps.onWordActive(word);
    this.deps.onPlayingKey(keyOf(word, lang));

    const hasReady = !!word.audioUrl || !!(word.audioFiles ?? word.audioVariants)?.some((f) => f.hasFile && f.url);
    if (!hasReady) this.deps.bumpMissingAudio(word, lang);

    const remoteUrl = await this.deps.resolveAudioUrl(word, () => this.playing && this.playToken === token);
    const url = remoteUrl ? (await ensureAudio(remoteUrl)) ?? remoteUrl : null;
    if (!this.playing || this.playToken !== token) return;

    if (!url) {
      this.emptyCross += 1;
      if (this.emptyCross >= this.maxEmptyCross) { this.stop(); return; }
      await this.advanceFrom(word);
      return;
    }

    this.emptyCross = 0;
    const audio = this.ensureAudio();
    audio.pause();
    audio.src = url;
    audio.onended = () => {
      if (this.playToken !== token || !this.playing) return;
      void this.advanceFrom(word);
    };
    audio.onerror = () => {
      if (this.playToken !== token) return;
      this.emptyCross += 1;
      if (this.emptyCross >= this.maxEmptyCross) { this.stop(); return; }
      void this.advanceFrom(word);
    };
    void audio.play().catch(() => { void this.advanceFrom(word); });
  }

  private async advanceFrom(word: WfNewLibraryWord): Promise<void> {
    if (!this.deps.autoAdvance()) { this.stop(); return; }
    const list = this.deps.getWords();
    const idx = list.findIndex((w) => (w.md5 || w.index) === (word.md5 || word.index));
    if (idx >= 0 && idx < list.length - 1) {
      await this.runWord(list[idx + 1]);
      return;
    }
    // End of page: stop (the library page is paginated; the user flips the page
    // manually, unlike the reader's auto chapter advance).
    this.stop();
  }
}
