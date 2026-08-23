/**
 * Vector database manager
 * Uses hnswlib-wasm for high-performance vector similarity search
 * Implements singleton pattern to avoid duplicate WASM module initialization
 */

import type { TextChunk } from './text-chunker';
import { AsyncOperationController } from './async';
import {
  IndexedDBHelper,
  getGlobalHnswlib,
  initializeGlobalHnswlib,
  queueVectorFileSystemSync,
  syncFileSystemWithTimeout,
} from './vector-database-storage';

export interface VectorDocument {
  id: string;
  tabId: number;
  url: string;
  title: string;
  chunk: TextChunk;
  embedding: Float32Array;
  timestamp: number;
}

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  distance: number;
}

export interface VectorDatabaseConfig {
  dimension: number;
  maxElements: number;
  efConstruction: number;
  M: number;
  efSearch: number;
  indexFileName: string;
  enableAutoCleanup?: boolean;
  maxRetentionDays?: number;
}

export abstract class VectorDatabaseRuntimeBase {
  protected index: any = null;
  protected isInitialized = false;
  protected readonly initialization = new AsyncOperationController<void>();

  protected documents = new Map<number, VectorDocument>();
  protected tabDocuments = new Map<number, Set<number>>();
  protected nextLabel = 0;

  protected readonly config: VectorDatabaseConfig;

  constructor(config?: Partial<VectorDatabaseConfig>) {
    this.config = {
      dimension: 384,
      maxElements: 100000,
      efConstruction: 200,
      M: 48,
      efSearch: 50,
      indexFileName: 'tab_content_index.dat',
      enableAutoCleanup: true,
      maxRetentionDays: 30,
      ...config,
    };

    console.log('VectorDatabase: Initialized with config:', {
      dimension: this.config.dimension,
      efSearch: this.config.efSearch,
      M: this.config.M,
      efConstruction: this.config.efConstruction,
      enableAutoCleanup: this.config.enableAutoCleanup,
      maxRetentionDays: this.config.maxRetentionDays,
    });
  }

  /**
   * Initialize vector database
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    return this.initialization.run(() => this._doInitialize());
  }

  protected async _doInitialize(): Promise<void> {
    try {
      console.log('VectorDatabase: Initializing...');

      const hnswlib = await initializeGlobalHnswlib();

      hnswlib.EmscriptenFileSystemManager.setDebugLogs(true);

      this.index = new hnswlib.HierarchicalNSW(
        'cosine',
        this.config.dimension,
        this.config.indexFileName,
      );

      await this.syncFileSystem('read');

      const indexExists = hnswlib.EmscriptenFileSystemManager.checkFileExists(
        this.config.indexFileName,
      );

      if (indexExists) {
        console.log('VectorDatabase: Loading existing index...');
        try {
          await this.index.readIndex(this.config.indexFileName, this.config.maxElements);
          this.index.setEfSearch(this.config.efSearch);

          await this.loadDocumentMappings();

          if (this.documents.size > 0) {
            const maxLabel = Math.max(...Array.from(this.documents.keys()));
            this.nextLabel = maxLabel + 1;
            console.log(
              `VectorDatabase: Loaded existing index with ${this.documents.size} documents, next label: ${this.nextLabel}`,
            );
          } else {
            const indexCount = this.index.getCurrentCount();
            if (indexCount > 0) {
              console.warn(
                `VectorDatabase: Index has ${indexCount} vectors but no document mappings found. This may cause label mismatch.`,
              );
              this.nextLabel = indexCount;
            } else {
              this.nextLabel = 0;
            }
            console.log(
              `VectorDatabase: No document mappings found, starting with next label: ${this.nextLabel}`,
            );
          }
        } catch (loadError) {
          console.warn(
            'VectorDatabase: Failed to load existing index, creating new one:',
            loadError,
          );

          this.index.initIndex(
            this.config.maxElements,
            this.config.M,
            this.config.efConstruction,
            200,
          );
          this.index.setEfSearch(this.config.efSearch);
          this.nextLabel = 0;
        }
      } else {
        console.log('VectorDatabase: Creating new index...');
        this.index.initIndex(
          this.config.maxElements,
          this.config.M,
          this.config.efConstruction,
          200,
        );
        this.index.setEfSearch(this.config.efSearch);
        this.nextLabel = 0;
      }

      this.isInitialized = true;
      console.log('VectorDatabase: Initialization completed successfully');
    } catch (error) {
      console.error('VectorDatabase: Initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Add document to vector database
   */
  public async addDocument(
    tabId: number,
    url: string,
    title: string,
    chunk: TextChunk,
    embedding: Float32Array,
  ): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const documentId = this.generateDocumentId(tabId, chunk.index);
    const document: VectorDocument = {
      id: documentId,
      tabId,
      url,
      title,
      chunk,
      embedding,
      timestamp: Date.now(),
    };

