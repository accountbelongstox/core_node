/**
 * Shared helpers for the AI web-chat automation tools (ChatGPT / Gemini).
 *
 * These tools drive the user's CURRENTLY-RUNNING browser: they reuse a live
 * provider tab when one exists and only open a new tab as a fallback. The
 * captured reply audio is uploaded to the Laravel backend as a binary blob via
 * the no-auth ingest route POST /api/app_qy_v1/media/ai-audio.
 *
 * Page-context functions (the `pageXxx` funcs in chatgpt.ts / gemini.ts) are
 * passed to chrome.scripting.executeScript and therefore must be fully
 * self-contained (no outer-scope references); they return audio bytes as a
 * plain number[] (0-255) because ArrayBuffer/Uint8Array do not survive the
 * structured-clone bridge intact across executeScript results in all cases.
 */

import { tabController } from '../../services/tab-controller';
import { MEDIA_PATHS } from '@/utils/api-paths';
import {
  getPreferredProvider,
  getValidityProvider,
  setPreferredProvider,
  type AiWebProvider,
} from '@/services/AiProviderSettings';
import { apiManager } from '@/services/ApiManager';
import { DEFAULT_API_BASE_URL } from '@/config/api-endpoints';
import { delay as waitForDelay, fetchWithTimeout } from '@/utils/async';
import { toErrorMessage } from '@/utils/errors';

export { waitForTabComplete } from '@/utils/tab-readiness';

export { getPreferredProvider, getValidityProvider, setPreferredProvider };
export type { AiWebProvider };

/**
 * Which web AI a worker drives. User-configurable via settings.
 *
 * chatgpt/gemini have full page-driver tools; deepseek is driven by the shared
 * DeepSeek prompt tool. Only providers with a working page driver are exposed.
 */
/** Resolve the Laravel backend base URL from the shared endpoint manager. */
export async function resolveBackendBase(override?: string): Promise<string> {
  if (override && override.trim().length > 0) {
    return override.trim().replace(/\/+$/, '');
  }
  try {
    await apiManager.initialize({ autoDetect: false });
    const endpoint = apiManager.getCurrentBaseUrl();
    if (endpoint.trim().length > 0) {
      return endpoint.trim().replace(/\/+$/, '');
    }
  } catch {
    // Endpoint storage may be unavailable in some contexts; use the local default.
  }
  return DEFAULT_API_BASE_URL;
}

/**
 * Find a live tab whose URL contains `urlIncludes` (reuse the user's running
 * session), else create one at `createUrl`. Returns the resolved tab id.
 */
export async function findOrCreateProviderTab(
  urlIncludes: string,
  createUrl: string,
  explicitTabId?: number,
): Promise<{ tabId: number; created: boolean }> {
  if (typeof explicitTabId === 'number') {
    try {
      const t = await chrome.tabs.get(explicitTabId);
      if (t && t.id) {
        // Reuse in the BACKGROUND — page-driving runs via executeScript/sendMessage
        // on the inactive tab, so we never steal the user's focus.
        return { tabId: t.id, created: false };
      }
    } catch {
      // fall through to discovery
    }
  }
  const all = await chrome.tabs.query({});
  const match = all.find((t) => typeof t.url === 'string' && t.url.includes(urlIncludes) && typeof t.id === 'number');
  if (match && match.id) {
    return { tabId: match.id, created: false };
  }
  // Create the provider tab in the BACKGROUND (active:false) — no focus steal.
  const created = await tabController.openBackgroundTab(createUrl);
  if (!created.id) {
    throw new Error(`Failed to open ${createUrl}`);
  }
  return { tabId: created.id, created: true };
}

/** A tiny stable hash for keying an uploaded reply by its prompt (idempotency). */
export function shortHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export interface ReplyAudio {
  ok: boolean;
  mime?: string;
  bytes?: number[];
  error?: string;
}

export interface AudioUploadResult {
  uploaded: boolean;
  path?: string;
  skipped?: boolean;
  error?: string;
}

/**
 * Upload captured reply audio (number[] bytes) to the Laravel backend as a
 * multipart binary. Retries a few times with backoff. Never throws — returns a
 * structured result so the caller can record it in the tool/worker output.
 */
export async function uploadReplyAudio(params: {
  baseUrl: string;
  provider: string; // 'chatgpt-web' | 'gemini-web'
  promptHash: string;
  language: string;
  audio: ReplyAudio;
}): Promise<AudioUploadResult> {
  const { baseUrl, provider, promptHash, language, audio } = params;
  if (!audio || !audio.ok || !audio.bytes || audio.bytes.length === 0) {
    return { uploaded: false, error: audio?.error || 'no audio captured' };
  }

  const mime = audio.mime && audio.mime.length > 0 ? audio.mime : 'audio/mpeg';
  const ext = mime.includes('webm') ? 'webm' : mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'mp3';
  const url = `${baseUrl}${MEDIA_PATHS.AI_AUDIO}`;

  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const blob = new Blob([new Uint8Array(audio.bytes)], { type: mime });
      const form = new FormData();
      form.append('provider', provider);
      form.append('prompt_hash', promptHash);
      form.append('language', language);
      form.append('audio', blob, `${provider}-${promptHash}.${ext}`);

      const resp = await fetchWithTimeout(url, 30000, { method: 'POST', body: form });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data && data.ok !== false) {
        return { uploaded: true, path: data.path, skipped: data.skipped === true };
      }
      lastError = `HTTP ${resp.status}: ${data?.error || data?.message || 'upload rejected'}`;
    } catch (e) {
      lastError = toErrorMessage(e);
    }
    await waitForDelay(500 * (attempt + 1));
  }
  return { uploaded: false, error: lastError };
}
