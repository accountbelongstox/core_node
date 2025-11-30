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

    const connectionResult = await pyMatrixDeviceAPI.connectDevice(payload.serial, {
      deviceName: payload.deviceName,
      maxSize: payload.config.max_size,
      bitRate: payload.config.bit_rate,
      maxFps: payload.config.max_fps,
      codec: payload.config.codec,
      control: payload.config.control,
      lockedVideoOrientation: payload.config.locked_video_orientation
    }).then(
      (response) => ({ status: 'success' as const, response }),
      (err) => ({ status: 'error' as const, error: err })
    );

    if (connectionResult.status === 'error') {
      const message = connectionResult.error instanceof Error
        ? connectionResult.error.message
        : 'Failed to connect device';
      error.value = message;
      connecting.value = false;
      return Promise.reject(new Error(message));
    }

    if (!connectionResult.response.success) {
      const message = connectionResult.response.message || 'Failed to connect device';
      error.value = message;
      connecting.value = false;
      return Promise.reject(new Error(message));
    }

    const infoResult = await pyMatrixDeviceAPI.getDeviceInfo(payload.serial).then(
      (info) => ({ status: 'success' as const, info }),
      (err) => ({ status: 'error' as const, error: err })
    );

    const fallbackDevice: Device = {
      serial: payload.serial,
      name: payload.deviceName || payload.serial,
      model: payload.deviceName || payload.serial,
      state: 'connected',
      resolution: { width: 0, height: 0 },
      streaming: true,
      controllable: true
    };

    const device: Device = infoResult.status === 'success' && infoResult.info.device
      ? infoResult.info.device
      : fallbackDevice;

    deviceStore.addDevice(device);

    if (afterConnect) {
      await afterConnect();
    }

    connecting.value = false;
  }

  return {
    connect,
    connecting,
    error,
  };
}
