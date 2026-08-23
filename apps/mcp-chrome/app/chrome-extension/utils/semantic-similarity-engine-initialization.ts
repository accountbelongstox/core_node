import { AutoTokenizer, env as TransformersEnv } from '@xenova/transformers';
import { OFFSCREEN_MESSAGE_TYPES } from '@/common/message-types';
import { delay as waitForDelay } from './async';
import { toErrorMessage } from './errors';
import { SIMDMathEngine } from './simd-math-engine';
import {
  getCachedModelData,
  getModelIdentifierWithVersion,
  type TokenizedOutput,
  type WorkerResponsePayload,
} from './semantic-similarity-models';
import { SemanticSimilarityEngineRuntimeBase } from './semantic-similarity-engine-runtime';

export abstract class SemanticSimilarityInitializedEngine extends SemanticSimilarityEngineRuntimeBase {
  public async initializeWithProgress(
    onProgress?: (progress: { status: string; progress: number; message?: string }) => void,
  ): Promise<void> {
    if (this.isInitialized) return Promise.resolve();
    return this.initialization.run(() => this._doInitializeWithProgress(onProgress));
  }

  /**
   * 带进度回调的内部初始化方法
   */
  protected async _doInitializeWithProgress(
    onProgress?: (progress: { status: string; progress: number; message?: string }) => void,
  ): Promise<void> {
    console.log('SemanticSimilarityEngine: Initializing with progress tracking...');
    const startTime = performance.now();

    // 进度报告辅助函数
    const reportProgress = (status: string, progress: number, message?: string) => {
      if (onProgress) {
        onProgress({ status, progress, message });
      }
    };

    try {
      reportProgress('initializing', 5, 'Starting initialization...');

      this.configureExecutionMode();

      reportProgress('initializing', 10, 'Environment detection complete');

      if (this.useOffscreen) {
        reportProgress('initializing', 15, 'Setting up offscreen document...');
        reportProgress('initializing', 20, 'Delegating to offscreen document...');
        await this.initializeOffscreen();
        reportProgress('ready', 100, 'Initialized via offscreen document');
      } else {
        // 使用直接Worker模式 - 这里我们可以提供真实的进度跟踪
        await this._initializeDirectWorkerWithProgress(reportProgress);
      }

      this.isInitialized = true;
      console.log(
        `SemanticSimilarityEngine: Initialization complete in ${(performance.now() - startTime).toFixed(2)}ms`,
      );
    } catch (error) {
      console.error('SemanticSimilarityEngine: Initialization failed.', error);
      const errorMessage = toErrorMessage(error) || 'Unknown error';
      reportProgress('error', 0, `Initialization failed: ${errorMessage}`);
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initialization.reset();

      // 创建一个更详细的错误对象
      const enhancedError = new Error(errorMessage);
      enhancedError.name = 'ModelInitializationError';
      throw enhancedError;
    }
  }

