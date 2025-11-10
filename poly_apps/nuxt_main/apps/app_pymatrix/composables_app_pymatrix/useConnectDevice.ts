import { ref } from 'vue';
import { useDeviceStore } from '../stores_app_pymatrix/deviceStore';
import { pyMatrixDeviceAPI } from '@/services/api/pymatrix/pymatrix-device-api';
import type { Device, DeviceConfig } from '@/types/pymatrix';

export interface ConnectPayload {
  serial: string;
  deviceName?: string;
  config: DeviceConfig;
}

export function useConnectDevice() {
  const deviceStore = useDeviceStore();
  const connecting = ref(false);
  const error = ref<string | null>(null);

  async function connect(payload: ConnectPayload, afterConnect?: () => Promise<void> | void) {
    connecting.value = true;
    error.value = null;
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const response = await pyMatrixDeviceAPI.connectDevice(payload.serial, {
        deviceName: payload.deviceName,
        maxSize: payload.config.max_size,
        bitRate: payload.config.bit_rate,
        maxFps: payload.config.max_fps,
        codec: payload.config.codec,
        control: payload.config.control,
        lockedVideoOrientation: payload.config.locked_video_orientation,
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to connect device');
      }

      const info = await pyMatrixDeviceAPI.getDeviceInfo(payload.serial);
      const device: Device = {
        serial: payload.serial,
        name: info.device?.name || payload.deviceName || payload.serial,
        model: info.device?.model || payload.deviceName || payload.serial,
        state: 'connected',
        resolution: info.device?.resolution || { width: 0, height: 0 },
        streaming: true,
        controllable: true,
      };

      deviceStore.addDevice(device);
      if (afterConnect) {
        await afterConnect();
      }
      error.value = err instanceof Error ? err.message : String(err);
      throw err;
    connecting.value = false;
  }

  return {
    connect,
    connecting,
    error,
  };
}
