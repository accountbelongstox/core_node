import type { StorageKey } from '@/utils/storage-keys';

export type StorageAreaName = 'local' | 'session';

export class ExtensionStorage {
  constructor(private readonly areaName: StorageAreaName = 'local') {}

  private get area(): chrome.storage.StorageArea {
    return chrome.storage[this.areaName];
  }

  async get<T>(key: StorageKey, fallback: T): Promise<T> {
    const result = await this.area.get(key);
    return result[key] === undefined ? fallback : (result[key] as T);
  }

  async getOptional<T>(key: StorageKey): Promise<T | undefined> {
    const result = await this.area.get(key);
    return result[key] as T | undefined;
  }

  async getMany<T extends object>(keys: readonly StorageKey[]): Promise<Partial<T>> {
    return (await this.area.get([...keys])) as Partial<T>;
  }

  async set<T>(key: StorageKey, value: T): Promise<void> {
    await this.area.set({ [key]: value });
  }

  async remove(keys: StorageKey | readonly StorageKey[]): Promise<void> {
    await this.area.remove(typeof keys === 'string' ? keys : [...keys]);
  }

  subscribe<T>(key: StorageKey, listener: (value: T | undefined) => void): () => void {
    const handleChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === this.areaName && changes[key]) {
        listener(changes[key].newValue as T | undefined);
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }
}

export const localStorage = new ExtensionStorage('local');
export const sessionStorage = new ExtensionStorage('session');
