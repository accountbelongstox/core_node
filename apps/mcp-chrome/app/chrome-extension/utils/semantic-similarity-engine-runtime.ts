import { AutoTokenizer, env as TransformersEnv } from '@xenova/transformers';
import type { Tensor as TransformersTensor, PreTrainedTokenizer } from '@xenova/transformers';
import LRUCache from './lru-cache';
import { SIMDMathEngine } from './simd-math-engine';
import { OffscreenManager } from './offscreen-manager';
import { OFFSCREEN_MESSAGE_TYPES } from '@/common/message-types';
import { AsyncOperationController } from './async';
import {
  PREDEFINED_MODELS,
  getOnnxFileNameForVersion,
  EmbeddingMemoryPool,
  type ModelConfig,
  type PendingMessage,
  type TokenizedOutput,
  type WorkerMessagePayload,
  type WorkerResponsePayload,
  type WorkerStats,
} from './semantic-similarity-models';

export abstract class SemanticSimilarityEngineRuntimeBase {
  protected worker: Worker | null = null;
  protected tokenizer: PreTrainedTokenizer | null = null;
  public isInitialized = false;
  protected readonly initialization = new AsyncOperationController<void>();
  protected nextTokenId = 0;
  protected pendingMessages = new Map<number, PendingMessage>();
  protected useOffscreen = false; // Whether to use offscreen mode

  public readonly config: Required<ModelConfig>;

  protected embeddingCache: LRUCache<string, Float32Array>;
  // Added: tokenization cache
  protected tokenizationCache: LRUCache<string, TokenizedOutput>;
  // Added: memory pool manager
  protected memoryPool: EmbeddingMemoryPool;
  // Added: SIMD math engine
  protected simdMath: SIMDMathEngine | null = null;
  protected useSIMD = false;

  public cacheStats = {
    embedding: { hits: 0, misses: 0, size: 0 },
    tokenization: { hits: 0, misses: 0, size: 0 },
  };

  public performanceStats = {
    totalEmbeddingComputations: 0,
    totalEmbeddingTime: 0,
    averageEmbeddingTime: 0,
    totalTokenizationTime: 0,
    averageTokenizationTime: 0,
    totalSimilarityComputations: 0,
    totalSimilarityTime: 0,
    averageSimilarityTime: 0,
    workerStats: null as WorkerStats | null,
  };

  protected runningWorkerTasks = 0;
  protected workerTaskQueue: (() => void)[] = [];

