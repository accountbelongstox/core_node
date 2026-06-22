/**
 * LocalStorage Manager - Persistent state management
 *
 * Stores:
 * - Last selected app index
 * - Expanded folder states (tree view)
 * - File viewer state (edit mode, etc.)
 */

class StorageManager {
  constructor() {
    this.STORAGE_KEY_PREFIX = 'flutter_design_tool_';
  }

  /**
   * Get full storage key
   */
  getKey(key) {
    return this.STORAGE_KEY_PREFIX + key;
  }

  /**
   * Get last selected app index
   */
  getLastSelectedApp() {
    const value = localStorage.getItem(this.getKey('last_app_index'));
    return value !== null ? parseInt(value, 10) : 0;
  }

  /**
   * Save last selected app index
   */
  setLastSelectedApp(index) {
    localStorage.setItem(this.getKey('last_app_index'), index.toString());
  }

  /**
   * Get expanded folders for a specific app
   * @param {string} appName - App name
   * @returns {Set<string>} Set of expanded folder paths
   */
  getExpandedFolders(appName) {
    const key = this.getKey(`expanded_folders_${appName}`);
    const value = localStorage.getItem(key);

    if (!value) {
      return new Set();
    }

    try {
      const parsed = JSON.parse(value);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      console.error('[STORAGE] Failed to parse expanded folders:', e);
      return new Set();
    }
  }

  /**
   * Save expanded folders for a specific app
   * @param {string} appName - App name
   * @param {Set<string>} expandedFolders - Set of expanded folder paths
   */
  setExpandedFolders(appName, expandedFolders) {
    const key = this.getKey(`expanded_folders_${appName}`);
    const array = Array.from(expandedFolders);
    localStorage.setItem(key, JSON.stringify(array));
  }

  /**
   * Get last viewed file for an app
   */
  getLastViewedFile(appName) {
    const key = this.getKey(`last_file_${appName}`);
    return localStorage.getItem(key);
  }

  /**
   * Save last viewed file for an app
   */
  setLastViewedFile(appName, filePath) {
    const key = this.getKey(`last_file_${appName}`);
    if (filePath) {
      localStorage.setItem(key, filePath);
    } else {
      localStorage.removeItem(key);
    }
  }

  /**
   * Clear all stored data
   */
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Get all stored data (for debugging)
   */
  getAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.STORAGE_KEY_PREFIX)) {
        data[key] = localStorage.getItem(key);
      }
    }
    return data;
  }
}

// Export singleton instance
const storageManager = new StorageManager();
