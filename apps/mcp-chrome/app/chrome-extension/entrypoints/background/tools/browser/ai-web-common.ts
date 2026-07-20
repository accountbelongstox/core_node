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

const DEFAULT_BACKEND_BASE = 'http://127.0.0.1:9000';

/**
 * Which web AI a worker drives. User-configurable via settings.
 *
 * chatgpt/gemini have full page-driver tools today; deepseek is driven by the
 * web-AI translate path (deepseekSendPromptTool). zai is a recognized option
 * (validity lane) but has NO page-driver tool yet — callers must guard it and
 * fall back (see the validity worker), so a stored 'zai' never throws.
 */
export type AiWebProvider = 'chatgpt' | 'gemini' | 'deepseek' | 'zai';
const PROVIDER_STORAGE_KEY = 'aiWebProvider';
const DEFAULT_PROVIDER: AiWebProvider = 'chatgpt';

// Separate per-lane key for the invalid-word detection worker: it defaults to
// Gemini (per the feature spec) and accepts the full provider vocabulary,
// without disturbing the prompt-translate / web-AI lanes that read the key above.
const VALIDITY_PROVIDER_STORAGE_KEY = 'aiValidityProvider';
const DEFAULT_VALIDITY_PROVIDER: AiWebProvider = 'gemini';

/**
 * Read the preferred web-driving provider for the translate/prompt lanes
 * (default: chatgpt). Intentionally only honors chatgpt/gemini — those lanes
 * have no deepseek/zai page-driver, so an out-of-range value falls back.
 */
export async function getPreferredProvider(): Promise<AiWebProvider> {
  try {
    const stored = await chrome.storage.local.get([PROVIDER_STORAGE_KEY]);
    const v = stored[PROVIDER_STORAGE_KEY];
    if (v === 'chatgpt' || v === 'gemini') {
      return v;
    }
  } catch {
    // storage unavailable; use default.
  }
  return DEFAULT_PROVIDER;
}

/** Persist the preferred web-driving provider (used by the settings UI). */
export async function setPreferredProvider(provider: AiWebProvider): Promise<void> {
  await chrome.storage.local.set({ [PROVIDER_STORAGE_KEY]: provider });
}

/**
 * Read the provider for the invalid-word detection (word_validity) lane.
 * Default Gemini; accepts the full vocabulary (chatgpt/gemini/deepseek/zai).
 */
export async function getValidityProvider(): Promise<AiWebProvider> {
  try {
    const stored = await chrome.storage.local.get([VALIDITY_PROVIDER_STORAGE_KEY]);
    const v = stored[VALIDITY_PROVIDER_STORAGE_KEY];
    if (v === 'chatgpt' || v === 'gemini' || v === 'deepseek' || v === 'zai') {
      return v;
    }
  } catch {
    // storage unavailable; use default.
  }
  return DEFAULT_VALIDITY_PROVIDER;
}

/** Resolve the Laravel backend base URL: explicit override -> stored value -> localhost. */
export async function resolveBackendBase(override?: string): Promise<string> {
  if (override && override.trim().length > 0) {
    return override.trim().replace(/\/+$/, '');
  }
  try {
    const stored = await chrome.storage.local.get(['laravelApiBase', 'apiBaseUrl', 'mcpServerUrl']);
    const candidate = stored.laravelApiBase || stored.apiBaseUrl || stored.mcpServerUrl;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim().replace(/\/+$/, '');
    }
  } catch {
    // storage may be unavailable in some contexts; fall through to default.
  }
  return DEFAULT_BACKEND_BASE;
}

/** Poll until a tab finishes loading (status === 'complete') or the timeout elapses. */
export async function waitForTabComplete(tabId: number, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let tab: chrome.tabs.Tab | null = null;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      throw new Error(`Tab ${tabId} was closed while loading`);
    }
    if (tab && tab.status === 'complete') {
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  // Best-effort: don't hard-fail on a slow SPA that never flips to 'complete'.
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

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch(url, { method: 'POST', body: form, signal: controller.signal });
      clearTimeout(timer);

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data && data.ok !== false) {
        return { uploaded: true, path: data.path, skipped: data.skipped === true };
      }
      lastError = `HTTP ${resp.status}: ${data?.error || data?.message || 'upload rejected'}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  return { uploaded: false, error: lastError };
}
