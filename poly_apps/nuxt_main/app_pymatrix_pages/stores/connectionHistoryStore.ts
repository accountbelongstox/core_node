/**
 * Connection History Store
 *
 * Tracks device connection history, provides quick reconnect and statistics
 * 追踪设备连接历史，提供快速重连和统计信息
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface ConnectionHistoryEntry {
  serial: string;
  deviceName: string;
  model?: string;
  connectedAt: number;
  disconnectedAt?: number;
  duration?: number; // in milliseconds
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  config?: {
    maxFps?: number;
    bitrate?: number;
    maxSize?: number;
  };
}

export interface RecentDevice {
  serial: string;
  deviceName: string;
  model?: string;
  lastConnected: number;
  connectionCount: number;
  totalDuration: number; // in milliseconds
  averageDuration: number; // in milliseconds
  lastConfig?: ConnectionHistoryEntry['config'];
}

const STORAGE_KEY = 'pymatrix_connection_history';
const MAX_HISTORY_ENTRIES = 100;

export const useConnectionHistoryStore = defineStore('connectionHistory', () => {
  const history = ref<ConnectionHistoryEntry[]>([]);
  const recentDevices = ref<RecentDevice[]>([]);

  // Computed statistics
  const totalConnections = computed(() => history.value.length);

  const totalConnectionTime = computed(() => {
    return history.value.reduce((sum, entry) => {
      return sum + (entry.duration || 0);
    }, 0);
  });

  const averageConnectionTime = computed(() => {
    if (history.value.length === 0) return 0;
    return totalConnectionTime.value / history.value.length;
  });

  const recentHistory = computed(() => {
    return [...history.value]
      .sort((a, b) => b.connectedAt - a.connectedAt)
      .slice(0, 10);
  });

  const topDevices = computed(() => {
    return [...recentDevices.value]
      .sort((a, b) => b.connectionCount - a.connectionCount)
      .slice(0, 5);
  });

  /**
   * Add a connection entry
   */
  function addConnection(entry: Omit<ConnectionHistoryEntry, 'connectedAt'>): ConnectionHistoryEntry {
    const newEntry: ConnectionHistoryEntry = {
      ...entry,
      connectedAt: Date.now()
    };

    history.value.push(newEntry);
    updateRecentDevices(newEntry);

    // Limit history size
    if (history.value.length > MAX_HISTORY_ENTRIES) {
      history.value = history.value.slice(-MAX_HISTORY_ENTRIES);
    }

    saveToStorage();
    console.log('[ConnectionHistory] Connection added:', newEntry.serial);

    return newEntry;
  }

  /**
   * Update connection with disconnect info
   */
  function endConnection(serial: string, quality?: ConnectionHistoryEntry['quality']): void {
    const entry = history.value.find(
      e => e.serial === serial && !e.disconnectedAt
    );

    if (entry) {
      entry.disconnectedAt = Date.now();
      entry.duration = entry.disconnectedAt - entry.connectedAt;
      if (quality) entry.quality = quality;

      updateRecentDevices(entry);
      saveToStorage();
      console.log('[ConnectionHistory] Connection ended:', serial, 'Duration:', entry.duration);
    }
  }

  /**
   * Update recent devices statistics
   */
  function updateRecentDevices(entry: ConnectionHistoryEntry): void {
    let recentDevice = recentDevices.value.find(d => d.serial === entry.serial);

    if (!recentDevice) {
      recentDevice = {
        serial: entry.serial,
        deviceName: entry.deviceName,
        model: entry.model,
        lastConnected: entry.connectedAt,
        connectionCount: 0,
        totalDuration: 0,
        averageDuration: 0,
        lastConfig: entry.config
      };
      recentDevices.value.push(recentDevice);
    }

    recentDevice.lastConnected = entry.connectedAt;
    recentDevice.connectionCount++;

    if (entry.duration) {
      recentDevice.totalDuration += entry.duration;
      recentDevice.averageDuration = recentDevice.totalDuration / recentDevice.connectionCount;
    }

    if (entry.config) {
      recentDevice.lastConfig = entry.config;
    }

    saveToStorage();
  }

  /**
   * Get recent connections for a specific device
   */
  function getDeviceHistory(serial: string): ConnectionHistoryEntry[] {
    return history.value
      .filter(e => e.serial === serial)
      .sort((a, b) => b.connectedAt - a.connectedAt);
  }

  /**
   * Get device statistics
   */
  function getDeviceStats(serial: string): RecentDevice | null {
    return recentDevices.value.find(d => d.serial === serial) || null;
  }

  /**
   * Clear all history
   */
  function clearHistory(): void {
    history.value = [];
    recentDevices.value = [];
    saveToStorage();
    console.log('[ConnectionHistory] History cleared');
  }

  /**
   * Clear history for a specific device
   */
  function clearDeviceHistory(serial: string): void {
    history.value = history.value.filter(e => e.serial !== serial);
    recentDevices.value = recentDevices.value.filter(d => d.serial !== serial);
    saveToStorage();
    console.log('[ConnectionHistory] Device history cleared:', serial);
  }

  /**
   * Save to localStorage
   */
  function saveToStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        history: history.value,
        recentDevices: recentDevices.value
      })
    );
  }

  /**
   * Load from localStorage
   */
  function loadFromStorage(): void {
    if (typeof window === 'undefined') {
      history.value = [];
      recentDevices.value = [];
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      history.value = data.history || [];
      recentDevices.value = data.recentDevices || [];
      console.log('[ConnectionHistory] Loaded from storage:', history.value.length, 'entries');
    }
  }

  /**
   * Format duration in human-readable format
   */
  function formatDuration(ms: number): string {
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    } else if (ms < 3600000) {
      return `${Math.round(ms / 60000)}m`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.round((ms % 3600000) / 60000);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  /**
   * Format timestamp in human-readable format
   */
  function formatTimestamp(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      return `${Math.round(diff / 60000)} minutes ago`;
    } else if (diff < 86400000) {
      return `${Math.round(diff / 3600000)} hours ago`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  // Initialize by loading from storage
  loadFromStorage();

  return {
    // State
    history,
    recentDevices,

    // Computed
    totalConnections,
    totalConnectionTime,
    averageConnectionTime,
    recentHistory,
    topDevices,

    // Actions
    addConnection,
    endConnection,
    getDeviceHistory,
    getDeviceStats,
    clearHistory,
    clearDeviceHistory,
    formatDuration,
    formatTimestamp,
    loadFromStorage
  };
});