  protected async _doInitialize(): Promise<void> {
    console.log('SemanticSimilarityEngine: Initializing...');
    const startTime = performance.now();
    try {
      this.configureExecutionMode();

      if (this.useOffscreen) {
        await this.initializeOffscreen();
      } else {
        // 使用直接Worker模式
        this._setupWorker();

        TransformersEnv.allowRemoteModels = !this.config.useLocalFiles;
        TransformersEnv.allowLocalModels = this.config.useLocalFiles;

        console.log(`SemanticSimilarityEngine: TransformersEnv config:`, {
          allowRemoteModels: TransformersEnv.allowRemoteModels,
          allowLocalModels: TransformersEnv.allowLocalModels,
          useLocalFiles: this.config.useLocalFiles,
        });
        if (TransformersEnv.backends?.onnx?.wasm) {
          // 检查路径是否存在
          TransformersEnv.backends.onnx.wasm.numThreads = this.config.numThreads;
        }

        let tokenizerIdentifier = this.config.modelIdentifier;
        if (this.config.useLocalFiles) {
          // 对于WXT，public目录下的资源在运行时位于根路径
          // 直接使用模型标识符，transformers.js 会自动添加 /models/ 前缀
          tokenizerIdentifier = this.config.modelIdentifier;
        }
        console.log(
          `SemanticSimilarityEngine: Loading tokenizer from ${tokenizerIdentifier} (local_files_only: ${this.config.useLocalFiles})`,
        );
        const tokenizerConfig: any = {
          quantized: false,
          local_files_only: this.config.useLocalFiles,
        };

        // 对于不需要token_type_ids的模型，在tokenizer配置中明确设置
        if (!this.config.requiresTokenTypeIds) {
          tokenizerConfig.return_token_type_ids = false;
        }

        console.log(`SemanticSimilarityEngine: Full tokenizer config:`, {
          tokenizerIdentifier,
          localModelPathPrefix: this.config.localModelPathPrefix,
          modelIdentifier: this.config.modelIdentifier,
          useLocalFiles: this.config.useLocalFiles,
          local_files_only: this.config.useLocalFiles,
          requiresTokenTypeIds: this.config.requiresTokenTypeIds,
          tokenizerConfig,
        });
        this.tokenizer = await AutoTokenizer.from_pretrained(tokenizerIdentifier, tokenizerConfig);
        console.log('SemanticSimilarityEngine: Tokenizer loaded.');

        if (this.config.useLocalFiles) {
          // Local files mode - use URL path as before
          const onnxModelPathForWorker = chrome.runtime.getURL(
            `models/${this.config.modelIdentifier}/${this.config.onnxModelFile}`,
          );
          console.log(
            `SemanticSimilarityEngine: Instructing worker to load local ONNX model from ${onnxModelPathForWorker}`,
          );
          await this._sendMessageToWorker('init', {
            modelPath: onnxModelPathForWorker,
            numThreads: this.config.numThreads,
            executionProviders: this.config.executionProviders,
          });
        } else {
          // Remote files mode - use cached model data
          const modelIdParts = this.config.modelIdentifier.split('/');
          const modelNameForUrl =
            modelIdParts.length > 1
              ? this.config.modelIdentifier
              : `Xenova/${this.config.modelIdentifier}`;
          const onnxModelUrl = `https://huggingface.co/${modelNameForUrl}/resolve/main/onnx/${this.config.onnxModelFile}`;

          if (!this.config.modelIdentifier.includes('/')) {
            console.warn(
              `Warning: modelIdentifier "${this.config.modelIdentifier}" might not be a full HuggingFace path. Assuming Xenova prefix for remote URL.`,
            );
          }

          console.log(`SemanticSimilarityEngine: Getting cached model data from ${onnxModelUrl}`);

          // Get model data from cache (may download if not cached)
          const modelData = await getCachedModelData(onnxModelUrl);

          console.log(
            `SemanticSimilarityEngine: Sending cached model data to worker (${modelData.byteLength} bytes)`,
          );

          // Send ArrayBuffer to worker with transferable objects for zero-copy
          await this._sendMessageToWorker(
            'init',
            {
              modelData: modelData,
              numThreads: this.config.numThreads,
              executionProviders: this.config.executionProviders,
            },
            [modelData],
          );
        }
        console.log('SemanticSimilarityEngine: Worker reported model initialized.');

        // 尝试初始化 SIMD 加速
        try {
          console.log('SemanticSimilarityEngine: Checking SIMD support...');
          const simdSupported = await SIMDMathEngine.checkSIMDSupport();

          if (simdSupported) {
            console.log('SemanticSimilarityEngine: SIMD supported, initializing...');
            await this.simdMath!.initialize();
            this.useSIMD = true;
            console.log('SemanticSimilarityEngine: ✅ SIMD acceleration enabled');
          } else {
            console.log(
              'SemanticSimilarityEngine: ❌ SIMD not supported, using JavaScript fallback',
            );
            console.log('SemanticSimilarityEngine: To enable SIMD, please use:');
            console.log('  - Chrome 91+ (May 2021)');
            console.log('  - Firefox 89+ (June 2021)');
            console.log('  - Safari 16.4+ (March 2023)');
            console.log('  - Edge 91+ (May 2021)');
            this.useSIMD = false;
          }
        } catch (simdError) {
          console.warn(
            'SemanticSimilarityEngine: SIMD initialization failed, using JavaScript fallback:',
            simdError,
          );
          this.useSIMD = false;
        }
      }

      this.isInitialized = true;
      console.log(
        `SemanticSimilarityEngine: Initialization complete in ${(performance.now() - startTime).toFixed(2)}ms`,
      );
    } catch (error) {
      console.error('SemanticSimilarityEngine: Initialization failed.', error);
      if (this.worker) this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initialization.reset();

      // 创建一个更详细的错误对象
      const errorMessage = toErrorMessage(error) || 'Unknown error';
      const enhancedError = new Error(errorMessage);
      enhancedError.name = 'ModelInitializationError';
      throw enhancedError;
    }
  }

