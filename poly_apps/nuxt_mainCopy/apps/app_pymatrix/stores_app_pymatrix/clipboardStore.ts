import { defineStore } from 'pinia';
import type { ClipboardSyncState, ClipboardData } from '@/types/pymatrix';

interface ClipboardStoreState {
  syncStates: Map<string, ClipboardSyncState>;
  globalAutoSync: boolean;
}

export const useClipboardStore = defineStore('pymatrix-clipboard', {
  state: (): ClipboardStoreState => ({
    syncStates: new Map(),
    globalAutoSync: false
  }),

  getters: {
    isSyncEnabled: (state) => (deviceSerial: string) => {
      return state.syncStates.get(deviceSerial)?.enabled ?? false;
    },

    getSyncState: (state) => (deviceSerial: string) => {
      return state.syncStates.get(deviceSerial);
    },

    getLastSync: (state) => (deviceSerial: string) => {
      return state.syncStates.get(deviceSerial)?.lastSync;
    },

    isAutoSyncEnabled: (state) => (deviceSerial: string) => {
      return state.syncStates.get(deviceSerial)?.autoSync ?? false;
    },

    activeSyncCount: (state) => {
      let count = 0;
      for (const syncState of state.syncStates.values()) {
        if (syncState.enabled) {
          count++;
        }
      }
      return count;
    },

    allSyncStates: (state) => {
      return Array.from(state.syncStates.values());
    }
  },

  actions: {
    initSync(deviceSerial: string, autoSync: boolean = false) {
      const syncState: ClipboardSyncState = {
        deviceSerial,
        enabled: false,
        autoSync,
        lastSync: undefined
      };

      this.syncStates.set(deviceSerial, syncState);
    },

    enableSync(deviceSerial: string) {
      const syncState = this.syncStates.get(deviceSerial);
      if (!syncState) {
        this.initSync(deviceSerial);
      }

      const state = this.syncStates.get(deviceSerial);
      if (state) {
        state.enabled = true;
        this.syncStates.set(deviceSerial, state);
      }
    },

    disableSync(deviceSerial: string) {
      const syncState = this.syncStates.get(deviceSerial);
      if (!syncState) return;

      syncState.enabled = false;
      this.syncStates.set(deviceSerial, syncState);
    },

    toggleSync(deviceSerial: string): boolean {
      const isEnabled = this.isSyncEnabled(deviceSerial);

      if (isEnabled) {
        this.disableSync(deviceSerial);
      } else {
        this.enableSync(deviceSerial);
      }

      return !isEnabled;
    },

    setAutoSync(deviceSerial: string, enabled: boolean) {
      const syncState = this.syncStates.get(deviceSerial);
      if (!syncState) {
        this.initSync(deviceSerial, enabled);
        return;
      }

      syncState.autoSync = enabled;
      this.syncStates.set(deviceSerial, syncState);

      // Enable sync when auto-sync is enabled
      if (enabled && !syncState.enabled) {
        this.enableSync(deviceSerial);
      }
    },

    updateLastSync(deviceSerial: string, clipboardData: ClipboardData) {
      const syncState = this.syncStates.get(deviceSerial);
      if (!syncState) return;

      syncState.lastSync = clipboardData;
      this.syncStates.set(deviceSerial, syncState);
    },

    recordSync(deviceSerial: string, text: string, source: 'device' | 'pc') {
      const clipboardData: ClipboardData = {
        text,
        timestamp: Date.now(),
        source
      };

      this.updateLastSync(deviceSerial, clipboardData);
    },

    updateSyncState(deviceSerial: string, updates: Partial<ClipboardSyncState>) {
      const syncState = this.syncStates.get(deviceSerial);
      if (!syncState) return;

      const updatedState = { ...syncState, ...updates };
      this.syncStates.set(deviceSerial, updatedState);
    },

    clearSync(deviceSerial: string) {
      this.syncStates.delete(deviceSerial);
    },

    clearAllSyncs() {
      this.syncStates.clear();
      this.globalAutoSync = false;
    },

    setGlobalAutoSync(enabled: boolean) {
      this.globalAutoSync = enabled;

      // Apply to all devices
      for (const [deviceSerial, syncState] of this.syncStates.entries()) {
        syncState.autoSync = enabled;
        if (enabled && !syncState.enabled) {
          syncState.enabled = true;
        }
        this.syncStates.set(deviceSerial, syncState);
      }
    }
  }
});
