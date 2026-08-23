import {
  VectorDatabaseRuntimeBase,
  type VectorDatabaseConfig,
  type VectorDocument,
} from './vector-database-runtime';
import {
  IndexedDBHelper,
  getGlobalHnswlib,
  queueVectorFileSystemSync,
  syncFileSystemWithTimeout,
} from './vector-database-storage';

export * from './vector-database-runtime';

export class VectorDatabase extends VectorDatabaseRuntimeBase {
  public async clear(): Promise<void> {
    console.log('VectorDatabase: Starting complete database clear...');

    try {
      // Clear in-memory data structures
      this.documents.clear();
      this.tabDocuments.clear();
      this.nextLabel = 0;

      // Clear HNSW index file (in hnswlib-index database)
      if (this.isInitialized && this.index) {
        try {
          console.log('VectorDatabase: Clearing HNSW index file from IndexedDB...');

          // 1. First try to physically delete index file (using EmscriptenFileSystemManager)
          try {
            if (
              getGlobalHnswlib() &&
              getGlobalHnswlib().EmscriptenFileSystemManager.checkFileExists(this.config.indexFileName)
            ) {
              console.log(
                `VectorDatabase: Deleting physical index file: ${this.config.indexFileName}`,
              );
              getGlobalHnswlib().EmscriptenFileSystemManager.deleteFile(this.config.indexFileName);
              await this.syncFileSystem('write'); // Ensure deletion is synced to persistent storage
              console.log(
                `VectorDatabase: Physical index file ${this.config.indexFileName} deleted successfully`,
              );
            } else {
              console.log(
                `VectorDatabase: Physical index file ${this.config.indexFileName} does not exist or already deleted`,
              );
            }
          } catch (fileError) {
            console.warn(
              `VectorDatabase: Failed to delete physical index file ${this.config.indexFileName}:`,
              fileError,
            );
            // Continue with other cleanup operations, don't block the process
          }

          // 2. Delete index file from IndexedDB
          await this.index.deleteIndex(this.config.indexFileName);
          console.log('VectorDatabase: HNSW index file cleared from IndexedDB');

          // 3. Reinitialize empty index
          console.log('VectorDatabase: Reinitializing empty HNSW index...');
          this.index.initIndex(
            this.config.maxElements,
            this.config.M,
            this.config.efConstruction,
            200,
          );
          this.index.setEfSearch(this.config.efSearch);

          // 4. Force save empty index
          await this.forceSaveIndex();
        } catch (indexError) {
          console.warn('VectorDatabase: Failed to clear HNSW index file:', indexError);
          // Continue with other cleanup operations
        }
      }

      // Clear document mappings from IndexedDB (in VectorDatabaseStorage database)
      try {
        console.log('VectorDatabase: Clearing document mappings from IndexedDB...');
        await IndexedDBHelper.deleteData(this.config.indexFileName);
        console.log('VectorDatabase: Document mappings cleared from IndexedDB');
      } catch (idbError) {
        console.warn(
          'VectorDatabase: Failed to clear document mappings from IndexedDB, trying chrome.storage fallback:',
          idbError,
        );

        // Clear backup data from chrome.storage
        try {
          const storageKey = `hnswlib_document_mappings_${this.config.indexFileName}`;
          await chrome.storage.local.remove([storageKey]);
          console.log('VectorDatabase: Chrome storage fallback cleared');
        } catch (storageError) {
          console.warn('VectorDatabase: Failed to clear chrome.storage fallback:', storageError);
        }
      }

      // Save empty document mappings to ensure consistency
      await this.saveDocumentMappings();

      console.log('VectorDatabase: Complete database clear finished successfully');
    } catch (error) {
      console.error('VectorDatabase: Failed to clear database:', error);
      throw error;
    }
  }

  /**
   * Force save index and sync filesystem
   */
  protected async forceSaveIndex(): Promise<void> {
    try {
      await this.index.writeIndex(this.config.indexFileName);
      await this.syncFileSystem('write'); // Force sync
    } catch (error) {
      console.error('VectorDatabase: Failed to force save index:', error);
    }
  }

