/**
 * Browser speech fallback for the book reader (Edge Read Aloud / Web Speech API).
 * Used when backend sentence audio is not yet available.
 */
import { langCodeToBcp47, isBrowserReadAloudAvailable } from '../utils/WfBookReaderA11y';

let voicesWarmed = false;

function warmVoices(): void {
  if (voicesWarmed || typeof window === 'undefined' || !window.speechSynthesis) return;
  voicesWarmed = true;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const bcp = langCodeToBcp47(lang).toLowerCase();
  const primary = lang.toLowerCase().split('-')[0];
  return voices.find((v) => v.lang.toLowerCase() === bcp)
    || voices.find((v) => v.lang.toLowerCase().startsWith(`${primary}-`))
    || voices.find((v) => v.lang.toLowerCase().startsWith(primary))
    || null;
}

export function cancelBookSpeech(): void {
  if (!isBrowserReadAloudAvailable()) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

export function pauseBookSpeech(): void {
  if (!isBrowserReadAloudAvailable()) return;
  try { window.speechSynthesis.pause(); } catch { /* ignore */ }
}

export function resumeBookSpeech(): void {
  if (!isBrowserReadAloudAvailable()) return;
  try { window.speechSynthesis.resume(); } catch { /* ignore */ }
}

/** Speak one utterance; resolves on end, rejects on error/unavailable. */
export function speakBookText(text: string, lang: string, rate: number): Promise<void> {
  warmVoices();
  return new Promise((resolve, reject) => {
    if (!isBrowserReadAloudAvailable() || !text.trim()) {
      reject(new Error('speech_unavailable'));
      return;
    }
    cancelBookSpeech();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = langCodeToBcp47(lang);
    utterance.rate = Math.min(2, Math.max(0.5, rate));
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('speech_error'));
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      reject(new Error('speech_throw'));
    }
  });
}
