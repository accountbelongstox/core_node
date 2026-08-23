import { loadHnswlib } from 'hnswlib-wasm-static';
import { InitializationController } from './async';

let globalHnswlib: any = null;
const globalHnswlibInitialization = new InitializationController<any>();

// Serializes concurrent syncFileSystem calls into a chain so that no sync
// (especially a 'write') is silently dropped when another is in flight.
let syncChain: Promise<void> = Promise.resolve();

const DB_NAME = 'VectorDatabaseStorage';
const DB_VERSION = 1;
const STORE_NAME = 'documentMappings';

/**
 * Sync the Emscripten filesystem to persistent IndexedDB with a timeout guard.
 * Shared by the instance-level _runSync and the module-level cleanup
 * functions (resetGlobalVectorDatabase / clearAllVectorData) which previously
 * each inlined an identical Promise+setTimeout wrapper.
 */
export async function syncFileSystemWithTimeout(
  isRead: boolean,
  timeoutMs: number = 5000,
  contextLabel: string = 'cleanup',
): Promise<void> {
  if (!globalHnswlib) return;
  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`VectorDatabase: Filesystem sync (${contextLabel}) timeout`);
      resolve(); // Don't block the cleanup process
    }, timeoutMs);

    try {
      globalHnswlib.EmscriptenFileSystemManager.syncFS(isRead, () => {
        clearTimeout(timeout);
        console.log(`VectorDatabase: Filesystem sync (${contextLabel}) completed`);
        resolve();
      });
    } catch (error) {
      clearTimeout(timeout);
      console.warn(`VectorDatabase: Failed to sync filesystem (${contextLabel}):`, error);
      resolve();
    }
  });
}

/**
 * IndexedDB helper functions
 */
export class IndexedDBHelper {
  private static readonly initialization = new InitializationController<IDBDatabase>();

  static async getDB(): Promise<IDBDatabase> {
    return this.initialization.run(() => new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('indexFileName', 'indexFileName', { unique: false });
        }
      };
    }));
  }

  static async saveData(indexFileName: string, data: any): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        id: indexFileName,
        indexFileName,
        data,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async loadData(indexFileName: string): Promise<any | null> {
    const db = await this.getDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise<any | null>((resolve, reject) => {
      const request = store.get(indexFileName);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static async deleteData(indexFileName: string): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(indexFileName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all IndexedDB data (for complete cleanup during model switching)
   */
  static async clearAllData(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => {
          console.log('IndexedDBHelper: All data cleared from IndexedDB');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDBHelper: Failed to clear all data:', error);
      throw error;
    }
  }

  /**
   * Get all stored keys (for debugging)
   */
  static async getAllKeys(): Promise<string[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise<string[]>((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('IndexedDBHelper: Failed to get all keys:', error);
      return [];
    }
  }
}

/**
 * Global hnswlib-wasm initialization function
 * Ensures initialization only once across the entire application
 */
export async function initializeGlobalHnswlib(): Promise<any> {
  return globalHnswlibInitialization.run(async () => {
    try {
      console.log('VectorDatabase: Initializing global hnswlib-wasm instance...');
      globalHnswlib = await loadHnswlib();
      console.log('VectorDatabase: Global hnswlib-wasm instance initialized successfully');
      return globalHnswlib;
    } catch (error) {
      console.error('VectorDatabase: Failed to initialize global hnswlib-wasm:', error);
      throw error;
    }
  });
}

export function getGlobalHnswlib(): any {
  return globalHnswlib;
}

export function queueVectorFileSystemSync(operation: () => Promise<void>): Promise<void> {
  const run = syncChain.then(operation);
  syncChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}