  /**
   * Check and perform auto cleanup
   */
  protected async checkAndPerformAutoCleanup(): Promise<void> {
    try {
      const currentCount = this.documents.size;
      const maxElements = this.config.maxElements;

      console.log(
        `VectorDatabase: Auto cleanup check - current: ${currentCount}, max: ${maxElements}`,
      );

      // Check if maximum element count is exceeded
      if (currentCount >= maxElements) {
        console.log('VectorDatabase: Document count reached limit, performing cleanup...');
        await this.performLRUCleanup(Math.floor(maxElements * 0.2)); // Clean up 20% of data
      }

      // Check if there's expired data
      if (this.config.maxRetentionDays && this.config.maxRetentionDays > 0) {
        await this.performTimeBasedCleanup();
      }
    } catch (error) {
      console.error('VectorDatabase: Auto cleanup failed:', error);
    }
  }

  /**
   * Perform LRU-based cleanup (delete oldest documents)
   */
  protected async performLRUCleanup(cleanupCount: number): Promise<void> {
    try {
      console.log(
        `VectorDatabase: Starting LRU cleanup, removing ${cleanupCount} oldest documents`,
      );

      // Get all documents and sort by timestamp
      const allDocuments = Array.from(this.documents.entries());
      allDocuments.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Select documents to delete
      const documentsToDelete = allDocuments.slice(0, cleanupCount);

      for (const [label, _document] of documentsToDelete) {
        await this.removeDocumentByLabel(label);
      }

      // Save updated index and mappings
      await this.saveIndex();
      await this.saveDocumentMappings();

      console.log(
        `VectorDatabase: LRU cleanup completed, removed ${documentsToDelete.length} documents`,
      );
    } catch (error) {
      console.error('VectorDatabase: LRU cleanup failed:', error);
    }
  }

  /**
   * Perform time-based cleanup (delete expired documents)
   */
  protected async performTimeBasedCleanup(): Promise<void> {
    try {
      const maxRetentionMs = this.config.maxRetentionDays! * 24 * 60 * 60 * 1000;
      const cutoffTime = Date.now() - maxRetentionMs;

      console.log(
        `VectorDatabase: Starting time-based cleanup, removing documents older than ${this.config.maxRetentionDays} days`,
      );

      const documentsToDelete: number[] = [];

      for (const [label, document] of this.documents.entries()) {
        if (document.timestamp < cutoffTime) {
          documentsToDelete.push(label);
        }
      }

      for (const label of documentsToDelete) {
        await this.removeDocumentByLabel(label);
      }

      // Save updated index and mappings
      if (documentsToDelete.length > 0) {
        await this.saveIndex();
        await this.saveDocumentMappings();
      }

      console.log(
        `VectorDatabase: Time-based cleanup completed, removed ${documentsToDelete.length} expired documents`,
      );
    } catch (error) {
      console.error('VectorDatabase: Time-based cleanup failed:', error);
    }
  }

  /**
   * Remove single document by label
   */
  protected async removeDocumentByLabel(label: number): Promise<void> {
    try {
      const document = this.documents.get(label);
      if (!document) {
        console.warn(`VectorDatabase: Document with label ${label} not found`);
        return;
      }

      // Remove vector from HNSW index
      if (this.index) {
        try {
          this.index.markDelete(label);
        } catch (indexError) {
          console.warn(
            `VectorDatabase: Failed to mark delete in index for label ${label}:`,
            indexError,
          );
        }
      }

      // Remove from memory mapping
      this.documents.delete(label);

      // Remove from tab mapping
      const tabId = document.tabId;
      if (this.tabDocuments.has(tabId)) {
        this.tabDocuments.get(tabId)!.delete(label);
        // If tab has no other documents, delete entire tab mapping
        if (this.tabDocuments.get(tabId)!.size === 0) {
          this.tabDocuments.delete(tabId);
        }
      }

      console.log(`VectorDatabase: Removed document with label ${label} from tab ${tabId}`);
    } catch (error) {
      console.error(`VectorDatabase: Failed to remove document with label ${label}:`, error);
    }
  }

  // 私有辅助方法