    try {
      // Validate vector data
      if (!embedding || embedding.length !== this.config.dimension) {
        const errorMsg = `Invalid embedding dimension: expected ${this.config.dimension}, got ${embedding?.length || 0}`;
        console.error('VectorDatabase: Dimension mismatch detected!', {
          expectedDimension: this.config.dimension,
          actualDimension: embedding?.length || 0,
          documentId,
          tabId,
          url,
          title: title.substring(0, 50) + '...',
        });

        // This might be caused by model switching, suggest reinitialization
        console.warn(
          'VectorDatabase: This might be caused by model switching. Consider reinitializing the vector database with the correct dimension.',
        );

        throw new Error(errorMsg);
      }

      // Check if vector data contains invalid values
      for (let i = 0; i < embedding.length; i++) {
        if (!isFinite(embedding[i])) {
          throw new Error(`Invalid embedding value at index ${i}: ${embedding[i]}`);
        }
      }

      // Ensure we have a clean Float32Array
      let cleanEmbedding: Float32Array;
      if (embedding instanceof Float32Array) {
        cleanEmbedding = embedding;
      } else {
        cleanEmbedding = new Float32Array(embedding);
      }

      // Use current nextLabel as label
      const label = this.nextLabel++;

      console.log(
        `VectorDatabase: Adding document with label ${label}, embedding dimension: ${embedding.length}`,
      );

      // Add vector to hnswlib index via the shared vector-preparation helper
      // (VectorFloat → JS array → Float32Array → spread fallback).
      await this.invokeHnswWithVector(cleanEmbedding, (vec) =>
        this.index.addPoint(vec, label, false),
      );

      console.log(`VectorDatabase: Added document with label ${label}`);

      // Store document mapping
      this.documents.set(label, document);

      // Update tab document mapping
      if (!this.tabDocuments.has(tabId)) {
        this.tabDocuments.set(tabId, new Set());
      }
      this.tabDocuments.get(tabId)!.add(label);

      // Save index and mappings
      await this.saveIndex();
      await this.saveDocumentMappings();

      // Check if auto cleanup is needed
      if (this.config.enableAutoCleanup) {
        await this.checkAndPerformAutoCleanup();
      }

      console.log(`VectorDatabase: Successfully added document ${documentId} with label ${label}`);
      return label;
    } catch (error) {
      console.error('VectorDatabase: Failed to add document:', error);
      console.error('VectorDatabase: Embedding info:', {
        type: typeof embedding,
        constructor: embedding?.constructor?.name,
        length: embedding?.length,
        isFloat32Array: embedding instanceof Float32Array,
        firstFewValues: embedding ? Array.from(embedding.slice(0, 5)) : null,
      });
      throw error;
    }
  }

  /**
   * Search similar documents
   */
  public async search(queryEmbedding: Float32Array, topK: number = 10): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Validate query vector
      if (!queryEmbedding || queryEmbedding.length !== this.config.dimension) {
        throw new Error(
          `Invalid query embedding dimension: expected ${this.config.dimension}, got ${queryEmbedding?.length || 0}`,
        );
      }

      // Check if query vector contains invalid values
      for (let i = 0; i < queryEmbedding.length; i++) {
        if (!isFinite(queryEmbedding[i])) {
          throw new Error(`Invalid query embedding value at index ${i}: ${queryEmbedding[i]}`);
        }
      }

      console.log(
        `VectorDatabase: Searching with query embedding dimension: ${queryEmbedding.length}, topK: ${topK}`,
      );

      // Check if index is empty
      const currentCount = this.index.getCurrentCount();
      if (currentCount === 0) {
        console.log('VectorDatabase: Index is empty, returning no results');
        return [];
      }

      console.log(`VectorDatabase: Index contains ${currentCount} vectors`);

      // Check if document mapping and index are synchronized
      const mappingCount = this.documents.size;
      if (mappingCount === 0 && currentCount > 0) {
        console.warn(
          `VectorDatabase: Index has ${currentCount} vectors but document mapping is empty. Attempting to reload mappings...`,
        );
        await this.loadDocumentMappings();

        if (this.documents.size === 0) {
          console.error(
            'VectorDatabase: Failed to load document mappings. Index and mappings are out of sync.',
          );
          return [];
        }
        console.log(
          `VectorDatabase: Successfully reloaded ${this.documents.size} document mappings`,
        );
      }

      // Search via the shared vector-preparation helper (VectorFloat → JS
      // array → Float32Array → spread fallback), matching addDocument.
      const searchResult = await this.invokeHnswWithVector(queryEmbedding, (vec) =>
        this.index.searchKnn(vec, topK, undefined),
      );

      const results: SearchResult[] = [];

      console.log(`VectorDatabase: Processing ${searchResult.neighbors.length} search neighbors`);
      console.log(`VectorDatabase: Available documents in mapping: ${this.documents.size}`);
      console.log(`VectorDatabase: Index current count: ${this.index.getCurrentCount()}`);

      for (let i = 0; i < searchResult.neighbors.length; i++) {
        const label = searchResult.neighbors[i];
        const distance = searchResult.distances[i];
        const similarity = 1 - distance; // Convert cosine distance to similarity

        console.log(
          `VectorDatabase: Processing neighbor ${i}: label=${label}, distance=${distance}, similarity=${similarity}`,
        );

        // Find corresponding document by label
        const document = this.findDocumentByLabel(label);
        if (document) {
          console.log(`VectorDatabase: Found document for label ${label}: ${document.id}`);
          results.push({
            document,
            similarity,
            distance,
          });
        } else {
          console.warn(`VectorDatabase: No document found for label ${label}`);

          // Detailed debug information
          if (i < 5) {
            // Only show detailed info for first 5 neighbors to avoid log spam
            console.warn(
              `VectorDatabase: Available labels (first 20): ${Array.from(this.documents.keys()).slice(0, 20).join(', ')}`,
            );
            console.warn(`VectorDatabase: Total available labels: ${this.documents.size}`);
            console.warn(
              `VectorDatabase: Label type: ${typeof label}, Available label types: ${Array.from(
                this.documents.keys(),
              )
                .slice(0, 3)
                .map((k) => typeof k)
                .join(', ')}`,
            );
          }
        }
      }

      console.log(
        `VectorDatabase: Found ${results.length} search results out of ${searchResult.neighbors.length} neighbors`,
      );

      // If no results found but index has data, indicates label mismatch
      if (results.length === 0 && searchResult.neighbors.length > 0) {
        console.error(
          'VectorDatabase: Label mismatch detected! Index has vectors but no matching documents found.',
        );
        console.error(
          'VectorDatabase: This usually indicates the index and document mappings are out of sync.',
        );
        console.error('VectorDatabase: Consider rebuilding the index to fix this issue.');

        // Provide some diagnostic information
        const sampleLabels = searchResult.neighbors.slice(0, 5);
        const availableLabels = Array.from(this.documents.keys()).slice(0, 5);
        console.error('VectorDatabase: Sample search labels:', sampleLabels);
        console.error('VectorDatabase: Sample available labels:', availableLabels);
      }

      return results.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error('VectorDatabase: Search failed:', error);
      console.error('VectorDatabase: Query embedding info:', {
        type: typeof queryEmbedding,
        constructor: queryEmbedding?.constructor?.name,
        length: queryEmbedding?.length,
        isFloat32Array: queryEmbedding instanceof Float32Array,
        firstFewValues: queryEmbedding ? Array.from(queryEmbedding.slice(0, 5)) : null,
      });
      throw error;
    }
  }

  /**
   * Remove all documents for a tab
   */
  public async removeTabDocuments(tabId: number): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const documentLabels = this.tabDocuments.get(tabId);
    if (!documentLabels) {
      return;
    }

    try {
      // Reuse removeDocumentByLabel so vectors are markDelete'd in the HNSW
      // index (not just the in-memory map), matching performLRUCleanup.
      // Snapshot first since removeDocumentByLabel mutates the same Set.
      const labelsToRemove = Array.from(documentLabels);
      for (const label of labelsToRemove) {
        await this.removeDocumentByLabel(label);
      }

      // Ensure the tab mapping is fully removed even if some labels were
      // orphaned (removeDocumentByLabel skips labels missing from documents,
      // leaving the Set non-empty and the tab mapping lingering).
      this.tabDocuments.delete(tabId);

      // Persist the updated index (markDelete + writeIndex) and mappings.
      await this.saveIndex();
      await this.saveDocumentMappings();

      console.log(`VectorDatabase: Removed ${labelsToRemove.length} documents for tab ${tabId}`);
    } catch (error) {
      console.error('VectorDatabase: Failed to remove tab documents:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public getStats(): {
    totalDocuments: number;
    totalTabs: number;
    indexSize: number;
    isInitialized: boolean;
  } {
    return {
      totalDocuments: this.documents.size,
      totalTabs: this.tabDocuments.size,
      indexSize: this.calculateStorageSize(),
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Calculate actual storage size (bytes)
   */
  protected calculateStorageSize(): number {
    let totalSize = 0;

    try {
      // 1. 计算文档映射的大小
      const documentsSize = this.calculateDocumentMappingsSize();
      totalSize += documentsSize;

      // 2. 计算向量数据的大小
      const vectorsSize = this.calculateVectorsSize();
      totalSize += vectorsSize;

      // 3. 估算索引结构的大小
      const indexStructureSize = this.calculateIndexStructureSize();
      totalSize += indexStructureSize;

      console.log(
        `VectorDatabase: Storage size breakdown - Documents: ${documentsSize}, Vectors: ${vectorsSize}, Index: ${indexStructureSize}, Total: ${totalSize} bytes`,
      );
    } catch (error) {
      console.warn('VectorDatabase: Failed to calculate storage size:', error);
      // 返回一个基于文档数量的估算值
      totalSize = this.documents.size * 1024; // 每个文档估算1KB
    }

    return totalSize;
  }

  /**
   * Calculate document mappings size
   */
  protected calculateDocumentMappingsSize(): number {
    let size = 0;

    // Calculate documents Map size
    for (const [label, document] of this.documents.entries()) {
      // label (number): 8 bytes
      size += 8;

      // document object
      size += this.calculateObjectSize(document);
    }

    // Calculate tabDocuments Map size
    for (const [tabId, labels] of this.tabDocuments.entries()) {
      // tabId (number): 8 bytes
      size += 8;

      // Set of labels: 8 bytes per label + Set overhead
      size += labels.size * 8 + 32; // 32 bytes Set overhead
    }

    return size;
  }

  /**
   * Calculate vectors data size
   */
  protected calculateVectorsSize(): number {
    const documentCount = this.documents.size;
    const dimension = this.config.dimension;

    // Each vector: dimension * 4 bytes (Float32)
    const vectorSize = dimension * 4;

    return documentCount * vectorSize;
  }

  /**
   * Estimate index structure size
   */
  protected calculateIndexStructureSize(): number {
    const documentCount = this.documents.size;

    if (documentCount === 0) return 0;

    // HNSW index size estimation
    // Based on papers and actual testing, HNSW index size is about 20-40% of vector data
    const vectorsSize = this.calculateVectorsSize();
    const indexOverhead = Math.floor(vectorsSize * 0.3); // 30% overhead

    // Additional graph structure overhead
    const graphOverhead = documentCount * 64; // About 64 bytes graph structure overhead per node

    return indexOverhead + graphOverhead;
  }

  /**
   * Calculate object size (rough estimation)
   */
  protected calculateObjectSize(obj: any): number {
    let size = 0;

    try {
      const jsonString = JSON.stringify(obj);
      // UTF-8 encoding, most characters 1 byte, Chinese etc 3 bytes, average 2 bytes
      size = jsonString.length * 2;
    } catch (error) {
      // If JSON serialization fails, use default estimation
      size = 512; // Default 512 bytes
    }

    return size;
  }

  /**
   * Clear entire database
   */
  protected abstract syncFileSystem(direction: 'read' | 'write'): Promise<void>;
  public abstract loadDocumentMappings(): Promise<void>;
  protected abstract generateDocumentId(tabId: number, chunkIndex: number): string;
  protected abstract findDocumentByLabel(label: number): VectorDocument | null;
  protected abstract invokeHnswWithVector(
    vector: Float32Array,
    operation: (preparedVector: any) => any,
  ): Promise<any>;
  protected abstract saveIndex(): Promise<void>;
  protected abstract saveDocumentMappings(): Promise<void>;
  protected abstract checkAndPerformAutoCleanup(): Promise<void>;
  protected abstract removeDocumentByLabel(label: number): Promise<void>;
}

