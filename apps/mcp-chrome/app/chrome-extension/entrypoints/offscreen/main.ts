// MUST stay the first import: aliases chrome -> browser on Firefox before any
// other module top-level code touches chrome.* (no-op, tree-shaken on Chrome).
import '@/utils/browser-shim';
import { toErrorMessage } from '@/utils/errors';
import { SemanticSimilarityEngine } from '@/utils/semantic-similarity-engine';
import { classifySimilarityError } from '@/utils/similarity-error';
import {
  clearSimilarityVectorDatabases,
  createSimilarityModelState,
  getSimilarityReinitializationState,
} from '@/utils/similarity-runtime';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import {
  MessageTarget,
  SendMessageType,
  OFFSCREEN_MESSAGE_TYPES,
  BACKGROUND_MESSAGE_TYPES,
} from '@/common/message-types';

// Global semantic similarity engine instance
let similarityEngine: SemanticSimilarityEngine | null = null;
interface OffscreenMessage {
  target: MessageTarget | string;
  type: SendMessageType | string;
}

interface SimilarityEngineInitMessage extends OffscreenMessage {
  type: SendMessageType.SimilarityEngineInit;
  config: any;
}

interface SimilarityEngineComputeBatchMessage extends OffscreenMessage {
  type: SendMessageType.SimilarityEngineComputeBatch;
  pairs: { text1: string; text2: string }[];
  options?: Record<string, any>;
}

interface SimilarityEngineGetEmbeddingMessage extends OffscreenMessage {
  type: 'similarityEngineCompute';
  text: string;
  options?: Record<string, any>;
}

interface SimilarityEngineGetEmbeddingsBatchMessage extends OffscreenMessage {
  type: 'similarityEngineBatchCompute';
  texts: string[];
  options?: Record<string, any>;
}

interface SimilarityEngineStatusMessage extends OffscreenMessage {
  type: 'similarityEngineStatus';
}

type MessageResponse = {
  result?: string;
  error?: string;
  success?: boolean;
  similarities?: number[];
  embedding?: number[];
  embeddings?: number[][];
  isInitialized?: boolean;
  currentConfig?: any;
};