  /**
   * 直接Worker模式的初始化，支持进度回调
   */
  protected async _initializeDirectWorkerWithProgress(
    reportProgress: (status: string, progress: number, message?: string) => void,
  ): Promise<void> {
    // 使用直接Worker模式
    reportProgress('initializing', 25, 'Setting up worker...');
    this._setupWorker();

    TransformersEnv.allowRemoteModels = !this.config.useLocalFiles;
    TransformersEnv.allowLocalModels = this.config.useLocalFiles;

    console.log(`SemanticSimilarityEngine: TransformersEnv config:`, {
      allowRemoteModels: TransformersEnv.allowRemoteModels,
      allowLocalModels: TransformersEnv.allowLocalModels,
      useLocalFiles: this.config.useLocalFiles,
    });
    if (TransformersEnv.backends?.onnx?.wasm) {
      TransformersEnv.backends.onnx.wasm.numThreads = this.config.numThreads;
    }

    let tokenizerIdentifier = this.config.modelIdentifier;
    if (this.config.useLocalFiles) {
      tokenizerIdentifier = this.config.modelIdentifier;
    }

    reportProgress('downloading', 40, 'Loading tokenizer...');
    console.log(
      `SemanticSimilarityEngine: Loading tokenizer from ${tokenizerIdentifier} (local_files_only: ${this.config.useLocalFiles})`,
    );

    // 使用 transformers.js 2.17+ 的进度回调功能
    const tokenizerProgressCallback = (progress: any) => {
      if (progress.status === 'downloading') {
        const progressPercent = Math.min(40 + (progress.progress || 0) * 0.3, 70);
        reportProgress(
          'downloading',
          progressPercent,
          `Downloading tokenizer: ${progress.file || ''}`,
        );
      }
    };

    const tokenizerConfig: any = {
      quantized: false,
      local_files_only: this.config.useLocalFiles,
    };

    // 对于不需要token_type_ids的模型，在tokenizer配置中明确设置
    if (!this.config.requiresTokenTypeIds) {
      tokenizerConfig.return_token_type_ids = false;
    }

    try {
      if (!this.config.useLocalFiles) {
        tokenizerConfig.progress_callback = tokenizerProgressCallback;
      }
      this.tokenizer = await AutoTokenizer.from_pretrained(tokenizerIdentifier, tokenizerConfig);
    } catch (error) {
      // 如果进度回调不支持，回退到标准方式
      console.log(
        'SemanticSimilarityEngine: Progress callback not supported, using standard loading',
      );
      delete tokenizerConfig.progress_callback;
      this.tokenizer = await AutoTokenizer.from_pretrained(tokenizerIdentifier, tokenizerConfig);
    }

    reportProgress('downloading', 70, 'Tokenizer loaded, setting up ONNX model...');
    console.log('SemanticSimilarityEngine: Tokenizer loaded.');

    if (this.config.useLocalFiles) {
      // Local files mode - use URL path as before
      const onnxModelPathForWorker = chrome.runtime.getURL(
        `models/${this.config.modelIdentifier}/${this.config.onnxModelFile}`,
      );
      reportProgress('downloading', 80, 'Loading local ONNX model...');
      console.log(
        `SemanticSimilarityEngine: Instructing worker to load local ONNX model from ${onnxModelPathForWorker}`,
      );
      await this._sendMessageToWorker('init', {
        modelPath: onnxModelPathForWorker,
        numThreads: this.config.numThreads,
        executionProviders: this.config.executionProviders,
      });
    } else {
      // Remote files mode - use cached model data
      const modelIdParts = this.config.modelIdentifier.split('/');
      const modelNameForUrl =
        modelIdParts.length > 1
          ? this.config.modelIdentifier
          : `Xenova/${this.config.modelIdentifier}`;
      const onnxModelUrl = `https://huggingface.co/${modelNameForUrl}/resolve/main/onnx/${this.config.onnxModelFile}`;

      if (!this.config.modelIdentifier.includes('/')) {
        console.warn(
          `Warning: modelIdentifier "${this.config.modelIdentifier}" might not be a full HuggingFace path. Assuming Xenova prefix for remote URL.`,
        );
      }

      reportProgress('downloading', 80, 'Loading cached ONNX model...');
      console.log(`SemanticSimilarityEngine: Getting cached model data from ${onnxModelUrl}`);

      // Get model data from cache (may download if not cached)
      const modelData = await getCachedModelData(onnxModelUrl);

      console.log(
        `SemanticSimilarityEngine: Sending cached model data to worker (${modelData.byteLength} bytes)`,
      );

      // Send ArrayBuffer to worker with transferable objects for zero-copy
      await this._sendMessageToWorker(
        'init',
        {
          modelData: modelData,
          numThreads: this.config.numThreads,
          executionProviders: this.config.executionProviders,
        },
        [modelData],
      );
    }
    console.log('SemanticSimilarityEngine: Worker reported model initialized.');

    reportProgress('initializing', 90, 'Setting up SIMD acceleration...');
    // 尝试初始化 SIMD 加速
    try {
      console.log('SemanticSimilarityEngine: Checking SIMD support...');
      const simdSupported = await SIMDMathEngine.checkSIMDSupport();

      if (simdSupported) {
        console.log('SemanticSimilarityEngine: SIMD supported, initializing...');
        await this.simdMath!.initialize();
        this.useSIMD = true;
        console.log('SemanticSimilarityEngine: ✅ SIMD acceleration enabled');
      } else {
        console.log('SemanticSimilarityEngine: ❌ SIMD not supported, using JavaScript fallback');
        this.useSIMD = false;
      }
    } catch (simdError) {
      console.warn(
        'SemanticSimilarityEngine: SIMD initialization failed, using JavaScript fallback:',
        simdError,
      );
      this.useSIMD = false;
    }

    reportProgress('ready', 100, 'Initialization complete');
  }

