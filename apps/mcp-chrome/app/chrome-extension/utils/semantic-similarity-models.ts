import { AutoTokenizer, env as TransformersEnv } from '@xenova/transformers';
import type { Tensor as TransformersTensor, PreTrainedTokenizer } from '@xenova/transformers';
import LRUCache from './lru-cache';
import { SIMDMathEngine } from './simd-math-engine';
import { OffscreenManager } from './offscreen-manager';
import { STORAGE_KEYS } from '@/common/constants';
import { OFFSCREEN_MESSAGE_TYPES } from '@/common/message-types';
import { AsyncOperationController, delay as waitForDelay } from './async';
import { toErrorMessage } from './errors';

import { ModelCacheManager } from './model-cache-manager';

/**
 * Get cached model data, prioritizing cache reads and handling redirected URLs.
 * @param {string} modelUrl Stable, permanent URL of the model
 * @returns {Promise<ArrayBuffer>} Model data as ArrayBuffer
 */
export async function getCachedModelData(modelUrl: string): Promise<ArrayBuffer> {
  const cacheManager = ModelCacheManager.getInstance();

  // 1. Try to get data from cache
  const cachedData = await cacheManager.getCachedModelData(modelUrl);
  if (cachedData) {
    return cachedData;
  }

  console.log('Model not found in cache or expired. Fetching from network...');

  try {
    // 2. Fetch data from network
    const response = await fetch(modelUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
    }

    // 3. Get data and store to cache
    const arrayBuffer = await response.arrayBuffer();
    await cacheManager.storeModelData(modelUrl, arrayBuffer);

    console.log(
      `Model fetched from network and successfully cached (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB).`,
    );

    return arrayBuffer;
  } catch (error) {
    console.error(`Error fetching or caching model:`, error);
    // If fetching fails, clean up potentially incomplete cache entries
    await cacheManager.deleteCacheEntry(modelUrl);
    throw error;
  }
}

/**
 * Clear all model cache entries
 */
