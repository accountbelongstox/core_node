import { defineStore } from 'pinia';
import { pyMatrixConfigAPI } from '@/services/api/pymatrix/pymatrix-config-api';
import type { DeviceConfig } from '@/types/pymatrix';

interface ConfigState {
  global: DeviceConfig | null;
  devices: Record<string, DeviceConfig>;
  loading: boolean;
  error: string | null;
}

const DEFAULT_CODEC: DeviceConfig['codec'] = 'h264';

export const useConfigStore = defineStore('pymatrix-config', {
  state: (): ConfigState => ({
    global: null,
    devices: {},
    loading: false,
    error: null,
  }),

  getters: {
    isLoaded: (state) => state.global !== null,

    globalConfig: (state): DeviceConfig => {
      if (state.global) {
        return state.global;
      }
      return {
        max_size: 720,
        bit_rate: 8000000,
        max_fps: 60,
        codec: DEFAULT_CODEC,
        control: true,
        locked_video_orientation: -1,
      };
    },

    deviceConfigs: (state): Record<string, DeviceConfig> => state.devices,

    getDeviceConfig:
      (state) =>
      (name: string): DeviceConfig | undefined =>
        state.devices[name] ||
        Object.entries(state.devices).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1],

    getEffectiveConfig() {
      return (deviceName?: string, overrides?: Partial<DeviceConfig>): DeviceConfig => {
        const baseConfig = { ...this.globalConfig };
        if (deviceName) {
          const deviceConfig = this.getDeviceConfig(deviceName);
          if (deviceConfig) {
            Object.assign(baseConfig, deviceConfig);
          }
        }
        if (overrides) {
          Object.assign(baseConfig, overrides);
        }
        return baseConfig;
      };
    },
  },

  actions: {
    async fetchConfig() {
      this.loading = true;
      this.error = null;
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const response = await pyMatrixConfigAPI.getConfig();
        this.global = response.config.global;
        this.devices = response.config.devices || {};
        this.error = error instanceof Error ? error.message : 'Failed to load configuration';
        throw error;
      this.loading = false;
    },

    async saveGlobal(payload: Partial<DeviceConfig>) {
      this.loading = true;
      this.error = null;
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const updated = await pyMatrixConfigAPI.updateGlobal(payload);
        this.global = updated;
        this.error = error instanceof Error ? error.message : 'Failed to save global configuration';
        throw error;
      this.loading = false;
    },

    async saveDevice(deviceName: string, payload: Partial<DeviceConfig>) {
      this.loading = true;
      this.error = null;
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        const updated = await pyMatrixConfigAPI.updateDevice(deviceName, payload);
        const existingKey =
          Object.keys(this.devices).find((key) => key.toLowerCase() === deviceName.toLowerCase()) || deviceName;
        this.devices = {
          ...this.devices,
          [existingKey]: updated,
        };
        this.error = error instanceof Error ? error.message : 'Failed to save device configuration';
        throw error;
      this.loading = false;
    },

    async removeDevice(deviceName: string) {
      this.loading = true;
      this.error = null;
      // ✅ REMOVED try-catch for debugging - let errors surface naturally
        await pyMatrixConfigAPI.deleteDevice(deviceName);
        const next = { ...this.devices };
        const existingKey =
          Object.keys(next).find((key) => key.toLowerCase() === deviceName.toLowerCase()) || deviceName;
        delete next[existingKey];
        this.devices = next;
        this.error = error instanceof Error ? error.message : 'Failed to delete device configuration';
        throw error;
      this.loading = false;
    },
  },
});