  /**
   * Detect if current runtime environment supports Worker
   */
  protected isWorkerSupported(): boolean {
    try {
      // Check if in Service Worker environment (background script)
      if (typeof importScripts === 'function') {
        return false;
      }

      // Check if Worker constructor is available
      return typeof Worker !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Detect if in offscreen document environment
   */
  protected isInOffscreenDocument(): boolean {
    try {
      // In offscreen document, window.location.pathname is usually '/offscreen.html'
      return (
        typeof window !== 'undefined' &&
        window.location &&
        window.location.pathname.includes('offscreen')
      );
    } catch {
      return false;
    }
  }

  /**
   * Ensure offscreen document exists
   */
  protected async ensureOffscreenDocument(): Promise<void> {
    return OffscreenManager.getInstance().ensureOffscreenDocument();
  }

  // Helper function to safely convert tensor data to number array
  protected convertTensorDataToNumbers(data: any): number[] {
    if (data instanceof BigInt64Array) {
      return Array.from(data, (val: bigint) => Number(val));
    } else if (data instanceof Int32Array) {
      return Array.from(data);
    } else {
      return Array.from(data);
    }
  }

  constructor(options: Partial<ModelConfig> = {}) {
    console.log('SemanticSimilarityEngine: Constructor called with options:', {
      useLocalFiles: options.useLocalFiles,
      modelIdentifier: options.modelIdentifier,
      forceOffscreen: options.forceOffscreen,
      modelPreset: options.modelPreset,
      modelVersion: options.modelVersion,
    });

    // Handle model presets
    let modelConfig = { ...options };
    if (options.modelPreset && PREDEFINED_MODELS[options.modelPreset]) {
      const preset = PREDEFINED_MODELS[options.modelPreset];
      const modelVersion = options.modelVersion || 'quantized'; // Default to quantized version
      const baseModelIdentifier = preset.modelIdentifier; // Use base identifier without version suffix
      const onnxFileName = getOnnxFileNameForVersion(modelVersion); // Get ONNX filename based on version

      // Get model-specific configuration
      const modelSpecificConfig = (preset as any).modelSpecificConfig || {};

      modelConfig = {
        ...options,
        modelIdentifier: baseModelIdentifier, // Use base identifier
        onnxModelFile: onnxFileName, // Set corresponding version ONNX filename
        dimension: preset.dimension,
        modelVersion: modelVersion,
        requiresTokenTypeIds: modelSpecificConfig.requiresTokenTypeIds !== false, // Default to true unless explicitly set to false
      };
      console.log(
        `SemanticSimilarityEngine: Using model preset "${options.modelPreset}" with version "${modelVersion}":`,
        preset,
      );
      console.log(`SemanticSimilarityEngine: Base model identifier: ${baseModelIdentifier}`);
      console.log(`SemanticSimilarityEngine: ONNX file for version: ${onnxFileName}`);
      console.log(
        `SemanticSimilarityEngine: Requires token_type_ids: ${modelConfig.requiresTokenTypeIds}`,
      );
    }

    // Set default configuration - using 2025 recommended default model
    this.config = {
      ...modelConfig,
      modelIdentifier: modelConfig.modelIdentifier || 'Xenova/bge-small-en-v1.5',
      localModelPathPrefix: modelConfig.localModelPathPrefix || 'models/',
      onnxModelFile: modelConfig.onnxModelFile || 'model.onnx',
      maxLength: modelConfig.maxLength || 256,
      cacheSize: modelConfig.cacheSize || 500,
      numThreads:
        modelConfig.numThreads ||
        (typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? Math.max(1, Math.floor(navigator.hardwareConcurrency / 2))
          : 2),
      executionProviders:
        modelConfig.executionProviders ||
        (typeof WebAssembly === 'object' &&
        WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]))
          ? ['wasm']
          : ['webgl']),
      useLocalFiles: (() => {
        console.log(
          'SemanticSimilarityEngine: DEBUG - modelConfig.useLocalFiles:',
          modelConfig.useLocalFiles,
        );
        console.log(
          'SemanticSimilarityEngine: DEBUG - modelConfig.useLocalFiles !== undefined:',
          modelConfig.useLocalFiles !== undefined,
        );
        const result = modelConfig.useLocalFiles !== undefined ? modelConfig.useLocalFiles : true;
        console.log('SemanticSimilarityEngine: DEBUG - final useLocalFiles value:', result);
        return result;
      })(),
      workerPath: modelConfig.workerPath || 'js/similarity.worker.js', // Will be overridden by WXT's `new URL`
      concurrentLimit:
        modelConfig.concurrentLimit ||
        Math.max(
          1,
          modelConfig.numThreads ||
            (typeof navigator !== 'undefined' && navigator.hardwareConcurrency
              ? Math.max(1, Math.floor(navigator.hardwareConcurrency / 2))
              : 2),
        ),
      forceOffscreen: modelConfig.forceOffscreen || false,
      modelPreset: modelConfig.modelPreset || 'bge-small-en-v1.5',
      dimension: modelConfig.dimension || 384,
      modelVersion: modelConfig.modelVersion || 'quantized',
      requiresTokenTypeIds: modelConfig.requiresTokenTypeIds !== false, // Default to true
    } as Required<ModelConfig>;

    console.log('SemanticSimilarityEngine: Final config:', {
      useLocalFiles: this.config.useLocalFiles,
      modelIdentifier: this.config.modelIdentifier,
      forceOffscreen: this.config.forceOffscreen,
    });