  protected generateDocumentId(tabId: number, chunkIndex: number): string {
    return `tab_${tabId}_chunk_${chunkIndex}_${Date.now()}`;
  }

  protected findDocumentByLabel(label: number): VectorDocument | null {
    return this.documents.get(label) || null;
  }

  /**
   * Prepare a vector for hnswlib-wasm and invoke the given index operation.
   * Consolidates the 4-method fallback (VectorFloat → JS array → Float32Array
   * → spread) used by both addPoint and searchKnn so the two paths cannot
   * diverge.
   */
  protected async invokeHnswWithVector(
    vector: Float32Array,
    operation: (preparedVector: any) => any,
  ): Promise<any> {
    let prepared: any;
    const hnswlib = getGlobalHnswlib();
    try {
      if (hnswlib?.VectorFloat) {
        prepared = new hnswlib.VectorFloat();
        for (let i = 0; i < vector.length; i++) {
          prepared.push_back(vector[i]);
        }
      } else {
        prepared = Array.from(vector);
      }

      const result = operation(prepared);

      // Clean up VectorFloat if we created one
      if (prepared && typeof prepared.delete === 'function') {
        prepared.delete();
        prepared = null; // Prevent double-delete in finally
      }

      return result;
    } catch (primaryError) {
      // Clean up VectorFloat on failure
      if (prepared && typeof prepared.delete === 'function') {
        try { prepared.delete(); } catch { /* ignore cleanup errors */ }
      }

      // Fallback: Float32Array directly
      try {
        return operation(vector);
      } catch {
        // Last resort: spread into plain array
        return operation([...vector]);
      }
    }
  }

  protected async syncFileSystem(direction: 'read' | 'write'): Promise<void> {
    if (!getGlobalHnswlib()) {
      return;
    }

    return queueVectorFileSystemSync(() => this._runSync(direction));
  }