  public async warmupModel(): Promise<void> {
    if (!this.isInitialized && !this.initialization.isRunning) {
      await this.initialize();
    } else if (this.initialization.current) {
      await this.initialization.current;
    }
    if (!this.isInitialized) throw new Error('Engine not initialized after warmup attempt.');
    console.log('SemanticSimilarityEngine: Warming up model...');

    // 更有代表性的预热文本，包含不同长度和语言
    const warmupTexts = [
      // 短文本
      'Hello',
      '你好',
      'Test',
      // 中等长度文本
      'Hello world, this is a test.',
      '你好世界，这是一个测试。',
      'The quick brown fox jumps over the lazy dog.',
      // 长文本
      'This is a longer text that contains multiple sentences. It helps warm up the model for various text lengths.',
      '这是一个包含多个句子的较长文本。它有助于为各种文本长度预热模型。',
    ];

    try {
      // 渐进式预热：先单个，再批量
      console.log('SemanticSimilarityEngine: Phase 1 - Individual warmup...');
      for (const text of warmupTexts.slice(0, 4)) {
        await this.getEmbedding(text);
      }

      console.log('SemanticSimilarityEngine: Phase 2 - Batch warmup...');
      await this.getEmbeddingsBatch(warmupTexts.slice(4));

      // 保留预热结果，不清空缓存
      console.log('SemanticSimilarityEngine: Model warmup complete. Cache preserved.');
      console.log(`Embedding cache: ${this.cacheStats.embedding.size} items`);
      console.log(`Tokenization cache: ${this.cacheStats.tokenization.size} items`);
    } catch (error) {
      console.warn('SemanticSimilarityEngine: Warmup failed. This might not be critical.', error);
    }
  }

  protected async _tokenizeText(text: string | string[]): Promise<TokenizedOutput> {
    if (!this.tokenizer) throw new Error('Tokenizer not initialized.');

    // 对于单个文本，尝试使用缓存
    if (typeof text === 'string') {
      const cacheKey = `tokenize:${text}`;
      const cached = this.tokenizationCache.get(cacheKey);
      if (cached) {
        this.cacheStats.tokenization.hits++;
        this.cacheStats.tokenization.size = this.tokenizationCache.size;
        return cached;
      }
      this.cacheStats.tokenization.misses++;

      const startTime = performance.now();
      const tokenizerOptions: any = {
        padding: true,
        truncation: true,
        max_length: this.config.maxLength,
        return_tensors: 'np',
      };

      // 对于不需要token_type_ids的模型，明确设置return_token_type_ids为false
      if (!this.config.requiresTokenTypeIds) {
        tokenizerOptions.return_token_type_ids = false;
      }

      const result = (await this.tokenizer(text, tokenizerOptions)) as TokenizedOutput;

      // 更新性能统计
      this.performanceStats.totalTokenizationTime += performance.now() - startTime;
      this.performanceStats.averageTokenizationTime =
        this.performanceStats.totalTokenizationTime /
        (this.cacheStats.tokenization.hits + this.cacheStats.tokenization.misses);

      // 缓存结果
      this.tokenizationCache.set(cacheKey, result);
      this.cacheStats.tokenization.size = this.tokenizationCache.size;

      return result;
    }

    // 对于批量文本，直接处理（批量处理通常不重复）
    const startTime = performance.now();
    const tokenizerOptions: any = {
      padding: true,
      truncation: true,
      max_length: this.config.maxLength,
      return_tensors: 'np',
    };

    // 对于不需要token_type_ids的模型，明确设置return_token_type_ids为false
    if (!this.config.requiresTokenTypeIds) {
      tokenizerOptions.return_token_type_ids = false;
    }

    const result = (await this.tokenizer(text, tokenizerOptions)) as TokenizedOutput;

    this.performanceStats.totalTokenizationTime += performance.now() - startTime;
    return result;
  }

