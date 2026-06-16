/**
 * Web shim for @capacitor/preferences (wordflow end).
 * Backs the Capacitor Preferences API with localStorage so WordFlow's
 * StorageCenter works unchanged in the web shell.
 */

function safeLs(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const Preferences = {
  async get(options: { key: string }): Promise<{ value: string | null }> {
    const ls = safeLs();
    return { value: ls ? ls.getItem(options.key) : null };
  },
  async set(options: { key: string; value: string }): Promise<void> {
    const ls = safeLs();
    if (ls) ls.setItem(options.key, options.value);
  },
  async remove(options: { key: string }): Promise<void> {
    const ls = safeLs();
    if (ls) ls.removeItem(options.key);
  },
  async clear(): Promise<void> {
    const ls = safeLs();
    if (ls) ls.clear();
  },
  async keys(): Promise<{ keys: string[] }> {
    const ls = safeLs();
    if (!ls) return { keys: [] };
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k !== null) keys.push(k);
    }
    return { keys };
  },
};

export default { Preferences };
