import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';
import type { WordAudioStatus } from '../../contracts/wordAudio';

export type { WordAudioSource, WordAudioStatus } from '../../contracts/wordAudio';

/**
 * WordAudioAPI — laravel_main's real-pronunciation lookup, surfaced on the
 * laravel-manager "Word Audio" page.
 *
 * Backed by laravel_main :9000 under the prefix `/api/local/word-audio`
 * (configured in core/api/index.ts). BaseAPI already unwraps the
 * `{ success, data, message }` envelope, so callers read `res.data` directly.
 *
 *   GET  /status                → WordAudioStatus (cheap; no network calls)
 *   POST /test { word, lang }   → WordAudioTestResult (real live fetch)
 *
 * laravel reports 2 real sources (free_dictionary_api, forvo). On a hit the
 * `/test` result carries base64 audio + mime; on a clean miss it carries a
 * message explaining the TTS fallback would handle the word.
 */

/** Body for POST /test. */
export interface WordAudioTestRequest {
  word: string;
  lang: string;
}

/**
 * Inner result of POST /test (the unwrapped `data`).
 * On a hit: success/provider/mime/audio_base64/source_id/meta/bytes.
 * On a clean miss: success=false, provider=null, message set.
 */
export interface WordAudioTestResult {
  success: boolean;
  provider: string | null;
  mime?: string;
  audio_base64?: string;
  source_id?: string;
  meta?: Record<string, any>;
  bytes?: number;
  message?: string;
}

/**
 * WordAudioAPI module. Prefix is configured in core/api/index.ts as
 * `/api/local/word-audio`, so method paths are relative to that.
 */
export class WordAudioAPI extends BaseAPI {
  /**
   * Capability status — no provider call, lists each real source with an
   * available / needs-key flag plus whether a Forvo key is present. The key
   * itself is never leaked (only forvo_key_present).
   */
  async getStatus(): Promise<APIResponse<WordAudioStatus>> {
    return this.get<WordAudioStatus>('/status', undefined, false, 0, false);
  }

  /**
   * Run a real live pronunciation fetch through the existing client. Returns
   * base64 audio + mime on a hit, or a miss message (TTS fallback) on a clean
   * miss.
   */
  async test(word: string, lang: string): Promise<APIResponse<WordAudioTestResult>> {
    return this.post<WordAudioTestResult>('/test', { word, lang });
  }
}