  protected async _runSync(direction: 'read' | 'write'): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`VectorDatabase: Filesystem sync (${direction}) timeout`);
        reject(new Error('Sync timeout'));
      }, 5000);

      try {
        getGlobalHnswlib().EmscriptenFileSystemManager.syncFS(direction === 'read', () => {
          clearTimeout(timeout);
          console.log(`VectorDatabase: Filesystem sync (${direction}) completed`);
          resolve();
        });
      } catch (error) {
        clearTimeout(timeout);
        console.warn(`VectorDatabase: Failed to sync filesystem (${direction}):`, error);
        reject(error);
      }
    });
  }

  protected async saveIndex(): Promise<void> {
    try {
      await this.index.writeIndex(this.config.indexFileName);
      // Always sync to persistent IndexedDB — MV3 service workers can be
      // killed at any time, so deferring sync risks losing every vector
      // written since the last sync.
      await this.syncFileSystem('write');
    } catch (error) {
      console.error('VectorDatabase: Failed to save index:', error);
    }
  }

  protected async saveDocumentMappings(): Promise<void> {
    // Save document mappings to IndexedDB
    const mappingData = {
      documents: Array.from(this.documents.entries()),
      tabDocuments: Array.from(this.tabDocuments.entries()).map(([tabId, labels]) => [
        tabId,
        Array.from(labels),
      ]),
      nextLabel: this.nextLabel,
    };

    try {
      // Use IndexedDB to save data, supports larger storage capacity
      await IndexedDBHelper.saveData(this.config.indexFileName, mappingData);
      console.log('VectorDatabase: Document mappings saved to IndexedDB');
    } catch (idbError) {
      console.warn(
        'VectorDatabase: Failed to save to IndexedDB, falling back to chrome.storage:',
        idbError,
      );

      // Fall back to chrome.storage.local
      try {
        const storageKey = `hnswlib_document_mappings_${this.config.indexFileName}`;
        await chrome.storage.local.set({ [storageKey]: mappingData });
        console.log('VectorDatabase: Document mappings saved to chrome.storage.local (fallback)');
      } catch (storageError) {
        // Both persistence paths failed — surface the error so callers know
        // data was NOT saved (previously swallowed, causing silent data loss
        // and index/mapping desync on next load).
        console.error(
          'VectorDatabase: Failed to save to both IndexedDB and chrome.storage:',
          storageError,
        );
        throw new Error(
          `Failed to persist document mappings: IndexedDB and chrome.storage both failed`,
        );
      }
    }
  }

  public async loadDocumentMappings(): Promise<void> {
    try {
      // Load document mappings from IndexedDB
      if (!getGlobalHnswlib()) {
        return;
      }

      let mappingData = null;

      try {
        // First try to read from IndexedDB
        mappingData = await IndexedDBHelper.loadData(this.config.indexFileName);
        if (mappingData) {
          console.log(`VectorDatabase: Loaded document mappings from IndexedDB`);
        }
      } catch (idbError) {
        console.warn(
          'VectorDatabase: Failed to read from IndexedDB, trying chrome.storage:',
          idbError,
        );
      }

      // If IndexedDB has no data, try reading from chrome.storage.local (backward compatibility)
      if (!mappingData) {
        try {
          const storageKey = `hnswlib_document_mappings_${this.config.indexFileName}`;
          const result = await chrome.storage.local.get([storageKey]);
          mappingData = result[storageKey];
          if (mappingData) {
            console.log(
              `VectorDatabase: Loaded document mappings from chrome.storage.local (fallback)`,
            );

            // Migrate to IndexedDB
            try {
              await IndexedDBHelper.saveData(this.config.indexFileName, mappingData);
              console.log('VectorDatabase: Migrated data from chrome.storage to IndexedDB');
            } catch (migrationError) {
              console.warn('VectorDatabase: Failed to migrate data to IndexedDB:', migrationError);
            }
          }
        } catch (storageError) {
          console.warn('VectorDatabase: Failed to read from chrome.storage.local:', storageError);
        }
      }

      if (mappingData) {
        // Restore document mappings
        this.documents.clear();
        for (const [label, doc] of mappingData.documents) {
          this.documents.set(label, doc);
        }

        // Restore tab mappings
        this.tabDocuments.clear();
        for (const [tabId, labels] of mappingData.tabDocuments) {
          this.tabDocuments.set(tabId, new Set(labels));
        }

        // Restore nextLabel - use saved value or calculate max label + 1
        if (mappingData.nextLabel !== undefined) {
          this.nextLabel = mappingData.nextLabel;
        } else if (this.documents.size > 0) {
          // If no saved nextLabel, calculate max label + 1
          const maxLabel = Math.max(...Array.from(this.documents.keys()));
          this.nextLabel = maxLabel + 1;
        } else {
          this.nextLabel = 0;
        }

        console.log(
          `VectorDatabase: Loaded ${this.documents.size} document mappings, next label: ${this.nextLabel}`,
        );
      } else {
        console.log('VectorDatabase: No existing document mappings found');
      }
    } catch (error) {
      console.error('VectorDatabase: Failed to load document mappings:', error);
    }
  }
}

// Global VectorDatabase singleton
let globalVectorDatabase: VectorDatabase | null = null;
let currentDimension: number | null = null;

/**
 * Get global VectorDatabase singleton instance
 * If dimension changes, will recreate instance to ensure compatibility
 */
export async function getGlobalVectorDatabase(
  config?: Partial<VectorDatabaseConfig>,
): Promise<VectorDatabase> {
  const newDimension = config?.dimension || 384;

  // If dimension changes, need to recreate vector database
  if (globalVectorDatabase && currentDimension !== null && currentDimension !== newDimension) {
    console.log(
      `VectorDatabase: Dimension changed from ${currentDimension} to ${newDimension}, recreating instance`,
    );

    // Clean up old instance - this will clean up index files and document mappings
    try {
      await globalVectorDatabase.clear();
      console.log('VectorDatabase: Successfully cleared old instance for dimension change');
    } catch (error) {
      console.warn('VectorDatabase: Error during cleanup:', error);
    }

    globalVectorDatabase = null;
    currentDimension = null;
  }

  if (!globalVectorDatabase) {
    globalVectorDatabase = new VectorDatabase(config);
    currentDimension = newDimension;
    console.log(
      `VectorDatabase: Created global singleton instance with dimension ${currentDimension}`,
    );
  }

  return globalVectorDatabase;
}

