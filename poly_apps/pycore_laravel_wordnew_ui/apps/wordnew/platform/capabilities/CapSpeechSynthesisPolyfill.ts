/* =============================================================================
 * CapSpeechSynthesisPolyfill - the Web Speech synthesis API inside the native app
 * =============================================================================
 *
 * The Android WebView has no `window.speechSynthesis` / `SpeechSynthesisUtterance`;
 * every page that reads text aloud (walkman, subtitles, bilingual, recite, word
 * audio fallback, book reader, daily reading) calls that API directly. In the
 * native shell this installs a standard-shaped implementation on the
 * @capacitor-community/text-to-speech plugin: one utterance at a time in queue
 * order, `start` / `end` / `error` events and the `on*` handlers, `cancel`
 * (current: `interrupted`, queued: `canceled`), `speaking` / `pending` /
 * `paused`. Browsers keep their own implementation (never replaced).
 * ========================================================================== */
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { isNativeAppShell } from '../../../../core/network/NativeShell';

type UtteranceEventName = 'start' | 'end' | 'error' | 'pause' | 'resume' | 'boundary' | 'mark';

const RATE_RANGE = [0.1, 2] as const;
const PITCH_RANGE = [0, 2] as const;
const VOLUME_RANGE = [0, 1] as const;
const QUEUE_STRATEGY_FLUSH = 0;

const clamp = (value: number, [min, max]: readonly [number, number]): number => Math.min(max, Math.max(min, value));

class NativeSpeechSynthesisUtterance extends EventTarget {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onpause: ((event: Event) => void) | null = null;
  onresume: ((event: Event) => void) | null = null;
  onboundary: ((event: Event) => void) | null = null;
  onmark: ((event: Event) => void) | null = null;

  constructor(text = '') {
    super();
    this.text = text;
  }

  /** Dispatch a Web-Speech-shaped event to the listeners and the `on*` handler. */
  emit(name: UtteranceEventName, extra: Record<string, unknown> = {}): void {
    const event = Object.assign(new Event(name), { utterance: this, charIndex: 0, elapsedTime: 0, name: '' }, extra);
    this.dispatchEvent(event);
    const handler = this[`on${name}` as `on${UtteranceEventName}`];
    handler?.call(this, event);
  }
}

class NativeSpeechSynthesis extends EventTarget {
  onvoiceschanged: ((event: Event) => void) | null = null;
  private queue: NativeSpeechSynthesisUtterance[] = [];
  private current: NativeSpeechSynthesisUtterance | null = null;
  private isPaused = false;

  get speaking(): boolean { return this.current !== null; }
  get pending(): boolean { return this.queue.length > 0; }
  get paused(): boolean { return this.isPaused; }

  getVoices(): SpeechSynthesisVoice[] {
    return [];
  }

  speak(utterance: SpeechSynthesisUtterance): void {
    this.queue.push(utterance as unknown as NativeSpeechSynthesisUtterance);
    if (!this.current && !this.isPaused) void this.next();
  }

  cancel(): void {
    const dropped = this.queue.splice(0);
    const current = this.current;
    this.current = null;
    this.isPaused = false;
    void TextToSpeech.stop().catch(() => undefined);
    current?.emit('error', { error: 'interrupted' });
    dropped.forEach((utterance) => utterance.emit('error', { error: 'canceled' }));
  }

  /** The plugin cannot pause mid-utterance: the current one stops, the queue waits. */
  pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    const current = this.current;
    if (current) {
      this.current = null;
      this.queue.unshift(current);
      void TextToSpeech.stop().catch(() => undefined);
      current.emit('pause');
    }
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    const head = this.queue[0];
    head?.emit('resume');
    if (!this.current) void this.next();
  }

  private async next(): Promise<void> {
    const utterance = this.queue.shift();
    if (!utterance) return;
    this.current = utterance;
    utterance.emit('start');
    try {
      await TextToSpeech.speak({
        text: utterance.text,
        lang: utterance.lang || undefined,
        rate: clamp(utterance.rate, RATE_RANGE),
        pitch: clamp(utterance.pitch, PITCH_RANGE),
        volume: clamp(utterance.volume, VOLUME_RANGE),
        queueStrategy: QUEUE_STRATEGY_FLUSH,
      } as Parameters<typeof TextToSpeech.speak>[0]);
    } catch (error) {
      // A cancel / pause already reported this utterance and moved on.
      if (this.current !== utterance) return;
      this.current = null;
      utterance.emit('error', { error: 'synthesis-failed', message: String((error as Error)?.message ?? error) });
      if (!this.isPaused) void this.next();
      return;
    }
    if (this.current !== utterance) return;
    this.current = null;
    utterance.emit('end');
    if (!this.isPaused) void this.next();
  }
}

let installed = false;

/** Install the native-backed Web Speech synthesis API when the WebView lacks it (idempotent). */
export function installNativeSpeechSynthesis(): void {
  if (installed || typeof window === 'undefined' || !isNativeAppShell()) return;
  installed = true;
  const target = window as unknown as Record<string, unknown>;
  if (!target.speechSynthesis) {
    Object.defineProperty(window, 'speechSynthesis', { value: new NativeSpeechSynthesis(), configurable: true });
  }
  if (!target.SpeechSynthesisUtterance) {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: NativeSpeechSynthesisUtterance, configurable: true, writable: true });
  }
}
