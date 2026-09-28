/**
 * Image Submit Pipeline
 *
 * The SHARED image hand-off for both image workers (media-image and
 * gemini-image). Every producer (Gemini generation, Google/Bing search)
 * yields one ImageArtifact; this module owns the magic validation and the two
 * delivery shapes:
 *   - global tasks (poster / library_cover / library_cover_search /
 *     gemini_image): the typed result body submitted through the worker client
 *     (see AssistPollingWorkerBase.submitImageTaskResult)
 *   - assist plane (cover / poster claims) with the outcome policy:
 *       ok/already_done     -> submitted
 *       'invalid'/'not_found' -> TERMINAL (the bytes can never pass) -> released
 *       anything else (transient) -> durable outbox retry (never lost)
 */

import {
  submitAssistCover,
  submitAssistPoster,
  releaseAssistItem,
  looksLikeImageBase64,
  type AssistClaimItem,
  type AssistSubmitResult,
} from '@/services/assist-image-api';
import { submitOutbox, type AssistSubmitPayload } from './outbox/submit-outbox';
import type { LibraryCoverTaskResult } from '@/utils/queue-center-contract';
import { logger } from '@/utils/logger';

const LOG = 'Image Pipeline';
const SOURCE_ID_MAX_LENGTH = 512;

export type AssistSubmitOutcome = 'submitted' | 'released' | 'outboxed';

export interface ImageArtifact {
  imageBase64: string;
  mime: string;
  provider: string;
  model?: string;
  sourceUrl?: string;
  prompt?: string;
}

/**
 * Typed global-task result for one image, or null when the bytes fail the
 * server's magic check (SVG/HTML error page/...) and must not be submitted.
 */
export function imageTaskResult(artifact: ImageArtifact, startedAt: number): LibraryCoverTaskResult | null {
  if (!artifact.imageBase64 || !looksLikeImageBase64(artifact.imageBase64)) return null;
  const result: LibraryCoverTaskResult = {
    image_base64: artifact.imageBase64,
    mime: artifact.mime,
    provider: artifact.provider,
    latency_ms: Date.now() - startedAt,
  };
  if (artifact.model) result.model = artifact.model;
  if (artifact.sourceUrl) result.source_url = artifact.sourceUrl;
  if (artifact.prompt) result.prompt = artifact.prompt;
  return result;
}

interface AssistSubmitActions {
  onOk: () => void;
  release: () => Promise<void>;
  outboxPayload: AssistSubmitPayload;
}

async function finalizeAssistSubmit(
  baseUrl: string,
  result: AssistSubmitResult,
  actions: AssistSubmitActions,
): Promise<AssistSubmitOutcome> {
  if (result.ok) {
    actions.onOk();
    return 'submitted';
  }
  if (result.status === 'invalid' || result.status === 'not_found') {
    logger.warn(LOG, `Assist submit rejected as ${result.status}`, { error: result.error || null });
    await actions.release();
    return 'released';
  }
  logger.warn(LOG, 'Assist submit deferred to the durable outbox', {
    status: result.status || null,
    error: result.error || null,
  });
  await submitOutbox.enqueue({
    kind: 'assist_submit',
    baseUrl,
    payload: actions.outboxPayload,
  });
  return 'outboxed';
}

export interface AssistImageSubmitParams {
  baseUrl: string;
  item: Pick<AssistClaimItem, 'type' | 'id' | 'media_type'>;
  artifact: ImageArtifact;
  claimer: string;
  startedAt: number;
  /** Reason prefix for terminal releases, e.g. 'mcp-chrome'. */
  releaseReasonPrefix: string;
}

/**
 * Validate + submit an assist cover/poster with the shared outcome policy.
 * Returns null when the bytes failed magic validation (caller counts a
 * failure; the claim is already released) — otherwise the outcome.
 */
export async function submitAssistImage(
  params: AssistImageSubmitParams,
): Promise<AssistSubmitOutcome | null> {
  const { baseUrl, item, artifact, claimer, startedAt, releaseReasonPrefix } = params;
  const mediaType = item.type === 'poster'
    ? (item.media_type === 'subtitle' ? 'subtitle' : 'book')
    : undefined;
  const releaseExtra = mediaType ? { media_type: mediaType } : {};
  const release = (reason: string) => releaseAssistItem(
    baseUrl,
    item.type,
    item.id,
    `${releaseReasonPrefix}: ${reason}`,
    releaseExtra,
  );

  if (!artifact.imageBase64 || !looksLikeImageBase64(artifact.imageBase64)) {
    // Bad bytes would be rejected server-side as 'invalid' forever — release
    // the claim instead of poisoning the outbox.
    logger.warn(LOG, `Assist ${item.type}#${item.id} failed magic validation`, {
      provider: artifact.provider,
      mime: artifact.mime,
      sourceUrl: artifact.sourceUrl || null,
    });
    await release(`${item.type} image failed magic validation`);
    return null;
  }

  const extras = {
    mime: artifact.mime,
    provider: artifact.provider,
    model: artifact.model,
    sourceId: artifact.sourceUrl?.slice(0, SOURCE_ID_MAX_LENGTH),
    latencyMs: Date.now() - startedAt,
  };
  const { imageBase64 } = artifact;
  const result = mediaType
    ? await submitAssistPoster(baseUrl, mediaType, item.id, imageBase64, claimer, extras)
    : await submitAssistCover(baseUrl, item.id, imageBase64, claimer, extras);
  return finalizeAssistSubmit(baseUrl, result, {
    onOk: () => {
      logger.info(LOG, `Backend accepted ${item.type}#${item.id}${result.already_done ? ' (already done)' : ''}`, {
        status: result.status,
        provider: artifact.provider,
      });
    },
    release: () => release(`submit ${result.status}: ${result.error || 'rejected'}`),
    outboxPayload: { type: item.type, media_type: mediaType, id: item.id, imageBase64, claimer, extras },
  });
}
