import { OFFSCREEN_MESSAGE_TYPES } from '@/common/message-types';
import { delay as waitForDelay } from './async';
import type { WorkerMessagePayload, WorkerStats } from './semantic-similarity-models';
import { SemanticSimilarityInitializedEngine } from './semantic-similarity-engine-initialization';

export * from './semantic-similarity-models';
export { SemanticSimilarityEngineProxy } from './semantic-similarity-proxy';

export class SemanticSimilarityEngine extends SemanticSimilarityInitializedEngine {
  public async getEmbedding(
    text: string,
    options: Record<string, any> = {},
  ): Promise<Float32Array> {
    if (!this.isInitialized) await this.initialize();

    const cacheKey = this.getCacheKey(text, options);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      this.cacheStats.embedding.hits++;
      this.cacheStats.embedding.size = this.embeddingCache.size;
      return cached;
    }
    this.cacheStats.embedding.misses++;

    // 如果使用offscreen模式，委托给offscreen document
    if (this.useOffscreen) {
      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_COMPUTE,
        text: text,
        options: options,
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to get embedding from offscreen document');
      }

      // 验证响应数据
      if (!response.embedding || !Array.isArray(response.embedding)) {
        throw new Error('Invalid embedding data received from offscreen document');
      }

      console.log('SemanticSimilarityEngine: Received embedding from offscreen:', {
        length: response.embedding.length,
        type: typeof response.embedding,
        isArray: Array.isArray(response.embedding),
        firstFewValues: response.embedding.slice(0, 5),
      });

      const embedding = new Float32Array(response.embedding);

      // 验证转换后的数据
      console.log('SemanticSimilarityEngine: Converted embedding:', {
        length: embedding.length,
        type: typeof embedding,
        constructor: embedding.constructor.name,
        isFloat32Array: embedding instanceof Float32Array,
        firstFewValues: Array.from(embedding.slice(0, 5)),
      });

      this.embeddingCache.set(cacheKey, embedding);
      this.cacheStats.embedding.size = this.embeddingCache.size;

      // 更新性能统计
      this.performanceStats.totalEmbeddingComputations++;