export async function clearModelCache(): Promise<void> {
  try {
    const cacheManager = ModelCacheManager.getInstance();
    await cacheManager.clearAllCache();
  } catch (error) {
    console.error('Failed to clear model cache:', error);
    throw error;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalSize: number;
  totalSizeMB: number;
  entryCount: number;
  entries: Array<{
    url: string;
    size: number;
    sizeMB: number;
    timestamp: number;
    age: string;
    expired: boolean;
  }>;
}> {
  try {
    const cacheManager = ModelCacheManager.getInstance();
    return await cacheManager.getCacheStats();
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    throw error;
  }
}

/**
 * Manually trigger cache cleanup
 */
export async function cleanupModelCache(): Promise<void> {
  try {
    const cacheManager = ModelCacheManager.getInstance();
    await cacheManager.manualCleanup();
  } catch (error) {
    console.error('Failed to cleanup cache:', error);
    throw error;
  }
}

/**
 * Check if the default model is cached and available
 * @returns Promise<boolean> True if default model is cached and valid
 */
export async function isDefaultModelCached(): Promise<boolean> {
  try {
    // Get the default model configuration
    const result = await chrome.storage.local.get([STORAGE_KEYS.SEMANTIC_MODEL]);
    const defaultModel =
      (result[STORAGE_KEYS.SEMANTIC_MODEL] as ModelPreset) || 'multilingual-e5-small';

    // Build the model URL — use the same filename resolver the engine uses
    // at init time so we check for the file that was actually cached.
    const modelInfo = PREDEFINED_MODELS[defaultModel];
    const modelIdentifier = modelInfo.modelIdentifier;
    const onnxModelFile = getOnnxFileNameForVersion('quantized');

    const modelIdParts = modelIdentifier.split('/');
    const modelNameForUrl = modelIdParts.length > 1 ? modelIdentifier : `Xenova/${modelIdentifier}`;
    const onnxModelUrl = `https://huggingface.co/${modelNameForUrl}/resolve/main/onnx/${onnxModelFile}`;

    // Check if this model is cached
    const cacheManager = ModelCacheManager.getInstance();
    return await cacheManager.isModelCached(onnxModelUrl);
  } catch (error) {
    console.error('Error checking if default model is cached:', error);
    return false;
  }
}

/**
 * Check if any model cache exists (for conditional initialization)
 * @returns Promise<boolean> True if any valid model cache exists
 */
export async function hasAnyModelCache(): Promise<boolean> {
  try {
    const cacheManager = ModelCacheManager.getInstance();
    return await cacheManager.hasAnyValidCache();
  } catch (error) {
    console.error('Error checking for any model cache:', error);
    return false;
  }
}

// Predefined model configurations - 2025 curated recommended models, using quantized versions to reduce file size
export const PREDEFINED_MODELS = {
  // Multilingual model - default recommendation
  'multilingual-e5-small': {
    modelIdentifier: 'Xenova/multilingual-e5-small',
    dimension: 384,
    description: 'Multilingual E5 Small - Lightweight multilingual model supporting 100+ languages',
    language: 'multilingual',
    performance: 'excellent',
    size: '116MB', // Quantized version
    latency: '20ms',
    multilingualFeatures: {
      languageSupport: '100+',
      crossLanguageRetrieval: 'good',
      chineseEnglishMixed: 'good',
    },
    modelSpecificConfig: {
      requiresTokenTypeIds: false, // E5 model doesn't require token_type_ids
    },
  },
  'multilingual-e5-base': {
    modelIdentifier: 'Xenova/multilingual-e5-base',
    dimension: 768,
    description: 'Multilingual E5 base - Medium-scale multilingual model supporting 100+ languages',
    language: 'multilingual',
    performance: 'excellent',
    size: '279MB', // Quantized version
    latency: '30ms',
    multilingualFeatures: {
      languageSupport: '100+',
      crossLanguageRetrieval: 'excellent',
      chineseEnglishMixed: 'excellent',
    },
    modelSpecificConfig: {
      requiresTokenTypeIds: false, // E5 model doesn't require token_type_ids
    },
  },
} as const;

export type ModelPreset = keyof typeof PREDEFINED_MODELS;

/**
 * Get model information
 */
export function getModelInfo(preset: ModelPreset) {
  return PREDEFINED_MODELS[preset];
}

/**
 * List all available models
 */
export function listAvailableModels() {
  return Object.entries(PREDEFINED_MODELS).map(([key, value]) => ({
    preset: key as ModelPreset,
    ...value,
  }));
}

/**
 * Recommend model based on language - only uses multilingual-e5 series models
 */
export function recommendModelForLanguage(
  _language: 'en' | 'zh' | 'multilingual' = 'multilingual',
  scenario: 'speed' | 'balanced' | 'quality' = 'balanced',
): ModelPreset {
  // All languages use multilingual models
  if (scenario === 'quality') {
    return 'multilingual-e5-base'; // High quality choice
  }
  return 'multilingual-e5-small'; // Default lightweight choice
}

/**
 * Intelligently recommend model based on device performance and usage scenario - only uses multilingual-e5 series models
 */
export function recommendModelForDevice(
  _language: 'en' | 'zh' | 'multilingual' = 'multilingual',
  deviceMemory: number = 4, // GB
  networkSpeed: 'slow' | 'fast' = 'fast',
  prioritizeSpeed: boolean = false,
): ModelPreset {
  // Low memory devices or slow network, prioritize small models
  if (deviceMemory < 4 || networkSpeed === 'slow' || prioritizeSpeed) {
    return 'multilingual-e5-small'; // Lightweight choice
  }

  // High performance devices can use better models
  if (deviceMemory >= 8 && !prioritizeSpeed) {
    return 'multilingual-e5-base'; // High performance choice
  }

  // Default balanced choice
  return 'multilingual-e5-small';
}

/**
 * Get model size information (only supports quantized version)
 */
export function getModelSizeInfo(
  preset: ModelPreset,
  _version: 'full' | 'quantized' | 'compressed' = 'quantized',
) {
  const model = PREDEFINED_MODELS[preset];

  return {
    size: model.size,
    recommended: 'quantized',
    description: `${model.description} (Size: ${model.size})`,
  };
}

/**
 * Compare performance and size of multiple models
 */
export function compareModels(presets: ModelPreset[]) {
  return presets.map((preset) => {
    const model = PREDEFINED_MODELS[preset];

    return {
      preset,
      name: model.description.split(' - ')[0],
      language: model.language,
      performance: model.performance,
      dimension: model.dimension,
      latency: model.latency,
      size: model.size,
      features: (model as any).multilingualFeatures || {},
      maxLength: (model as any).maxLength || 512,
      recommendedFor: getRecommendationContext(preset),
    };
  });
}

/**
 * Get recommended use cases for model
 */
function getRecommendationContext(preset: ModelPreset): string[] {
  const contexts: string[] = [];
  const model = PREDEFINED_MODELS[preset];

  // All models are multilingual
  contexts.push('Multilingual document processing');

  if (model.performance === 'excellent') contexts.push('High accuracy requirements');
  if (model.latency.includes('20ms')) contexts.push('Fast response');

  // Add scenarios based on model size
  const sizeInMB = parseInt(model.size.replace('MB', ''));
  if (sizeInMB < 300) {
    contexts.push('Mobile devices');
    contexts.push('Lightweight deployment');
  }

  if (preset === 'multilingual-e5-small') {
    contexts.push('Lightweight deployment');
  } else if (preset === 'multilingual-e5-base') {
    contexts.push('High accuracy requirements');
  }

  return contexts;
}

/**
 * Get ONNX model filename (only supports quantized version)
 */
export function getOnnxFileNameForVersion(
  _version: 'full' | 'quantized' | 'compressed' = 'quantized',
): string {
  // Only return quantized version filename
  return 'model_quantized.onnx';
}

/**
 * Get model identifier (only supports quantized version)
 */
export function getModelIdentifierWithVersion(
  preset: ModelPreset,
  _version: 'full' | 'quantized' | 'compressed' = 'quantized',
): string {
  const model = PREDEFINED_MODELS[preset];
  return model.modelIdentifier;
}

/**
 * Get size comparison of all available models
 */
export function getAllModelSizes() {
  const models = Object.entries(PREDEFINED_MODELS).map(([preset, config]) => {
    return {
      preset: preset as ModelPreset,
      name: config.description.split(' - ')[0],
      language: config.language,
      size: config.size,
      performance: config.performance,
      latency: config.latency,
    };
  });

  // Sort by size
  return models.sort((a, b) => {
    const sizeA = parseInt(a.size.replace('MB', ''));
    const sizeB = parseInt(b.size.replace('MB', ''));
    return sizeA - sizeB;
  });
}

// Define necessary types
export interface ModelConfig {
  modelIdentifier: string;
  localModelPathPrefix?: string; // Base path for local models (relative to public)
  onnxModelFile?: string; // ONNX model filename
  maxLength?: number;
  cacheSize?: number;
  numThreads?: number;
  executionProviders?: string[];
  useLocalFiles?: boolean;
  workerPath?: string; // Worker script path (relative to extension root)
  concurrentLimit?: number; // Worker task concurrency limit
  forceOffscreen?: boolean; // Force offscreen mode (for testing)
  modelPreset?: ModelPreset; // Predefined model selection
  dimension?: number; // Vector dimension (auto-obtained from preset model)
  modelVersion?: 'full' | 'quantized' | 'compressed'; // Model version selection
  requiresTokenTypeIds?: boolean; // Whether model requires token_type_ids input
}

export interface WorkerMessagePayload {
  modelPath?: string;
  modelData?: ArrayBuffer;
  numThreads?: number;
  executionProviders?: string[];
  input_ids?: number[];
  attention_mask?: number[];
  token_type_ids?: number[];
  dims?: {
    input_ids: number[];
    attention_mask: number[];
    token_type_ids?: number[];
  };
}

export interface WorkerResponsePayload {
  data?: Float32Array | number[]; // Tensor data as Float32Array or number array
  dims?: number[]; // Tensor dimensions
  message?: string; // For error or status messages
}

export interface WorkerStats {
  inferenceTime?: number;
  totalInferences?: number;
  averageInferenceTime?: number;
  memoryAllocations?: number;
  batchSize?: number;
}

// Memory pool manager
export class EmbeddingMemoryPool {
  private pools: Map<number, Float32Array[]> = new Map();
  private maxPoolSize: number = 10;
  private stats = { allocated: 0, reused: 0, released: 0 };

  getEmbedding(size: number): Float32Array {
    const pool = this.pools.get(size);
    if (pool && pool.length > 0) {
      this.stats.reused++;
      return pool.pop()!;
    }

    this.stats.allocated++;
    return new Float32Array(size);
  }

  releaseEmbedding(embedding: Float32Array): void {
    const size = embedding.length;
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }

    const pool = this.pools.get(size)!;
    if (pool.length < this.maxPoolSize) {
      // Clear array for reuse
      embedding.fill(0);
      pool.push(embedding);
      this.stats.released++;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  clear(): void {
    this.pools.clear();
    this.stats = { allocated: 0, reused: 0, released: 0 };
  }
}

export interface PendingMessage {
  resolve: (value: WorkerResponsePayload | PromiseLike<WorkerResponsePayload>) => void;
  reject: (reason?: any) => void;
  type: string;
}

export interface TokenizedOutput {
  // Simulates part of transformers.js tokenizer output
  input_ids: TransformersTensor;
  attention_mask: TransformersTensor;
  token_type_ids?: TransformersTensor;
}

/**
 * SemanticSimilarityEngine proxy class
 * Used by ContentIndexer and other components to reuse engine instance in offscreen, avoiding duplicate model downloads
 */