// Listen for messages from the extension
chrome.runtime.onMessage.addListener(
  (
    message: OffscreenMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
    if (message.target !== MessageTarget.Offscreen) {
      return;
    }

    try {
      switch (message.type) {
        case SendMessageType.SimilarityEngineInit:
        case OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_INIT: {
          const initMsg = message as SimilarityEngineInitMessage;
          console.log('Offscreen: Received similarity engine init message:', message.type);
          handleSimilarityEngineInit(initMsg.config)
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
          break;
        }

        case SendMessageType.SimilarityEngineComputeBatch: {
          const computeMsg = message as SimilarityEngineComputeBatchMessage;
          handleComputeSimilarityBatch(computeMsg.pairs, computeMsg.options)
            .then((similarities) => sendResponse({ success: true, similarities }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
          break;
        }

        case OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_COMPUTE: {
          const embeddingMsg = message as SimilarityEngineGetEmbeddingMessage;
          handleGetEmbedding(embeddingMsg.text, embeddingMsg.options)
            .then((embedding) => {
              console.log('Offscreen: Sending embedding response:', {
                length: embedding.length,
                type: typeof embedding,
                constructor: embedding.constructor.name,
                isFloat32Array: embedding instanceof Float32Array,
                firstFewValues: Array.from(embedding.slice(0, 5)),
              });
              const embeddingArray = Array.from(embedding);
              console.log('Offscreen: Converted to array:', {
                length: embeddingArray.length,
                type: typeof embeddingArray,
                isArray: Array.isArray(embeddingArray),
                firstFewValues: embeddingArray.slice(0, 5),
              });
              sendResponse({ success: true, embedding: embeddingArray });
            })
            .catch((error) => sendResponse({ success: false, error: error.message }));
          break;
        }

        case OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_BATCH_COMPUTE: {
          const batchMsg = message as SimilarityEngineGetEmbeddingsBatchMessage;
          handleGetEmbeddingsBatch(batchMsg.texts, batchMsg.options)
            .then((embeddings) =>
              sendResponse({
                success: true,
                embeddings: embeddings.map((emb) => Array.from(emb)),
              }),
            )
            .catch((error) => sendResponse({ success: false, error: error.message }));
          break;
        }

        case OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_STATUS: {
          handleGetEngineStatus()
            .then((status: any) => sendResponse({ success: true, ...status }))
            .catch((error: any) => sendResponse({ success: false, error: error.message }));
          break;
        }

        default:
          sendResponse({ error: `Unknown message type: ${message.type}` });
      }
    } catch (error) {
      if (error instanceof Error) {
        sendResponse({ error: error.message });
      } else {
        sendResponse({ error: 'Unknown error occurred' });
      }
    }

    // Return true to indicate we'll respond asynchronously
    return true;
  },
);

// Global variable to track current model state
let currentModelConfig: any = null;

/**
 * Progress callback function type
 */
type ProgressCallback = (progress: { status: string; progress: number; message?: string }) => void;

/**
 * Initialize semantic similarity engine
 */
async function handleSimilarityEngineInit(config: any): Promise<void> {
  console.log('Offscreen: Initializing semantic similarity engine with config:', config);
  console.log('Offscreen: Config useLocalFiles:', config.useLocalFiles);
  console.log('Offscreen: Config modelPreset:', config.modelPreset);
  console.log('Offscreen: Config modelVersion:', config.modelVersion);
  console.log('Offscreen: Config modelDimension:', config.modelDimension);
  console.log('Offscreen: Config modelIdentifier:', config.modelIdentifier);

  // Check if reinitialization is needed
  const reinitialization = getSimilarityReinitializationState(
    similarityEngine,
    currentModelConfig,
    config,
  );
  const needsReinit = reinitialization.required;
  if (reinitialization.change) {
    const { field, previousValue, nextValue } = reinitialization.change;
    console.log(`Offscreen: ${field} changed from ${previousValue} to ${nextValue}`);
  }
  console.log('Offscreen: Needs reinitialization:', needsReinit);

  if (!needsReinit) {
    console.log('Offscreen: Using existing engine (no changes detected)');
    await updateModelStatus('ready', 100);
    return;
  }

  // If engine already exists, clean up old instance first (support model switching)
  if (similarityEngine) {
    console.log('Offscreen: Cleaning up existing engine for model switch...');
    try {
      // Properly call dispose method to clean up all resources
      await similarityEngine.dispose();
      console.log('Offscreen: Previous engine disposed successfully');
    } catch (error) {
      console.warn('Offscreen: Failed to dispose previous engine:', error);
    }
    similarityEngine = null;
    currentModelConfig = null;

    // Clear vector data in IndexedDB to ensure data consistency
    try {
      console.log('Offscreen: Clearing IndexedDB vector data for model switch...');
      await clearSimilarityVectorDatabases('Offscreen', true);
      console.log('Offscreen: IndexedDB vector data cleared successfully');
    } catch (error) {
      console.warn('Offscreen: Failed to clear IndexedDB vector data:', error);
    }
  }

  try {
    // Update status to initializing
    await updateModelStatus('initializing', 10);

    // Create progress callback function
    const progressCallback: ProgressCallback = async (progress) => {
      console.log('Offscreen: Progress update:', progress);
      await updateModelStatus(progress.status, progress.progress);
    };

    // Create engine instance and pass progress callback
    similarityEngine = new SemanticSimilarityEngine(config);
    console.log('Offscreen: Starting engine initialization with progress tracking...');

    // Use enhanced initialization method (if progress callback is supported)
    if (typeof (similarityEngine as any).initializeWithProgress === 'function') {
      await (similarityEngine as any).initializeWithProgress(progressCallback);
    } else {
      // Fallback to standard initialization method
      console.log('Offscreen: Using standard initialization (no progress callback support)');
      await updateModelStatus('downloading', 30);
      await similarityEngine.initialize();
      await updateModelStatus('ready', 100);
    }

    // Save current configuration
    currentModelConfig = { ...config };

    console.log('Offscreen: Semantic similarity engine initialized successfully');
  } catch (error) {
    console.error('Offscreen: Failed to initialize semantic similarity engine:', error);
    // Update status to error
    const errorMessage = toErrorMessage(error) || 'Unknown initialization error';
    const errorType = classifySimilarityError(errorMessage);
    await updateModelStatus('error', 0, errorMessage, errorType);
    // Clean up failed instance
    similarityEngine = null;
    currentModelConfig = null;
    throw error;
  }
}

// Helper function to update model status
async function updateModelStatus(
  status: string,
  progress: number,
  errorMessage?: string,
  errorType?: string,
) {
  try {
    const modelState = createSimilarityModelState(status, progress, errorMessage, errorType);

    // In offscreen document, update storage through message passing to background script
    // because offscreen document may not have direct chrome.storage access
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEYS.SEMANTIC_MODEL_STATE]: modelState });
    } else {
      // If chrome.storage is not available, pass message to background script
      console.log('Offscreen: chrome.storage not available, sending message to background');
      try {
        await chrome.runtime.sendMessage({
          type: BACKGROUND_MESSAGE_TYPES.UPDATE_MODEL_STATUS,
          modelState: modelState,
        });
      } catch (messageError) {
        console.error('Offscreen: Failed to send status update message:', messageError);
      }
    }
  } catch (error) {
    console.error('Offscreen: Failed to update model status:', error);
  }
}

/**
 * Batch compute semantic similarity
 */
async function handleComputeSimilarityBatch(
  pairs: { text1: string; text2: string }[],
  options: Record<string, any> = {},
): Promise<number[]> {
  if (!similarityEngine) {
    throw new Error('Similarity engine not initialized. Please reinitialize the engine.');
  }

  console.log(`Offscreen: Computing similarities for ${pairs.length} pairs`);
  const similarities = await similarityEngine.computeSimilarityBatch(pairs, options);
  console.log('Offscreen: Similarity computation completed');

  return similarities;
}

/**
 * Get embedding vector for single text
 */
async function handleGetEmbedding(
  text: string,
  options: Record<string, any> = {},
): Promise<Float32Array> {
  if (!similarityEngine) {
    throw new Error('Similarity engine not initialized. Please reinitialize the engine.');
  }

  console.log(`Offscreen: Getting embedding for text: "${text.substring(0, 50)}..."`);
  const embedding = await similarityEngine.getEmbedding(text, options);
  console.log('Offscreen: Embedding computation completed');

  return embedding;
}

/**
 * Batch get embedding vectors for texts
 */
async function handleGetEmbeddingsBatch(
  texts: string[],
  options: Record<string, any> = {},
): Promise<Float32Array[]> {
  if (!similarityEngine) {
    throw new Error('Similarity engine not initialized. Please reinitialize the engine.');
  }

  console.log(`Offscreen: Getting embeddings for ${texts.length} texts`);
  const embeddings = await similarityEngine.getEmbeddingsBatch(texts, options);
  console.log('Offscreen: Batch embedding computation completed');

  return embeddings;
}

/**
 * Get engine status
 */
async function handleGetEngineStatus(): Promise<{
  isInitialized: boolean;
  currentConfig: any;
}> {
  return {
    isInitialized: !!similarityEngine,
    currentConfig: currentModelConfig,
  };
}

console.log('Offscreen: Semantic similarity engine handler loaded');
