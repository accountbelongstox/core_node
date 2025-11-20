export class LocalStorageManager {
  private static prefix: string = 'app_';

  static setItem<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;

    const prefixedKey = this.prefix + key;
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(prefixedKey, serializedValue);
  }

  static getItem<T>(key: string, defaultValue?: T): T | null {
    if (typeof window === 'undefined') {
      return defaultValue || null;
    }

    const prefixedKey = this.prefix + key;
    const item = localStorage.getItem(prefixedKey);

    if (item === null) {
      return defaultValue || null;
    }

    const parsedItem = JSON.parse(item);
    return parsedItem as T;
  }

  static removeItem(key: string): void {
    if (typeof window === 'undefined') return;

    const prefixedKey = this.prefix + key;
    localStorage.removeItem(prefixedKey);
  }

  static clear(): void {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  static hasItem(key: string): boolean {
    if (typeof window === 'undefined') return false;

    const prefixedKey = this.prefix + key;
    return localStorage.getItem(prefixedKey) !== null;
  }

  static getAllKeys(): string[] {
    if (typeof window === 'undefined') return [];

    const keys = Object.keys(localStorage);
    return keys
      .filter((key) => key.startsWith(this.prefix))
      .map((key) => key.replace(this.prefix, ''));
  }

  static setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  static getPrefix(): string {
    return this.prefix;
  }
}

export default LocalStorageManager;