      return embedding;
    }

    if (this.runningWorkerTasks >= this.config.concurrentLimit) {
      await this.waitForWorkerSlot();
    }
    this.runningWorkerTasks++;

    const startTime = performance.now();
    try {
      const tokenized = await this._tokenizeText(text);

      const inputIdsData = this.convertTensorDataToNumbers(tokenized.input_ids.data);
      const attentionMaskData = this.convertTensorDataToNumbers(tokenized.attention_mask.data);
      const tokenTypeIdsData = tokenized.token_type_ids
        ? this.convertTensorDataToNumbers(tokenized.token_type_ids.data)
        : undefined;

      const workerPayload: WorkerMessagePayload = {
        input_ids: inputIdsData,
        attention_mask: attentionMaskData,
        token_type_ids: tokenTypeIdsData,
        dims: {
          input_ids: tokenized.input_ids.dims,
          attention_mask: tokenized.attention_mask.dims,
          token_type_ids: tokenized.token_type_ids?.dims,
        },
      };

      const workerOutput = await this._sendMessageToWorker('infer', workerPayload);
      const embedding = this._extractEmbeddingFromWorkerOutput(workerOutput, attentionMaskData);
      this.embeddingCache.set(cacheKey, embedding);
      this.cacheStats.embedding.size = this.embeddingCache.size;

      this.performanceStats.totalEmbeddingComputations++;
      this.performanceStats.totalEmbeddingTime += performance.now() - startTime;
      this.performanceStats.averageEmbeddingTime =
        this.performanceStats.totalEmbeddingTime / this.performanceStats.totalEmbeddingComputations;
      return embedding;
    } finally {
      this.runningWorkerTasks--;
      this.processWorkerQueue();
    }
  }

  public async getEmbeddingsBatch(
    texts: string[],
    options: Record<string, any> = {},
  ): Promise<Float32Array[]> {
    if (!this.isInitialized) await this.initialize();
    if (!texts || texts.length === 0) return [];

    // 如果使用offscreen模式，委托给offscreen document
    if (this.useOffscreen) {
      // 先检查缓存
      const results: (Float32Array | undefined)[] = new Array(texts.length).fill(undefined);
      const uncachedTexts: string[] = [];
      const uncachedIndices: number[] = [];

      texts.forEach((text, index) => {
        const cacheKey = this.getCacheKey(text, options);
        const cached = this.embeddingCache.get(cacheKey);
        if (cached) {
          results[index] = cached;
          this.cacheStats.embedding.hits++;
        } else {
          uncachedTexts.push(text);
          uncachedIndices.push(index);
          this.cacheStats.embedding.misses++;
        }
      });

      // 如果所有都在缓存中，直接返回
      if (uncachedTexts.length === 0) {
        return results as Float32Array[];
      }

      // 只请求未缓存的文本
      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_BATCH_COMPUTE,
        texts: uncachedTexts,
        options: options,
      });

      if (!response || !response.success) {
        throw new Error(
          response?.error || 'Failed to get embeddings batch from offscreen document',
        );
      }

      // 将结果放回对应位置并缓存
      response.embeddings.forEach((embeddingArray: number[], batchIndex: number) => {
        const embedding = new Float32Array(embeddingArray);
        const originalIndex = uncachedIndices[batchIndex];
        const originalText = uncachedTexts[batchIndex];

        results[originalIndex] = embedding;

        // 缓存结果
        const cacheKey = this.getCacheKey(originalText, options);
        this.embeddingCache.set(cacheKey, embedding);
      });

      this.cacheStats.embedding.size = this.embeddingCache.size;
      this.performanceStats.totalEmbeddingComputations += uncachedTexts.length;

      return results as Float32Array[];
    }

    const results: (Float32Array | undefined)[] = new Array(texts.length).fill(undefined);
    const uncachedTextsMap = new Map<string, number[]>();
    const textsToTokenize: string[] = [];

    texts.forEach((text, index) => {
      const cacheKey = this.getCacheKey(text, options);
      const cached = this.embeddingCache.get(cacheKey);
      if (cached) {
        results[index] = cached;
        this.cacheStats.embedding.hits++;
      } else {
        if (!uncachedTextsMap.has(text)) {
          uncachedTextsMap.set(text, []);
          textsToTokenize.push(text);
        }
        uncachedTextsMap.get(text)!.push(index);
        this.cacheStats.embedding.misses++;
      }
    });
    this.cacheStats.embedding.size = this.embeddingCache.size;

    if (textsToTokenize.length === 0) return results as Float32Array[];

    if (this.runningWorkerTasks >= this.config.concurrentLimit) {
      await this.waitForWorkerSlot();
    }
    this.runningWorkerTasks++;

    const startTime = performance.now();
    try {
      const tokenizedBatch = await this._tokenizeText(textsToTokenize);
      const workerPayload: WorkerMessagePayload = {
        input_ids: this.convertTensorDataToNumbers(tokenizedBatch.input_ids.data),
        attention_mask: this.convertTensorDataToNumbers(tokenizedBatch.attention_mask.data),
        token_type_ids: tokenizedBatch.token_type_ids
          ? this.convertTensorDataToNumbers(tokenizedBatch.token_type_ids.data)
          : undefined,
        dims: {
          input_ids: tokenizedBatch.input_ids.dims,
          attention_mask: tokenizedBatch.attention_mask.dims,
          token_type_ids: tokenizedBatch.token_type_ids?.dims,
        },
      };

      // 使用真正的批处理推理
      const workerOutput = await this._sendMessageToWorker('batchInfer', workerPayload);
      const attentionMasksForBatch: number[][] = [];
      const batchSize = tokenizedBatch.input_ids.dims[0];
      const seqLength = tokenizedBatch.input_ids.dims[1];
      const rawAttentionMaskData = this.convertTensorDataToNumbers(
        tokenizedBatch.attention_mask.data,
      );

      for (let i = 0; i < batchSize; ++i) {
        attentionMasksForBatch.push(rawAttentionMaskData.slice(i * seqLength, (i + 1) * seqLength));
      }

      const batchEmbeddings = this._extractBatchEmbeddingsFromWorkerOutput(
        workerOutput,
        attentionMasksForBatch,
      );
      batchEmbeddings.forEach((embedding, batchIdx) => {
        const originalText = textsToTokenize[batchIdx];
        const cacheKey = this.getCacheKey(originalText, options);
        this.embeddingCache.set(cacheKey, embedding);
        const originalResultIndices = uncachedTextsMap.get(originalText)!;
        originalResultIndices.forEach((idx) => {
          results[idx] = embedding;
        });
      });
      this.cacheStats.embedding.size = this.embeddingCache.size;

      this.performanceStats.totalEmbeddingComputations += textsToTokenize.length;
      this.performanceStats.totalEmbeddingTime += performance.now() - startTime;
      this.performanceStats.averageEmbeddingTime =
        this.performanceStats.totalEmbeddingTime / this.performanceStats.totalEmbeddingComputations;
      return results as Float32Array[];
    } finally {
      this.runningWorkerTasks--;
      this.processWorkerQueue();
    }
  }

  public async computeSimilarity(
    text1: string,
    text2: string,
    options: Record<string, any> = {},
  ): Promise<number> {
    if (!this.isInitialized) await this.initialize();
    this.validateInput(text1, text2);

    const simStartTime = performance.now();
    const [embedding1, embedding2] = await Promise.all([
      this.getEmbedding(text1, options),
      this.getEmbedding(text2, options),
    ]);
    const similarity = this.cosineSimilarity(embedding1, embedding2);
    console.log('computeSimilarity:', similarity);
    this.performanceStats.totalSimilarityComputations++;
    this.performanceStats.totalSimilarityTime += performance.now() - simStartTime;
    this.performanceStats.averageSimilarityTime =
      this.performanceStats.totalSimilarityTime / this.performanceStats.totalSimilarityComputations;
    return similarity;
  }

  public async computeSimilarityBatch(
    pairs: { text1: string; text2: string }[],
    options: Record<string, any> = {},
  ): Promise<number[]> {
    if (!this.isInitialized) await this.initialize();
    if (!pairs || pairs.length === 0) return [];

    // 如果使用offscreen模式，委托给offscreen document
    if (this.useOffscreen) {
      const response = await chrome.runtime.sendMessage({
        target: 'offscreen',
        type: OFFSCREEN_MESSAGE_TYPES.SIMILARITY_ENGINE_BATCH_COMPUTE,
        pairs: pairs,
        options: options,
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to compute similarities in offscreen document');
      }

      return response.similarities;
    }

    // 直接模式的原有逻辑
    const simStartTime = performance.now();
    const uniqueTextsSet = new Set<string>();
    pairs.forEach((pair) => {
      this.validateInput(pair.text1, pair.text2);
      uniqueTextsSet.add(pair.text1);
      uniqueTextsSet.add(pair.text2);
    });

    const uniqueTextsArray = Array.from(uniqueTextsSet);
    const embeddingsArray = await this.getEmbeddingsBatch(uniqueTextsArray, options);
    const embeddingMap = new Map<string, Float32Array>();
    uniqueTextsArray.forEach((text, index) => {
      embeddingMap.set(text, embeddingsArray[index]);
    });

    const similarities = pairs.map((pair) => {
      const emb1 = embeddingMap.get(pair.text1);
      const emb2 = embeddingMap.get(pair.text2);
      if (!emb1 || !emb2) {
        console.warn('Embeddings not found for pair:', pair);
        return 0;
      }
      return this.cosineSimilarity(emb1, emb2);
    });
    this.performanceStats.totalSimilarityComputations += pairs.length;
    this.performanceStats.totalSimilarityTime += performance.now() - simStartTime;
    this.performanceStats.averageSimilarityTime =
      this.performanceStats.totalSimilarityTime / this.performanceStats.totalSimilarityComputations;
    return similarities;
  }

  public async computeSimilarityMatrix(
    texts1: string[],
    texts2: string[],
    options: Record<string, any> = {},
  ): Promise<number[][]> {
    if (!this.isInitialized) await this.initialize();
    if (!texts1 || !texts2 || texts1.length === 0 || texts2.length === 0) return [];

    const simStartTime = performance.now();
    const allTextsSet = new Set<string>([...texts1, ...texts2]);
    texts1.forEach((t) => this.validateInput(t, 'valid_dummy'));
    texts2.forEach((t) => this.validateInput(t, 'valid_dummy'));

    const allTextsArray = Array.from(allTextsSet);
    const embeddingsArray = await this.getEmbeddingsBatch(allTextsArray, options);
    const embeddingMap = new Map<string, Float32Array>();
    allTextsArray.forEach((text, index) => {
      embeddingMap.set(text, embeddingsArray[index]);
    });

    // 使用 SIMD 优化的矩阵计算（如果可用）
    if (this.useSIMD && this.simdMath) {
      try {
        const embeddings1 = texts1.map((text) => embeddingMap.get(text)!).filter(Boolean);
        const embeddings2 = texts2.map((text) => embeddingMap.get(text)!).filter(Boolean);

        if (embeddings1.length === texts1.length && embeddings2.length === texts2.length) {
          const matrix = await this.simdMath.similarityMatrix(embeddings1, embeddings2);

          this.performanceStats.totalSimilarityComputations += texts1.length * texts2.length;
          this.performanceStats.totalSimilarityTime += performance.now() - simStartTime;
          this.performanceStats.averageSimilarityTime =
            this.performanceStats.totalSimilarityTime /
            this.performanceStats.totalSimilarityComputations;

          return matrix;
        }
      } catch (error) {
        console.warn('SIMD matrix computation failed, falling back to JavaScript:', error);
      }
    }

    // JavaScript 回退版本
    const matrix: number[][] = [];
    for (const textA of texts1) {
      const row: number[] = [];
      const embA = embeddingMap.get(textA);
      if (!embA) {
        console.warn(`Embedding not found for text1: "${textA}"`);
        texts2.forEach(() => row.push(0));
        matrix.push(row);
        continue;
      }
      for (const textB of texts2) {
        const embB = embeddingMap.get(textB);
        if (!embB) {
          console.warn(`Embedding not found for text2: "${textB}"`);
          row.push(0);
          continue;
        }
        row.push(this.cosineSimilarity(embA, embB));
      }
      matrix.push(row);
    }
    this.performanceStats.totalSimilarityComputations += texts1.length * texts2.length;
    this.performanceStats.totalSimilarityTime += performance.now() - simStartTime;
    this.performanceStats.averageSimilarityTime =
      this.performanceStats.totalSimilarityTime / this.performanceStats.totalSimilarityComputations;
    return matrix;
  }

  public cosineSimilarity(vecA: Float32Array, vecB: Float32Array): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      console.warn('Cosine similarity: Invalid vectors provided.', vecA, vecB);
      return 0;
    }

    // 使用 SIMD 优化版本（如果可用）
    if (this.useSIMD && this.simdMath) {
      try {
        // SIMD 版本是异步的，但为了保持接口兼容性，我们需要同步版本
        // 这里我们回退到 JavaScript 版本，或者可以考虑重构为异步
        return this.cosineSimilarityJS(vecA, vecB);
      } catch (error) {
        console.warn('SIMD cosine similarity failed, falling back to JavaScript:', error);
        return this.cosineSimilarityJS(vecA, vecB);
      }
    }

    return this.cosineSimilarityJS(vecA, vecB);
  }

  private cosineSimilarityJS(vecA: Float32Array, vecB: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // 新增：异步 SIMD 优化的余弦相似度
  public async cosineSimilaritySIMD(vecA: Float32Array, vecB: Float32Array): Promise<number> {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      console.warn('Cosine similarity: Invalid vectors provided.', vecA, vecB);
      return 0;
    }

    if (this.useSIMD && this.simdMath) {
      try {
        return await this.simdMath.cosineSimilarity(vecA, vecB);
      } catch (error) {
        console.warn('SIMD cosine similarity failed, falling back to JavaScript:', error);
      }
    }

    return this.cosineSimilarityJS(vecA, vecB);
  }

  public normalizeVector(vector: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return vector;
    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) normalized[i] = vector[i] / norm;
    return normalized;
  }

  /**
   * Normalize a vector in-place (no allocation). Used internally when the
   * buffer is owned by the memory pool and we want to avoid leaking it.
   */
  protected normalizeVectorInPlace(vector: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return vector;
    for (let i = 0; i < vector.length; i++) vector[i] = vector[i] / norm;
    return vector;
  }

  public validateInput(text1: string, text2: string | 'valid_dummy'): void {
    if (typeof text1 !== 'string' || (text2 !== 'valid_dummy' && typeof text2 !== 'string')) {
      throw new Error('Input must be a string');
    }
    if (text1.trim().length === 0 || (text2 !== 'valid_dummy' && text2.trim().length === 0)) {
      throw new Error('Input text cannot be empty');
    }
    const roughCharLimit = this.config.maxLength * 5;
    if (
      text1.length > roughCharLimit ||
      (text2 !== 'valid_dummy' && text2.length > roughCharLimit)
    ) {
      console.warn('Input text may be too long and will be truncated by the tokenizer.');
    }
  }

  private getCacheKey(text: string, _options: Record<string, any> = {}): string {
    return text; // Options currently not used to vary embedding, simplify key
  }

  public getPerformanceStats(): Record<string, any> {
    return {
      ...this.performanceStats,
      cacheStats: {
        ...this.cacheStats,
        embedding: {
          ...this.cacheStats.embedding,
          hitRate:
            this.cacheStats.embedding.hits + this.cacheStats.embedding.misses > 0
              ? this.cacheStats.embedding.hits /
                (this.cacheStats.embedding.hits + this.cacheStats.embedding.misses)
              : 0,
        },
        tokenization: {
          ...this.cacheStats.tokenization,
          hitRate:
            this.cacheStats.tokenization.hits + this.cacheStats.tokenization.misses > 0
              ? this.cacheStats.tokenization.hits /
                (this.cacheStats.tokenization.hits + this.cacheStats.tokenization.misses)
              : 0,
        },
      },
      memoryPool: this.memoryPool.getStats(),
      memoryUsage: this.getMemoryUsage(),
      isInitialized: this.isInitialized,
      isInitializing: this.initialization.isRunning,
      config: this.config,
      pendingWorkerTasks: this.workerTaskQueue.length,
      runningWorkerTasks: this.runningWorkerTasks,
    };
  }

  private async waitForWorkerSlot(): Promise<void> {
    return new Promise((resolve) => {
      this.workerTaskQueue.push(resolve);
    });
  }

  private processWorkerQueue(): void {
    if (this.workerTaskQueue.length > 0 && this.runningWorkerTasks < this.config.concurrentLimit) {
      const resolve = this.workerTaskQueue.shift();
      if (resolve) resolve();
    }
  }

  // 新增：获取 Worker 统计信息
  public async getWorkerStats(): Promise<WorkerStats | null> {
    if (!this.worker || !this.isInitialized) return null;

    try {
      const response = await this._sendMessageToWorker('getStats');
      return response as WorkerStats;
    } catch (error) {
      console.warn('Failed to get worker stats:', error);
      return null;
    }
  }

  // 新增：清理 Worker 缓冲区
  public async clearWorkerBuffers(): Promise<void> {
    if (!this.worker || !this.isInitialized) return;

    try {
      await this._sendMessageToWorker('clearBuffers');
      console.log('SemanticSimilarityEngine: Worker buffers cleared.');
    } catch (error) {
      console.warn('Failed to clear worker buffers:', error);
    }
  }

  // 新增：清理所有缓存
  public clearAllCaches(): void {
    this.embeddingCache.clear();
    this.tokenizationCache.clear();
    this.cacheStats = {
      embedding: { hits: 0, misses: 0, size: 0 },
      tokenization: { hits: 0, misses: 0, size: 0 },
    };
    console.log('SemanticSimilarityEngine: All caches cleared.');
  }

  // 新增：获取内存使用情况
  public getMemoryUsage(): {
    embeddingCacheUsage: number;
    tokenizationCacheUsage: number;
    totalCacheUsage: number;
  } {
    const embeddingStats = this.embeddingCache.getStats();
    const tokenizationStats = this.tokenizationCache.getStats();

    return {
      embeddingCacheUsage: embeddingStats.usage,
      tokenizationCacheUsage: tokenizationStats.usage,
      totalCacheUsage: (embeddingStats.usage + tokenizationStats.usage) / 2,
    };
  }

  public async dispose(): Promise<void> {
    console.log('SemanticSimilarityEngine: Disposing...');

    // 清理 Worker 缓冲区
    await this.clearWorkerBuffers();

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // 清理 SIMD 引擎
    if (this.simdMath) {
      this.simdMath.dispose();
      this.simdMath = null;
    }

    this.tokenizer = null;
    this.embeddingCache.clear();
    this.tokenizationCache.clear();
    this.memoryPool.clear();
    this.pendingMessages.clear();
    this.workerTaskQueue = [];
    this.isInitialized = false;
    this.initialization.reset();
    this.useSIMD = false;
    console.log('SemanticSimilarityEngine: Disposed.');
  }
}
