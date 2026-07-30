/**
 * puterTranslate - client-side AI translation via Puter.js (free, no API key).
 *
 * Uses puter.ai.chat() with a translation prompt as a fallback when the backend
 * translation API is unavailable. Lazy-loads the Puter.js SDK on first use.
 *
 * Integration pattern mirrors wordNewWordAudioFallback.ts (Puter.js TTS tier).
 */

const PUTER_SRC = 'https://js.puter.com/v2/';
let puterLoadPromise: Promise<boolean> | null = null;

/** Lazy-inject the Puter.js script ONCE — called only on first translation request. */
function ensurePuterLoaded(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  if ((window as any).puter?.ai?.chat) return Promise.resolve(true);
  if (!puterLoadPromise) {
    puterLoadPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = PUTER_SRC;
      script.async = true;
      script.onload = () => resolve(!!(window as any).puter?.ai?.chat);
      script.onerror = () => {
        puterLoadPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }
  return puterLoadPromise;
}

/**
 * Translate text via Puter.js AI chat. Returns the translated string, or null
 * when Puter is unavailable or the request fails.
 *
 * @param text The text to translate
 * @param sourceLang Source language (e.g., 'en', 'zh', 'auto' for auto-detect)
 * @param targetLang Target language (e.g., 'zh', 'en', 'ja')
 * @param model Optional model override (default: gpt-5-nano)
 */
export async function puterTranslate(
  text: string,
  sourceLang: string,
  targetLang: string,
  model = 'gpt-5-nano',
): Promise<string | null> {
  const loaded = await ensurePuterLoaded();
  if (!loaded) return null;

  const sourceHint = sourceLang === 'auto' ? '' : ` from ${sourceLang}`;
  const prompt = `Translate the following text${sourceHint} to ${targetLang}. Return ONLY the translated text, nothing else:\n\n${text}`;

  try {
    const response = await (window as any).puter.ai.chat(prompt, {
      model,
      temperature: 0.3,
      max_tokens: 1024,
    });
    const result = response?.message?.content ?? response?.text ?? response?.toString();
    return typeof result === 'string' ? result.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Check if Puter.js translation is available (SDK loaded + AI chat functional).
 */
export function isPuterTranslateAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).puter?.ai?.chat;
}
