/** Durable key/value records in one IndexedDB object store; an in-memory map when IndexedDB is unavailable. */
export interface KeyValueStore<T> {
  getAll(): Promise<T[]>;
  put(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_VERSION = 1;

function request<R>(req: IDBRequest<R>): Promise<R> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createMemoryKeyValueStore<T>(): KeyValueStore<T> {
  const rows = new Map<string, T>();
  return {
    getAll: async () => [...rows.values()],
    put: async (key, value) => { rows.set(key, value); },
    delete: async (key) => { rows.delete(key); },
  };
}

export function createIdbKeyValueStore<T>(dbName: string, storeName: string): KeyValueStore<T> {
  if (typeof indexedDB === 'undefined') return createMemoryKeyValueStore<T>();
  const fallback = createMemoryKeyValueStore<T>();
  let opened: Promise<IDBDatabase | null> | null = null;

  const open = (): Promise<IDBDatabase | null> => {
    opened ??= new Promise<IDBDatabase | null>((resolve) => {
      try {
        const req = indexedDB.open(dbName, DB_VERSION);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
        };
        req.onsuccess = () => {
          req.result.onversionchange = () => { req.result.close(); opened = null; };
          resolve(req.result);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return opened;
  };

  const run = async <R>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<R>): Promise<R | null> => {
    const db = await open();
    if (!db) return null;
    try {
      return await request(work(db.transaction(storeName, mode).objectStore(storeName)));
    } catch {
      return null;
    }
  };

  return {
    async getAll() {
      const rows = await run('readonly', (store) => store.getAll());
      return rows ?? fallback.getAll();
    },
    async put(key, value) {
      if ((await run('readwrite', (store) => store.put(value, key))) === null) await fallback.put(key, value);
    },
    async delete(key) {
      if ((await run('readwrite', (store) => store.delete(key))) === null) await fallback.delete(key);
    },
  };
}