/**
 * Synchronous version of getting global VectorDatabase instance (for backward compatibility)
 * Note: If dimension change is needed, recommend using async version
 */
export function getGlobalVectorDatabaseSync(
  config?: Partial<VectorDatabaseConfig>,
): VectorDatabase {
  const newDimension = config?.dimension || 384;

  // If dimension changes, log warning but don't clean up (avoid race conditions)
  if (globalVectorDatabase && currentDimension !== null && currentDimension !== newDimension) {
    console.warn(
      `VectorDatabase: Dimension mismatch detected (${currentDimension} vs ${newDimension}). Consider using async version for proper cleanup.`,
    );
  }

  if (!globalVectorDatabase) {
    globalVectorDatabase = new VectorDatabase(config);
    currentDimension = newDimension;
    console.log(
      `VectorDatabase: Created global singleton instance with dimension ${currentDimension}`,
    );
  }

  return globalVectorDatabase;
}

/**
 * Reset global VectorDatabase instance (mainly for testing or model switching)
 */
export async function resetGlobalVectorDatabase(): Promise<void> {
  console.log('VectorDatabase: Starting global instance reset...');

  if (globalVectorDatabase) {
    try {
      console.log('VectorDatabase: Clearing existing global instance...');
      await globalVectorDatabase.clear();
      console.log('VectorDatabase: Global instance cleared successfully');
    } catch (error) {
      console.warn('VectorDatabase: Failed to clear during reset:', error);
    }
  }

  // Additional cleanup: ensure all possible IndexedDB data is cleared
  try {
    console.log('VectorDatabase: Performing comprehensive IndexedDB cleanup...');

    // Clear all data in VectorDatabaseStorage database
    await IndexedDBHelper.clearAllData();

    // Clear index files from hnswlib-index database
    try {
      console.log('VectorDatabase: Clearing HNSW index files from IndexedDB...');

      // Try to clean up possible existing index files
      const possibleIndexFiles = ['tab_content_index.dat', 'content_index.dat', 'vector_index.dat'];

      // If global hnswlib instance exists, try to delete known index files
      if (typeof getGlobalHnswlib() !== 'undefined' && getGlobalHnswlib()) {
        for (const fileName of possibleIndexFiles) {
          try {
            // 1. First try to physically delete index file (using EmscriptenFileSystemManager)
            try {
              if (getGlobalHnswlib().EmscriptenFileSystemManager.checkFileExists(fileName)) {
                console.log(`VectorDatabase: Deleting physical index file: ${fileName}`);
                getGlobalHnswlib().EmscriptenFileSystemManager.deleteFile(fileName);
                console.log(`VectorDatabase: Physical index file ${fileName} deleted successfully`);
              }
            } catch (fileError) {
              console.log(
                `VectorDatabase: Physical index file ${fileName} not found or failed to delete:`,
                fileError,
              );
            }

            // 2. Delete index file from IndexedDB
            const tempIndex = new (getGlobalHnswlib().HierarchicalNSW)('cosine', 384);
            await tempIndex.deleteIndex(fileName);
            console.log(`VectorDatabase: Deleted IndexedDB index file: ${fileName}`);
          } catch (deleteError) {
            // File might not exist, this is normal
            console.log(`VectorDatabase: Index file ${fileName} not found or already deleted`);
          }
        }

        // 3. Force sync filesystem to ensure deletion takes effect
        await syncFileSystemWithTimeout(false, 3000, 'reset-cleanup');
      }
    } catch (hnswError) {
      console.warn('VectorDatabase: Failed to clear HNSW index files:', hnswError);
    }

    // Clear possible chrome.storage backup data (only clear vector database related data, preserve user preferences)
    const possibleKeys = [
      'hnswlib_document_mappings_tab_content_index.dat',
      'hnswlib_document_mappings_content_index.dat',
      'hnswlib_document_mappings_vector_index.dat',
      // Note: Don't clear selectedModel and selectedVersion, these are user preference settings
      // Note: Don't clear modelState, this contains model state info and should be handled by model management logic
    ];

    if (possibleKeys.length > 0) {
      try {
        await chrome.storage.local.remove(possibleKeys);
        console.log('VectorDatabase: Chrome storage backup data cleared');
      } catch (storageError) {
        console.warn('VectorDatabase: Failed to clear chrome.storage backup:', storageError);
      }
    }

    console.log('VectorDatabase: Comprehensive cleanup completed');
  } catch (cleanupError) {
    console.warn('VectorDatabase: Comprehensive cleanup failed:', cleanupError);
  }

  globalVectorDatabase = null;
  currentDimension = null;
  console.log('VectorDatabase: Global singleton instance reset completed');
}

