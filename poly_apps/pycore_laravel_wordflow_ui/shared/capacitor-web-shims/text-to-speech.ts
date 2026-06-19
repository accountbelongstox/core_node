/**
 * Web shim for @capacitor-community/text-to-speech.
 *
 * Backs the community TextToSpeech plugin with the browser SpeechSynthesis API
 * so pronunciation playback works in the web build (where the plugin is aliased
 * to this file — see vite.config.ts). Mirrors the plugin's method shapes.
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working.
 */

export interface TTSSpeakOptions {
  text: string;
  lang?: string;
  rate?: number; // 0.1 .. 10 (web); plugin uses ~0.1..2
  pitch?: number; // 0 .. 2
  volume?: number; // 0 .. 1
  /** Index into getSupportedVoices().voices (community plugin convention). */
  voice?: number;
  category?: string; // iOS audio session category (ignored on web)
  queueStrategy?: number; // 0 = flush, 1 = add (community convention)
}

export interface TTSVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}

function listVoices(): SpeechSynthesisVoice[] {
  const s = synth();
  if (!s) return [];
  try {
    return s.getVoices() || [];
  } catch {
    return [];
  }
}

export const TextToSpeech = {
  async speak(options: TTSSpeakOptions): Promise<void> {
    const s = synth();
    if (!s || typeof SpeechSynthesisUtterance === 'undefined') {
      throw new Error('SpeechSynthesis is not available in this browser.');
    }
    if (!options.queueStrategy) s.cancel(); // 0/undefined => flush
    return new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(options.text || '');
      if (options.lang) u.lang = options.lang;
      if (typeof options.rate === 'number') u.rate = options.rate;
      if (typeof options.pitch === 'number') u.pitch = options.pitch;
      if (typeof options.volume === 'number') u.volume = options.volume;
      if (typeof options.voice === 'number') {
        const voices = listVoices();
        if (voices[options.voice]) u.voice = voices[options.voice];
      }
      u.onend = () => resolve();
      u.onerror = (e) => reject(new Error((e as any)?.error || 'tts error'));
      s.speak(u);
    });
  },

  async stop(): Promise<void> {
    synth()?.cancel();
  },

  async getSupportedLanguages(): Promise<{ languages: string[] }> {
    const langs = new Set<string>();
    for (const v of listVoices()) if (v.lang) langs.add(v.lang);
    return { languages: Array.from(langs).sort() };
  },

  async getSupportedVoices(): Promise<{ voices: TTSVoice[] }> {
    return {
      voices: listVoices().map((v) => ({
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
      })),
    };
  },

  async isLanguageSupported(options: { lang: string }): Promise<{ supported: boolean }> {
    const target = (options.lang || '').toLowerCase();
    const supported = listVoices().some(
      (v) => v.lang?.toLowerCase() === target || v.lang?.toLowerCase().startsWith(target.split('-')[0]),
    );
    return { supported };
  },

  async openInstall(): Promise<void> {
    /* no-op on web */
  },
};

export default { TextToSpeech };
