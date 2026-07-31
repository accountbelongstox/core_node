/**
 * Laravel assist API client for cover / poster image submit (NO-AUTH machine plane).
 */

import { ASSIST_PATHS } from '@/utils/api-paths';

export type AssistItemType = 'cover' | 'poster';

export interface AssistClaimItem {
  type: AssistItemType;
  id: number;
  media_type?: 'book' | 'subtitle';
  payload?: Record<string, unknown>;
}

export interface AssistSubmitResult {
  ok: boolean;
  status?: string;
  already_done?: boolean;
  error?: string;
}

/**
 * Client-side image magic check mirroring the server's
 * (png/jpeg/webp/gif). A payload that fails it would be rejected with a 422
 * 'invalid' — never submit or outbox-retry those bytes.
 */
export function looksLikeImageBase64(imageBase64: string): boolean {
  try {
    const head = atob(imageBase64.slice(0, 24));
    const bytes = Array.from(head, (c) => c.charCodeAt(0));
    // PNG \x89PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
    // JPEG \xFF\xD8\xFF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
    // GIF87a / GIF89a
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
    // WEBP: RIFF....WEBP
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
    return false;
  } catch {
    return false;
  }
}

function baseUrlTrimmed(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export async function claimAssistItems(
  baseUrl: string,
  types: AssistItemType[],
  claimer: string,
  limit = 3,
): Promise<AssistClaimItem[]> {
  const url = `${baseUrlTrimmed(baseUrl)}${ASSIST_PATHS.CLAIM}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ types, limit, claimer }),
  });
  const data = await res.json().catch(() => ({}));
  const detail = data?.error || data?.message || res.statusText || 'unknown error';
  if (!res.ok) {
    throw new Error(`Assist claim failed (HTTP ${res.status}): ${detail}`);
  }
  if (data?.success === false) {
    throw new Error(`Assist claim rejected: ${detail}`);
  }
  return Array.isArray(data?.items) ? data.items : [];
}

export async function submitAssistCover(
  baseUrl: string,
  id: number,
  imageBase64: string,
  claimer: string,
  extras: { mime?: string; provider?: string; model?: string; latencyMs?: number } = {},
): Promise<AssistSubmitResult> {
  const url = `${baseUrlTrimmed(baseUrl)}${ASSIST_PATHS.SUBMIT}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      type: 'cover',
      id,
      image_base64: imageBase64,
      mime: extras.mime,
      provider: extras.provider || 'mcp-chrome-google-images',
      model: extras.model || 'google-images',
      latency_ms: extras.latencyMs,
      claimer,
    }),
  });
  return res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
}

export async function submitAssistPoster(
  baseUrl: string,
  mediaType: 'book' | 'subtitle',
  id: number,
  imageBase64: string,
  claimer: string,
  extras: { mime?: string; provider?: string; sourceId?: string; latencyMs?: number } = {},
): Promise<AssistSubmitResult> {
  const url = `${baseUrlTrimmed(baseUrl)}${ASSIST_PATHS.SUBMIT}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      type: 'poster',
      media_type: mediaType,
      id,
      image_base64: imageBase64,
      mime: extras.mime,
      provider: extras.provider || 'mcp-chrome-google-images',
      source_id: extras.sourceId,
      latency_ms: extras.latencyMs,
      claimer,
    }),
  });
  return res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
}

export async function releaseAssistItem(
  baseUrl: string,
  type: AssistItemType,
  id: number,
  error: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const url = `${baseUrlTrimmed(baseUrl)}${ASSIST_PATHS.RELEASE}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      type,
      ids: [id],
      error,
      claimer: 'mcp-chrome-media-image',
      ...extra,
    }),
  }).catch(() => undefined);
}
