import { langCodeToBcp47 } from './WordNewBookReaderA11y';

export interface SpeakTextOptions {
  /** Language code ("en", "zh") or BCP-47 tag; defaults to en-US. */
  lang?: string;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

/** True when the browser exposes the Web Speech synthesis API. */
export function isSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Stops any speech in progress. */
export function cancelSpeech(): void {
  if (isSpeechAvailable()) window.speechSynthesis.cancel();
}

/** Speaks `text` with the browser voice after cancelling the current utterance; false when speech is unavailable. */
export function speakText(text: string, options: SpeakTextOptions = {}): boolean {
  if (!isSpeechAvailable()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCodeToBcp47(options.lang ?? 'en');
  if (options.rate !== undefined) utterance.rate = options.rate;
  if (options.onStart) utterance.onstart = options.onStart;
  if (options.onEnd) utterance.onend = options.onEnd;
  if (options.onError) utterance.onerror = options.onError;
  window.speechSynthesis.speak(utterance);
  return true;
}
