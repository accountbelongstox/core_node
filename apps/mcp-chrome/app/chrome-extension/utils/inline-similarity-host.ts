/**
 * Inline similarity host (Firefox only).
 *
 * Firefox has no chrome.offscreen API, but its MV3 background event page has a
 * DOM and can create Web Workers directly. This module hosts the
 * SemanticSimilarityEngine inline in the background page and answers the same
 * message contract as entrypoints/offscreen/main.ts, so callers that would
 * normally message the offscreen document dispatch here instead.
 *
 * Referenced only from import.meta.env.FIREFOX branches; on Chrome builds those
 * branches are compile-time dead code, so this module is never bundled there.
 */
import { SemanticSimilarityEngine } from './semantic-similarity-engine';
import { toErrorMessage } from './errors';
import { classifySimilarityError } from './similarity-error';
import {
  clearSimilarityVectorDatabases,
  createSimilarityModelState,
  getSimilarityReinitializationState,
} from './similarity-runtime';
import { OFFSCREEN_MESSAGE_TYPES, SendMessageType } from '@/common/message-types';
import { STORAGE_KEYS } from '@/utils/storage-keys';

interface InlineHostResponse {
  error?: string;
  success?: boolean;
  similarities?: number[];
  embedding?: number[];
  embeddings?: number[][];
  isInitialized?: boolean;
  currentConfig?: any;
}

const ENGINE_NOT_INITIALIZED_ERROR =
  'Similarity engine not initialized. Please reinitialize the engine.';
let inlineEngine: SemanticSimilarityEngine | null = null;
let inlineEngineConfig: any = null;

/**
 * Persist model status for UI/status consumers (same shape as offscreen host)
 */
async function updateInlineModelStatus(
  status: string,
  progress: number,
  errorMessage?: string,
  errorType?: string,
): Promise<void> {
  try {
    const modelState = createSimilarityModelState(status, progress, errorMessage, errorType);
    await chrome.storage.local.set({ [STORAGE_KEYS.SEMANTIC_MODEL_STATE]: modelState });
  } catch (error) {
    console.error('InlineSimilarityHost: Failed to update model status:', error);
  }
}

/**
 * Initialize (or reuse) the inline engine, mirroring the offscreen init flow
 */
async function handleInit(config: any): Promise<void> {
  // The background page runs the engine directly; never re-enter offscreen mode
  const effectiveConfig = { ...config, forceOffscreen: false };

  const reinitialization = getSimilarityReinitializationState(
    inlineEngine,
    inlineEngineConfig,
    effectiveConfig,
  );
  if (reinitialization.change) {
    const { field, previousValue, nextValue } = reinitialization.change;
    console.log(
      `InlineSimilarityHost: ${field} changed from ${previousValue} to ${nextValue}`,
    );
  }

  if (!reinitialization.required) {
    console.log('InlineSimilarityHost: Using existing engine (no changes detected)');
    await updateInlineModelStatus('ready', 100);
    return;
  }

  if (inlineEngine) {
    console.log('InlineSimilarityHost: Disposing existing engine for model switch...');
    try {
      await inlineEngine.dispose();
    } catch (error) {
      console.warn('InlineSimilarityHost: Failed to dispose previous engine:', error);
    }
    inlineEngine = null;
    inlineEngineConfig = null;

    try {
      await clearSimilarityVectorDatabases('InlineSimilarityHost');
    } catch (error) {
      console.warn('InlineSimilarityHost: Failed to clear vector IndexedDB:', error);
    }
  }

  try {
    await updateInlineModelStatus('initializing', 10);

    inlineEngine = new SemanticSimilarityEngine(effectiveConfig);
    // The progress callback signature is sync (void return) — the host fires
    // and forgets. Wrapping updateInlineModelStatus in an async callback
    // created dangling promises and swallowed rejections.
    await inlineEngine.initializeWithProgress((progress) => {
      updateInlineModelStatus(progress.status, progress.progress).catch(() => {
        /* status update failure is non-critical */
      });
    });

    inlineEngineConfig = { ...effectiveConfig };
    await updateInlineModelStatus('ready', 100);
    console.log('InlineSimilarityHost: Engine initialized successfully');
  } catch (error) {
    const errorMessage = toErrorMessage(error) || 'Unknown initialization error';
    await updateInlineModelStatus('error', 0, errorMessage, classifySimilarityError(errorMessage));
    inlineEngine = null;
    inlineEngineConfig = null;
    throw error;
  }
}

/**
 * Dispatch a message that would normally target the offscreen document.
 * Returns the exact response shape the offscreen handlers produce.
 */
export async function dispatchInlineSimilarityMessage(message: any): Promise<InlineHostResponse> {
  try {
    switch (message.type) {
      // Same string constant as OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_INIT
      case SendMessageType.SimilarityEngineInit: {
        await handleInit(message.config);
        return { success: true };
      }

      case SendMessageType.SimilarityEngineComputeBatch: {
        if (!inlineEngine) {
          return { success: false, error: ENGINE_NOT_INITIALIZED_ERROR };
        }
        const similarities = await inlineEngine.computeSimilarityBatch(
          message.pairs,
          message.options || {},
        );
        return { success: true, similarities };
      }

      case OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_COMPUTE: {
        if (!inlineEngine) {
          return { success: false, error: ENGINE_NOT_INITIALIZED_ERROR };
        }
        const embedding = await inlineEngine.getEmbedding(message.text, message.options || {});
        return { success: true, embedding: Array.from(embedding) };
      }

      case OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_BATCH_COMPUTE: {
        if (!inlineEngine) {
          return { success: false, error: ENGINE_NOT_INITIALIZED_ERROR };
        }
        const embeddings = await inlineEngine.getEmbeddingsBatch(
          message.texts,
          message.options || {},
        );
        return { success: true, embeddings: embeddings.map((emb) => Array.from(emb)) };
      }

      case OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_STATUS: {
        return {
          success: true,
          isInitialized: !!inlineEngine,
          currentConfig: inlineEngineConfig,
        };
      }

      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: toErrorMessage(error) || 'Unknown error occurred',
    };
  }
}
