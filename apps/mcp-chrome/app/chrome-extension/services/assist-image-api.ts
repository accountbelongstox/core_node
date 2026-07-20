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
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
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
