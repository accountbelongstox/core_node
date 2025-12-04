// Unified storage management (localStorage + sessionStorage)
export type StorageType = 'local' | 'session'

export interface StorageOptions {
  type?: StorageType
  prefix?: string
  serialize?: boolean
}

const DEFAULT_PREFIX = 'app_ittools_'

export const useStorage = () => {
  // Get storage instance
  const getStorage = (type: StorageType): Storage | null => {
    if (!process.client) return null
    return type === 'local' ? localStorage : sessionStorage
  }

  // Build key with prefix
  const buildKey = (key: string, prefix: string = DEFAULT_PREFIX): string => {
    return `${prefix}${key}`
  }

  // Set item in storage
  const setItem = <T = any>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): boolean => {
    try {
      const storage = getStorage(options.type || 'local')
      if (!storage) return false

      const fullKey = buildKey(key, options.prefix)
      const serialize = options.serialize !== false

      const finalValue = serialize ? JSON.stringify(value) : String(value)
      storage.setItem(fullKey, finalValue)

      return true
    } catch (error) {
      console.error(`Storage setItem error [${key}]:`, error)
      return false
    }
  }

  // Get item from storage
  const getItem = <T = any>(
    key: string,
    options: StorageOptions = {}
  ): T | null => {
    try {
      const storage = getStorage(options.type || 'local')
      if (!storage) return null

      const fullKey = buildKey(key, options.prefix)
      const value = storage.getItem(fullKey)

      if (value === null) return null

      const serialize = options.serialize !== false
      return serialize ? JSON.parse(value) : value as T
    } catch (error) {
      console.error(`Storage getItem error [${key}]:`, error)
      return null
    }
  }

  // Remove item from storage
  const removeItem = (
    key: string,
    options: StorageOptions = {}
  ): boolean => {
    try {
      const storage = getStorage(options.type || 'local')
      if (!storage) return false

      const fullKey = buildKey(key, options.prefix)
      storage.removeItem(fullKey)

      return true
    } catch (error) {
      console.error(`Storage removeItem error [${key}]:`, error)
      return false
    }
  }

  // Clear all items with prefix
  const clear = (options: StorageOptions = {}): boolean => {
    try {
      const storage = getStorage(options.type || 'local')
      if (!storage) return false

      const prefix = options.prefix || DEFAULT_PREFIX

      // Get all keys with prefix
      const keys = Object.keys(storage).filter(key => key.startsWith(prefix))

      // Remove each key
      keys.forEach(key => storage.removeItem(key))

      return true
    } catch (error) {
      console.error('Storage clear error:', error)
      return false
    }
  }

  // Check if key exists
  const hasItem = (
    key: string,
    options: StorageOptions = {}
  ): boolean => {
    const storage = getStorage(options.type || 'local')
    if (!storage) return false

    const fullKey = buildKey(key, options.prefix)
    return storage.getItem(fullKey) !== null
  }

  return {
    setItem,
    getItem,
    removeItem,
    clear,
    hasItem
  }
}
