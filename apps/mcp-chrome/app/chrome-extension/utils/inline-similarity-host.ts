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
import { OFFSCREEN_MESSAGE_TYPES, SendMessageType } from '@/common/message-types';

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
const VECTOR_DB_NAMES = ['VectorSearchDB', 'ContentIndexerDB', 'SemanticSimilarityDB'];

let inlineEngine: SemanticSimilarityEngine | null = null;
let inlineEngineConfig: any = null;

/**
 * Check if the inline engine must be (re)built for the given config
 */
function needsReinitialization(newConfig: any): boolean {
  if (!inlineEngine || !inlineEngineConfig) {
    return true;
  }

  const keyFields = ['modelPreset', 'modelVersion', 'modelIdentifier', 'dimension'];
  for (const field of keyFields) {
    if (newConfig[field] !== inlineEngineConfig[field]) {
      console.log(
        `InlineSimilarityHost: ${field} changed from ${inlineEngineConfig[field]} to ${newConfig[field]}`,
      );
      return true;
    }
  }

  return false;
}

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
    const modelState = {
      status,
      downloadProgress: progress,
      isDownloading: status === 'downloading' || status === 'initializing',
      lastUpdated: Date.now(),
      errorMessage: errorMessage || '',
      errorType: errorType || '',
    };
    await chrome.storage.local.set({ modelState });
  } catch (error) {
    console.error('InlineSimilarityHost: Failed to update model status:', error);
  }
}

/**
 * Classify initialization errors the same way the offscreen host does
 */
function analyzeErrorType(errorMessage: string): 'network' | 'file' | 'unknown' {
  const message = errorMessage.toLowerCase();

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('cors') ||
    message.includes('failed to fetch')
  ) {
    return 'network';
  }

  if (
    message.includes('corrupt') ||
    message.includes('invalid') ||
    message.includes('format') ||
    message.includes('parse') ||
    message.includes('decode') ||
    message.includes('onnx')
  ) {
    return 'file';
  }

  return 'unknown';
}

/**
 * Clear vector-related IndexedDB databases on model switch (data consistency)
 */
async function clearVectorIndexedDB(): Promise<void> {
  for (const dbName of VECTOR_DB_NAMES) {
    try {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      await new Promise<void>((resolve) => {
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => {
          console.warn(`InlineSimilarityHost: Failed to delete database: ${dbName}`);
          resolve();
        };
        deleteRequest.onblocked = () => {
          console.warn(`InlineSimilarityHost: Database deletion blocked: ${dbName}`);
          resolve();
        };
      });
    } catch (error) {
      console.warn(`InlineSimilarityHost: Error deleting database ${dbName}:`, error);
    }
  }
}

/**
 * Initialize (or reuse) the inline engine, mirroring the offscreen init flow
 */
async function handleInit(config: any): Promise<void> {
  // The background page runs the engine directly; never re-enter offscreen mode
  const effectiveConfig = { ...config, forceOffscreen: false };

  if (!needsReinitialization(effectiveConfig)) {
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
      await clearVectorIndexedDB();
    } catch (error) {
      console.warn('InlineSimilarityHost: Failed to clear vector IndexedDB:', error);
    }
  }

  try {
    await updateInlineModelStatus('initializing', 10);

    inlineEngine = new SemanticSimilarityEngine(effectiveConfig);
    await inlineEngine.initializeWithProgress(async (progress) => {
      await updateInlineModelStatus(progress.status, progress.progress);
    });

    inlineEngineConfig = { ...effectiveConfig };
    await updateInlineModelStatus('ready', 100);
    console.log('InlineSimilarityHost: Engine initialized successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    await updateInlineModelStatus('error', 0, errorMessage, analyzeErrorType(errorMessage));
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
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