  protected _extractEmbeddingFromWorkerOutput(
    workerOutput: WorkerResponsePayload,
    attentionMaskArray: number[],
  ): Float32Array {
    if (!workerOutput.data || !workerOutput.dims)
      throw new Error('Invalid worker output for embedding extraction.');

    // 优化：直接使用 Float32Array，避免不必要的转换
    const lastHiddenStateData =
      workerOutput.data instanceof Float32Array
        ? workerOutput.data
        : new Float32Array(workerOutput.data);

    const dims = workerOutput.dims;
    const seqLength = dims[1];
    const hiddenSize = dims[2];

    // 使用内存池获取 embedding 数组
    const embedding = this.memoryPool.getEmbedding(hiddenSize);
    let validTokens = 0;

    for (let i = 0; i < seqLength; i++) {
      if (attentionMaskArray[i] === 1) {
        const offset = i * hiddenSize;
        for (let j = 0; j < hiddenSize; j++) {
          embedding[j] += lastHiddenStateData[offset + j];
        }
        validTokens++;
      }
    }
    if (validTokens > 0) {
      for (let i = 0; i < hiddenSize; i++) {
        embedding[i] /= validTokens;
      }
    }
    // Normalize in-place so the pool buffer is reused rather than abandoned
    // (normalizeVector allocates a new Float32Array, leaking the pool buffer).
    return this.normalizeVectorInPlace(embedding);
  }

  protected _extractBatchEmbeddingsFromWorkerOutput(
    workerOutput: WorkerResponsePayload,
    attentionMasksBatch: number[][],
  ): Float32Array[] {
    if (!workerOutput.data || !workerOutput.dims)
      throw new Error('Invalid worker output for batch embedding extraction.');

    // 优化：直接使用 Float32Array，避免不必要的转换
    const lastHiddenStateData =
      workerOutput.data instanceof Float32Array
        ? workerOutput.data
        : new Float32Array(workerOutput.data);

    const dims = workerOutput.dims;
    const batchSize = dims[0];
    const seqLength = dims[1];
    const hiddenSize = dims[2];
    const embeddings: Float32Array[] = [];

    for (let b = 0; b < batchSize; b++) {
      // 使用内存池获取 embedding 数组
      const embedding = this.memoryPool.getEmbedding(hiddenSize);
      let validTokens = 0;
      const currentAttentionMask = attentionMasksBatch[b];
      for (let i = 0; i < seqLength; i++) {
        if (currentAttentionMask[i] === 1) {
          const offset = (b * seqLength + i) * hiddenSize;
          for (let j = 0; j < hiddenSize; j++) {
            embedding[j] += lastHiddenStateData[offset + j];
          }
          validTokens++;
        }
      }
      if (validTokens > 0) {
        for (let i = 0; i < hiddenSize; i++) {
          embedding[i] /= validTokens;
        }
      }
      // Normalize in-place so the pool buffer is reused (same fix as single
      // extraction — avoids leaking pool buffers into the LRU cache).
      embeddings.push(this.normalizeVectorInPlace(embedding));
    }
    return embeddings;
  }
  public abstract getEmbedding(
    text: string,
    options?: Record<string, any>,
  ): Promise<Float32Array>;
  public abstract getEmbeddingsBatch(
    texts: string[],
    options?: Record<string, any>,
  ): Promise<Float32Array[]>;
  protected abstract normalizeVectorInPlace(vector: Float32Array): Float32Array;
}