    this.embeddingCache = new LRUCache<string, Float32Array>(this.config.cacheSize);
    this.tokenizationCache = new LRUCache<string, TokenizedOutput>(
      Math.min(this.config.cacheSize, 200),
    );
    this.memoryPool = new EmbeddingMemoryPool();
    this.simdMath = new SIMDMathEngine();
  }

  protected _sendMessageToWorker(
    type: string,
    payload?: WorkerMessagePayload,
    transferList?: Transferable[],
  ): Promise<WorkerResponsePayload> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker is not initialized.'));
        return;
      }
      const id = this.nextTokenId++;
      this.pendingMessages.set(id, { resolve, reject, type });

      // Use transferable objects if provided for zero-copy transfer
      if (transferList && transferList.length > 0) {
        this.worker.postMessage({ id, type, payload }, transferList);
      } else {
        this.worker.postMessage({ id, type, payload });
      }
    });
  }

  protected _setupWorker(): void {
    console.log('SemanticSimilarityEngine: Setting up worker...');

    // 方式1: Chrome extension URL (推荐，生产环境最可靠)
    try {
      const workerUrl = chrome.runtime.getURL('workers/similarity.worker.js');
      console.log(`SemanticSimilarityEngine: Trying chrome.runtime.getURL ${workerUrl}`);
      this.worker = new Worker(workerUrl);
      console.log(`SemanticSimilarityEngine: Method 1 successful with path`);
    } catch (error) {
      console.warn('Method (chrome.runtime.getURL) failed:', error);
    }

    if (!this.worker) {
      throw new Error('Worker creation failed');
    }

    this.worker.onmessage = (
      event: MessageEvent<{
        id: number;
        type: string;
        status: string;
        payload: WorkerResponsePayload;
        stats?: WorkerStats;
      }>,
    ) => {
      const { id, status, payload, stats } = event.data;
      const promiseCallbacks = this.pendingMessages.get(id);
      if (!promiseCallbacks) return;

      this.pendingMessages.delete(id);

      // 更新 Worker 统计信息
      if (stats) {
        this.performanceStats.workerStats = stats;
      }

      if (status === 'success') {
        promiseCallbacks.resolve(payload);
      } else {
        const error = new Error(
          payload?.message || `Worker error for task ${promiseCallbacks.type}`,
        );
        (error as any).name = (payload as any)?.name || 'WorkerError';
        (error as any).stack = (payload as any)?.stack || undefined;
        console.error(
          `Error from worker (task ${id}, type ${promiseCallbacks.type}):`,
          error,
          event.data,
        );
        promiseCallbacks.reject(error);
      }
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('==== Unhandled error in SemanticSimilarityEngine Worker ====');
      console.error('Event Message:', error.message);
      console.error('Event Filename:', error.filename);
      console.error('Event Lineno:', error.lineno);
      console.error('Event Colno:', error.colno);
      if (error.error) {
        // 检查 event.error 是否存在
        console.error('Actual Error Name:', error.error.name);
        console.error('Actual Error Message:', error.error.message);
        console.error('Actual Error Stack:', error.error.stack);
      } else {
        console.error('Actual Error object (event.error) is not available. Error details:', {
          message: error.message,
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno,
        });
      }
      console.error('==========================================================');
      this.pendingMessages.forEach((callbacks) => {
        callbacks.reject(new Error(`Worker terminated or unhandled error: ${error.message}`));
      });
      this.pendingMessages.clear();
      this.isInitialized = false;
      this.initialization.reset();
    };
  }

  public get isInitializing(): boolean {
    return this.initialization.isRunning;
  }

  protected configureExecutionMode(): void {
    const workerSupported = this.isWorkerSupported();
    const inOffscreenDocument = this.isInOffscreenDocument();

    if (inOffscreenDocument || import.meta.env.FIREFOX) {
      this.useOffscreen = false;
    } else {
      this.useOffscreen = this.config.forceOffscreen || !workerSupported;
    }

    console.log(
      `SemanticSimilarityEngine: Worker supported: ${workerSupported}, In offscreen: ${inOffscreenDocument}, Using offscreen: ${this.useOffscreen}`,
    );
  }

  protected createOffscreenConfig(): Record<string, unknown> {
    const config = {
      modelIdentifier: this.config.modelIdentifier,
      localModelPathPrefix: this.config.localModelPathPrefix,
      onnxModelFile: this.config.onnxModelFile,
      maxLength: this.config.maxLength,
      cacheSize: this.config.cacheSize,
      numThreads: this.config.numThreads,
      executionProviders: this.config.executionProviders,
      useLocalFiles: Boolean(this.config.useLocalFiles),
      workerPath: this.config.workerPath,
      concurrentLimit: this.config.concurrentLimit,
      forceOffscreen: this.config.forceOffscreen,
      modelPreset: this.config.modelPreset,
      modelVersion: this.config.modelVersion,
      dimension: this.config.dimension,
    };
    return JSON.parse(JSON.stringify(config));
  }

  protected async initializeOffscreen(): Promise<void> {
    await this.ensureOffscreenDocument();
    const response = await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_INIT,
      config: this.createOffscreenConfig(),
    });
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to initialize engine in offscreen document');
    }
    console.log('SemanticSimilarityEngine: Initialized via offscreen document');
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return Promise.resolve();
    return this.initialization.run(() => this._doInitialize());
  }

  /**
   * 带进度回调的初始化方法
   */
  protected abstract _doInitialize(): Promise<void>;
  public abstract initializeWithProgress(
    onProgress?: (progress: { status: string; progress: number; message?: string }) => void,
  ): Promise<void>;
}