/**
 * Specifically for data cleanup during model switching
 * Clear all IndexedDB data, including HNSW index files and document mappings
 */
export async function clearAllVectorData(): Promise<void> {
  console.log('VectorDatabase: Starting comprehensive vector data cleanup for model switch...');

  try {
    // 1. Clear global instance
    if (globalVectorDatabase) {
      try {
        await globalVectorDatabase.clear();
      } catch (error) {
        console.warn('VectorDatabase: Failed to clear global instance:', error);
      }
    }

    // 2. Clear VectorDatabaseStorage database
    try {
      console.log('VectorDatabase: Clearing VectorDatabaseStorage database...');
      await IndexedDBHelper.clearAllData();
    } catch (error) {
      console.warn('VectorDatabase: Failed to clear VectorDatabaseStorage:', error);
    }

    // 3. Clear hnswlib-index database and physical files
    try {
      console.log('VectorDatabase: Clearing hnswlib-index database and physical files...');

      // 3.1 First try to physically delete index files (using EmscriptenFileSystemManager)
      if (typeof getGlobalHnswlib() !== 'undefined' && getGlobalHnswlib()) {
        const possibleIndexFiles = [
          'tab_content_index.dat',
          'content_index.dat',
          'vector_index.dat',
        ];

        for (const fileName of possibleIndexFiles) {
          try {
            if (getGlobalHnswlib().EmscriptenFileSystemManager.checkFileExists(fileName)) {
              console.log(`VectorDatabase: Deleting physical index file: ${fileName}`);
              getGlobalHnswlib().EmscriptenFileSystemManager.deleteFile(fileName);
              console.log(`VectorDatabase: Physical index file ${fileName} deleted successfully`);
            }
          } catch (fileError) {
            console.log(
              `VectorDatabase: Physical index file ${fileName} not found or failed to delete:`,
              fileError,
            );
          }
        }

        // Force sync filesystem
        await syncFileSystemWithTimeout(false, 3000, 'model-switch-cleanup');
      }

      // 3.2 Delete entire hnswlib-index database
      await new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('/hnswlib-index');
        deleteRequest.onsuccess = () => {
          console.log('VectorDatabase: Successfully deleted /hnswlib-index database');
          resolve();
        };
        deleteRequest.onerror = () => {
          console.warn(
            'VectorDatabase: Failed to delete /hnswlib-index database:',
            deleteRequest.error,
          );
          resolve(); // Don't block the process
        };
        deleteRequest.onblocked = () => {
          console.warn('VectorDatabase: Deletion of /hnswlib-index database was blocked');
          resolve(); // Don't block the process
        };
      });
    } catch (error) {
      console.warn(
        'VectorDatabase: Failed to clear hnswlib-index database and physical files:',
        error,
      );
    }

    // 4. Clear backup data from chrome.storage
    try {
      const storageKeys = [
        'hnswlib_document_mappings_tab_content_index.dat',
        'hnswlib_document_mappings_content_index.dat',
        'hnswlib_document_mappings_vector_index.dat',
      ];
      await chrome.storage.local.remove(storageKeys);
      console.log('VectorDatabase: Chrome storage backup data cleared');
    } catch (error) {
      console.warn('VectorDatabase: Failed to clear chrome.storage backup:', error);
    }

    // 5. Reset global state
    globalVectorDatabase = null;
    currentDimension = null;

    console.log('VectorDatabase: Comprehensive vector data cleanup completed successfully');
  } catch (error) {
    console.error('VectorDatabase: Comprehensive vector data cleanup failed:', error);
    throw error;
  }
}
