/**
 * Laravel assist API client for cover / poster image submit (NO-AUTH machine plane).
 *
 * Built on BaseApiClient so the assist plane shares the same timeout/retry
 * convention as every other backend client in the extension. The assist
 * endpoints do NOT use the {success,message,data} envelope — claim/release
 * answer {success, items|released, error}, submit answers {ok, status, ...} —
 * so the raw body is passed through and only transport/HTTP failures throw.
 */

import { ASSIST_PATHS } from '@/utils/api-paths';
import { ApiError, BaseApiClient } from '@/entrypoints/background/api/BaseApiClient';

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

class AssistApiClient extends BaseApiClient {
  async claim(types: AssistItemType[], claimer: string, limit: number): Promise<AssistClaimItem[]> {
    let data: any;
    try {
      data = await this.post<any>(ASSIST_PATHS.CLAIM, { types, limit, claimer });
    } catch (error: any) {
      const detail = error instanceof ApiError
        ? error.response?.error || error.message
        : error?.message || 'unknown error';
      throw new Error(`Assist claim failed (HTTP ${error?.statusCode || '?'}): ${detail}`);
    }
    if (data?.success === false) {
      throw new Error(`Assist claim rejected: ${data?.error || data?.message || 'unknown error'}`);
    }
    return Array.isArray(data?.items) ? data.items : [];
  }

  /**
   * Submit NEVER throws on a server verdict: a 4xx/5xx body is still the
   * authoritative {ok, status, error} result the caller routes on (terminal
   * release vs durable outbox). Only a body-less transport failure throws.
   */
  private async submit(body: Record<string, unknown>): Promise<AssistSubmitResult> {
    try {
      // The assist plane answers the raw {ok,status,...} body, not the
      // {success,message,data} envelope BaseApiClient is typed for.
      return await this.post(ASSIST_PATHS.SUBMIT, body) as unknown as AssistSubmitResult;
    } catch (error: any) {
      if (error instanceof ApiError && error.response && typeof error.response === 'object') {
        return error.response as AssistSubmitResult;
      }
      throw error;
    }
  }

  async submitCover(
    id: number,
    imageBase64: string,
    claimer: string,
    extras: { mime?: string; provider?: string; model?: string; latencyMs?: number },
  ): Promise<AssistSubmitResult> {
    return this.submit({
      type: 'cover',
      id,
      image_base64: imageBase64,
      mime: extras.mime,
      provider: extras.provider || 'mcp-chrome-google-images',
      model: extras.model || 'google-images',
      latency_ms: extras.latencyMs,
      claimer,
    });
  }

  async submitPoster(
    mediaType: 'book' | 'subtitle',
    id: number,
    imageBase64: string,
    claimer: string,
    extras: { mime?: string; provider?: string; sourceId?: string; latencyMs?: number },
  ): Promise<AssistSubmitResult> {
    return this.submit({
      type: 'poster',
      media_type: mediaType,
      id,
      image_base64: imageBase64,
      mime: extras.mime,
      provider: extras.provider || 'mcp-chrome-google-images',
      source_id: extras.sourceId,
      latency_ms: extras.latencyMs,
      claimer,
    });
  }

  /** Best-effort release; failures are swallowed (the lease expires anyway). */
  async release(
    type: AssistItemType,
    id: number,
    error: string,
    extra: Record<string, unknown>,
  ): Promise<void> {
    await this.post<any>(ASSIST_PATHS.RELEASE, {
      type,
      ids: [id],
      error,
      claimer: 'mcp-chrome-media-image',
      ...extra,
    }, { retries: 0 }).catch(() => undefined);
  }
}

function clientFor(baseUrl: string): AssistApiClient {
  return new AssistApiClient(baseUrl.trim().replace(/\/+$/, ''));
}

export async function claimAssistItems(
  baseUrl: string,
  types: AssistItemType[],
  claimer: string,
  limit = 3,
): Promise<AssistClaimItem[]> {
  return clientFor(baseUrl).claim(types, claimer, limit);
}

export async function submitAssistCover(
  baseUrl: string,
  id: number,
  imageBase64: string,
  claimer: string,
  extras: { mime?: string; provider?: string; model?: string; latencyMs?: number } = {},
): Promise<AssistSubmitResult> {
  return clientFor(baseUrl).submitCover(id, imageBase64, claimer, extras);
}

export async function submitAssistPoster(
  baseUrl: string,
  mediaType: 'book' | 'subtitle',
  id: number,
  imageBase64: string,
  claimer: string,
  extras: { mime?: string; provider?: string; sourceId?: string; latencyMs?: number } = {},
): Promise<AssistSubmitResult> {
  return clientFor(baseUrl).submitPoster(mediaType, id, imageBase64, claimer, extras);
}

export async function releaseAssistItem(
  baseUrl: string,
  type: AssistItemType,
  id: number,
  error: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  return clientFor(baseUrl).release(type, id, error, extra);
}
