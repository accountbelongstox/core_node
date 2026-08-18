export interface ProgressStorage<T extends { updatedAt: number }> {
  get(): Promise<T>;
  update(patch: Partial<T>): Promise<void>;
}

export function createProgressStorage<T extends { updatedAt: number }>(
  storageKey: string,
  createDefault: () => T,
): ProgressStorage<T> {
  const get = async (): Promise<T> => {
    const stored = (await chrome.storage.local.get([storageKey]))[storageKey] as T | undefined;
    return stored ? { ...createDefault(), ...stored } : createDefault();
  };

  const update = async (patch: Partial<T>): Promise<void> => {
    const next: T = {
      ...(await get()),
      ...patch,
      updatedAt: Date.now(),
    };
    await chrome.storage.local.set({ [storageKey]: next });
  };

  return { get, update };
}
