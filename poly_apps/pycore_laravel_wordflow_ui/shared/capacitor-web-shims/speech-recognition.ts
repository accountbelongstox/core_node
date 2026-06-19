/**
 * Web shim for @capacitor-community/speech-recognition.
 *
 * Backs the community SpeechRecognition plugin with the browser
 * webkitSpeechRecognition / SpeechRecognition API so spoken input works in the
 * web build (where the plugin is aliased to this file — see vite.config.ts).
 * Mirrors the plugin's method + listener shapes.
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working.
 */

export interface SRStartOptions {
  language?: string;
  maxResults?: number;
  prompt?: string; // android popup prompt (ignored on web)
  popup?: boolean; // android popup (ignored on web)
  partialResults?: boolean;
}

export type SRListeningStatus = 'started' | 'stopped';
export interface PluginListenerHandle {
  remove: () => Promise<void>;
}

type PartialCb = (data: { matches: string[] }) => void;
type StateCb = (data: { status: SRListeningStatus }) => void;

function SRCtor(): any {
  try {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  } catch {
    return null;
  }
}

let recognition: any = null;
const partialListeners = new Set<PartialCb>();
const stateListeners = new Set<StateCb>();

function emitState(status: SRListeningStatus): void {
  stateListeners.forEach((fn) => {
    try {
      fn({ status });
    } catch {
      /* ignore */
    }
  });
}

export const SpeechRecognition = {
  async available(): Promise<{ available: boolean }> {
    return { available: !!SRCtor() };
  },

  async checkPermissions(): Promise<{ speechRecognition: string }> {
    try {
      const perm = (navigator as any)?.permissions;
      if (perm?.query) {
        const res = await perm.query({ name: 'microphone' as PermissionName });
        return { speechRecognition: res.state };
      }
    } catch {
      /* fall through */
    }
    return { speechRecognition: SRCtor() ? 'prompt' : 'denied' };
  },

  async requestPermissions(): Promise<{ speechRecognition: string }> {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      return { speechRecognition: 'granted' };
    } catch {
      return { speechRecognition: 'denied' };
    }
  },

  async start(options: SRStartOptions = {}): Promise<{ matches?: string[] }> {
    const Ctor = SRCtor();
    if (!Ctor) throw new Error('SpeechRecognition is not available in this browser.');
    const rec = new Ctor();
    recognition = rec;
    rec.lang = options.language || 'en-US';
    rec.maxAlternatives = options.maxResults ?? 5;
    rec.interimResults = options.partialResults ?? false;
    rec.continuous = false;

    return new Promise((resolve, reject) => {
      let finalMatches: string[] = [];
      rec.onresult = (event: any) => {
        const matches: string[] = [];
        const result = event.results[event.results.length - 1];
        for (let i = 0; i < result.length; i++) matches.push(result[i].transcript);
        if (result.isFinal) {
          finalMatches = matches;
        } else if (options.partialResults) {
          partialListeners.forEach((fn) => {
            try {
              fn({ matches });
            } catch {
              /* ignore */
            }
          });
        }
      };
      rec.onerror = (e: any) => reject(new Error(e?.error || 'speech recognition error'));
      rec.onstart = () => emitState('started');
      rec.onend = () => {
        emitState('stopped');
        resolve({ matches: finalMatches });
      };
      try {
        rec.start();
      } catch (e) {
        reject(e);
      }
    });
  },

  async stop(): Promise<void> {
    try {
      recognition?.stop();
    } catch {
      /* ignore */
    }
  },

  async getSupportedLanguages(): Promise<{ languages: string[] }> {
    // The Web Speech API does not enumerate languages; return a common subset.
    return {
      languages: ['en-US', 'en-GB', 'zh-CN', 'zh-TW', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'ru-RU'],
    };
  },

  async addListener(
    eventName: 'partialResults' | 'listeningState',
    cb: PartialCb | StateCb,
  ): Promise<PluginListenerHandle> {
    if (eventName === 'partialResults') partialListeners.add(cb as PartialCb);
    else if (eventName === 'listeningState') stateListeners.add(cb as StateCb);
    return {
      remove: async () => {
        partialListeners.delete(cb as PartialCb);
        stateListeners.delete(cb as StateCb);
      },
    };
  },

  async removeAllListeners(): Promise<void> {
    partialListeners.clear();
    stateListeners.clear();
  },
};

export default { SpeechRecognition };
