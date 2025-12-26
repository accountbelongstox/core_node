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
      const result = await pyMatrixConfigAPI.getConfig().then(
        (response) => ({ status: 'success' as const, response }),
        (error) => ({ status: 'error' as const, error })
      );

      if (result.status === 'error') {
        this.error = result.error instanceof Error ? result.error.message : 'Failed to load configuration';
        this.loading = false;
        return;
      }

      this.global = result.response.config.global;
      this.devices = result.response.config.devices || {};
      this.loading = false;
    },

    async saveGlobal(payload: Partial<DeviceConfig>) {
      this.loading = true;
      this.error = null;
      const result = await pyMatrixConfigAPI.updateGlobal(payload).then(
        (response) => ({ status: 'success' as const, response }),
        (error) => ({ status: 'error' as const, error })
      );

      if (result.status === 'error') {
        this.error = result.error instanceof Error ? result.error.message : 'Failed to save global configuration';
        this.loading = false;
        return;
      }

      this.global = result.response;
      this.loading = false;
    },

    async saveDevice(deviceName: string, payload: Partial<DeviceConfig>) {
      this.loading = true;
      this.error = null;
      const result = await pyMatrixConfigAPI.updateDevice(deviceName, payload).then(
        (response) => ({ status: 'success' as const, response }),
        (error) => ({ status: 'error' as const, error })
      );

      if (result.status === 'error') {
        this.error = result.error instanceof Error ? result.error.message : 'Failed to save device configuration';
        this.loading = false;
        return;
      }

      const existingKey =
        Object.keys(this.devices).find((key) => key.toLowerCase() === deviceName.toLowerCase()) || deviceName;
      this.devices = {
        ...this.devices,
        [existingKey]: result.response
      };
      this.loading = false;
    },

    async removeDevice(deviceName: string) {
      this.loading = true;
      this.error = null;
      const result = await pyMatrixConfigAPI.deleteDevice(deviceName).then(
        () => ({ status: 'success' as const }),
        (error) => ({ status: 'error' as const, error })
      );

      if (result.status === 'error') {
        this.error = result.error instanceof Error ? result.error.message : 'Failed to delete device configuration';
        this.loading = false;
        return;
      }

      const next = { ...this.devices };
      const existingKey =
        Object.keys(next).find((key) => key.toLowerCase() === deviceName.toLowerCase()) || deviceName;
      delete next[existingKey];
      this.devices = next;
      this.loading = false;
    },
  },
});
