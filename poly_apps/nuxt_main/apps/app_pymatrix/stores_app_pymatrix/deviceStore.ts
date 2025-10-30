import { defineStore } from 'pinia';
import type { Device } from '~/types/pymatrix';

interface DeviceState {
  devices: Map<string, Device>;
  selectedSerial: string | null;
}

export const useDeviceStore = defineStore('pymatrix-device', {
  state: (): DeviceState => ({
    devices: new Map(),
    selectedSerial: null
  }),

  getters: {
    deviceList: (state) => Array.from(state.devices.values()),

    selectedDevice: (state) => {
      return state.selectedSerial ? state.devices.get(state.selectedSerial) : null;
    },

    connectedDevices: (state) => {
      return Array.from(state.devices.values()).filter(d => d.state === 'connected');
    },

    deviceCount: (state) => state.devices.size
  },

  actions: {
    addDevice(device: Device) {
      this.devices.set(device.serial, device);
    },

    removeDevice(serial: string) {
      this.devices.delete(serial);
      if (this.selectedSerial === serial) {
        this.selectedSerial = null;
      }
    },

    updateDevice(serial: string, updates: Partial<Device>) {
      const device = this.devices.get(serial);
      if (device) {
        Object.assign(device, updates);
        this.devices.set(serial, device);
      }
    },

    setDeviceState(serial: string, state: Device['state']) {
      this.updateDevice(serial, { state });
    },

    setDeviceStreaming(serial: string, streaming: boolean) {
      this.updateDevice(serial, { streaming });
    },

    setDeviceControllable(serial: string, controllable: boolean) {
      this.updateDevice(serial, { controllable });
    },

    selectDevice(serial: string | null) {
      this.selectedSerial = serial;
    },

    clearDevices() {
      this.devices.clear();
      this.selectedSerial = null;
    },

    getDevice(serial: string): Device | undefined {
      return this.devices.get(serial);
    },

    hasDevice(serial: string): boolean {
      return this.devices.has(serial);
    }
  }
});
