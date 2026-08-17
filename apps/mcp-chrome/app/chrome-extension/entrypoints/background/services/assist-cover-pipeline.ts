/**
 * Assist Cover/Poster Submit Pipeline
 *
 * The SHARED outcome handling for an assist cover/poster submit, used by both
 * image workers (media-image and gemini-image) so the release/outbox policy
 * lives in exactly one place:
 *   ok/already_done     -> submitted
 *   'invalid'/'not_found' -> TERMINAL (the bytes can never pass) -> released
 *   anything else (transient) -> durable outbox retry (never lost)
 */

import {
  submitAssistCover,
  releaseAssistItem,
  looksLikeImageBase64,
  type AssistSubmitResult,
} from '@/services/assist-image-api';
import { submitOutbox, type AssistSubmitPayload } from './outbox/submit-outbox';
import { logger } from '@/utils/logger';

const LOG = 'Assist Pipeline';

export type AssistSubmitOutcome = 'submitted' | 'released' | 'outboxed';

export interface AssistSubmitActions {
  /** Called once when the backend accepted the artifact (ok / already_done). */
  onOk: () => void;
  /** Terminal-rejection release callback (invalid / not_found). */
  release: () => Promise<void>;
  /** Durable-outbox payload for transient failures. */
  outboxPayload: AssistSubmitPayload;
}

/** Shared submit-outcome policy (see module docblock). */
export async function finalizeAssistSubmit(
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

export interface LibraryCoverSubmitParams {
  baseUrl: string;
  itemId: number;
  imageBase64: string;
  claimer: string;
  extras: { mime?: string; provider?: string; model?: string; latencyMs?: number };
  /** Reason prefix for terminal releases, e.g. 'mcp-chrome'. */
  releaseReasonPrefix: string;
}

/**
 * Validate + submit a vocabulary-library cover with the shared outcome policy.
 * Returns null when the bytes failed magic validation (caller counts a
 * failure; the claim is already released) — otherwise the outcome.
 */
export async function submitLibraryCover(
  params: LibraryCoverSubmitParams,
): Promise<AssistSubmitOutcome | null> {
  const { baseUrl, itemId, imageBase64, claimer, extras, releaseReasonPrefix } = params;

  if (!imageBase64 || !looksLikeImageBase64(imageBase64)) {
    // Bad bytes (SVG/HTML error page/…) would be rejected server-side as
    // 'invalid' forever — release the claim instead of poisoning the outbox.
    logger.warn(LOG, `Cover#${itemId} failed magic validation`, {
      provider: extras.provider || null,
      mime: extras.mime || null,
    });
    await releaseAssistItem(baseUrl, 'cover', itemId, `${releaseReasonPrefix}: cover image failed magic validation`);
    return null;
  }

  const result = await submitAssistCover(baseUrl, itemId, imageBase64, claimer, extras);
  return finalizeAssistSubmit(baseUrl, result, {
    onOk: () => {
      logger.info(LOG, `Backend accepted library cover#${itemId}${result.already_done ? ' (already done)' : ''}`, {
        status: result.status,
      });
    },
    release: () => releaseAssistItem(
      baseUrl,
      'cover',
      itemId,
      `${releaseReasonPrefix}: submit ${result.status}: ${result.error || 'rejected'}`,
    ),
    outboxPayload: { type: 'cover', id: itemId, imageBase64, claimer, extras },
  });
}
