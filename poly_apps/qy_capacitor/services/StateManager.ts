/**
 * State Manager - Unified Global State Management
 * Simple reactive state management with optional persistence
 */

import { StorageCenter, StorageKey } from './StorageCenter';

type Listener<T> = (state: T) => void;

interface StateConfig {
  persist?: boolean;
  storageKey?: StorageKey;
}

class StateManagerClass {
  private states: Map<string, any> = new Map();
  private listeners: Map<string, Set<Listener<any>>> = new Map();
  private configs: Map<string, StateConfig> = new Map();

  /**
   * Create a state
   */
  create<T>(key: string, initialValue: T, config?: StateConfig): void {
    if (this.states.has(key)) {
      console.warn(`[StateManager] State "${key}" already exists`);
      return;
    }

    // If persistent, try to load from storage
    let value = initialValue;
    if (config?.persist && config.storageKey) {
      const stored = StorageCenter.get<T>(config.storageKey) as unknown as T | null;
      if (stored !== null) {
        value = stored;
        console.log(`[StateManager] Loaded persistent state "${key}" from storage`);
      }
    }

    this.states.set(key, value);
    this.listeners.set(key, new Set());
    if (config) {
      this.configs.set(key, config);
    }
  }

  /**
   * Create a persistent state (auto-saves to StorageCenter)
   */
  createPersistent<T>(key: string, storageKey: StorageKey, initialValue: T): void {
    this.create(key, initialValue, { persist: true, storageKey });
  }

  /**
   * Get current state value
   */
  get<T>(key: string): T | undefined {
    return this.states.get(key);
  }

  /**
   * Set state value and notify listeners
   */
  set<T>(key: string, value: T | ((prev: T) => T)): void {
    const currentValue = this.states.get(key);

    const newValue = typeof value === 'function'
      ? (value as (prev: T) => T)(currentValue)
      : value;

    this.states.set(key, newValue);

    // Auto-save if persistent
    const config = this.configs.get(key);
    if (config?.persist && config.storageKey) {
      StorageCenter.set(config.storageKey, newValue);
    }

    // Notify listeners
    const stateListeners = this.listeners.get(key);
    if (stateListeners) {
      stateListeners.forEach(listener => listener(newValue));
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe<T>(key: string, listener: Listener<T>): () => void {
    let stateListeners = this.listeners.get(key);

    if (!stateListeners) {
      stateListeners = new Set();
      this.listeners.set(key, stateListeners);
    }

    stateListeners.add(listener);

    // Return unsubscribe function
    return () => {
      stateListeners?.delete(listener);
    };
  }

  /**
   * Delete a state
   */
  delete(key: string): void {
    this.states.delete(key);
    this.listeners.delete(key);
  }

  /**
   * Clear all states
   */
  clearAll(): void {
    this.states.clear();
    this.listeners.clear();
  }
}

export const StateManager = new StateManagerClass();

// Predefined global states
export const GlobalState = {
  // User state
  USER: 'global.user',
  IS_LOGGED_IN: 'global.isLoggedIn',

  // UI state
  CURRENT_PAGE: 'global.currentPage',
  IS_LOADING: 'global.isLoading',
  ERROR_MESSAGE: 'global.errorMessage',

  // Settings
  SETTINGS: 'global.settings',
  THEME: 'global.theme',
  LANGUAGE: 'global.language',

  // Learning state
  ACTIVE_GROUP_ID: 'global.activeGroupId',
  LEARNING_STATS: 'global.learningStats',
};

// Initialize default states
StateManager.create(GlobalState.USER, null);
StateManager.create(GlobalState.IS_LOGGED_IN, false);
StateManager.create(GlobalState.CURRENT_PAGE, 'login');
StateManager.create(GlobalState.IS_LOADING, false);
StateManager.create(GlobalState.ERROR_MESSAGE, null);
StateManager.create(GlobalState.THEME, 'auto');
StateManager.create(GlobalState.LANGUAGE, 'en');
StateManager.create(GlobalState.ACTIVE_GROUP_ID, 'g1');
StateManager.create(GlobalState.LEARNING_STATS, null);
