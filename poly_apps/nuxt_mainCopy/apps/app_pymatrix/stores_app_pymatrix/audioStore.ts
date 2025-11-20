import { defineStore } from 'pinia';
import type { AudioStreamStatus, AudioInstallProgress, AudioStreamMetadata } from '@/types/pymatrix';

interface AudioState {
  audioStreams: Map<string, AudioStreamStatus>;
  installProgress: Map<string, AudioInstallProgress>;
  metadata: Map<string, AudioStreamMetadata>;
}

export const useAudioStore = defineStore('audio', {
  state: (): AudioState => ({
    audioStreams: new Map(),
    installProgress: new Map(),
    metadata: new Map(),
  }),

  getters: {
    getAudioStatus: (state) => (deviceSerial: string): AudioStreamStatus | undefined => {
      return state.audioStreams.get(deviceSerial);
    },

    isInstalled: (state) => (deviceSerial: string): boolean => {
      const status = state.audioStreams.get(deviceSerial);
      return status?.isInstalled ?? false;
    },

    isStreaming: (state) => (deviceSerial: string): boolean => {
      const status = state.audioStreams.get(deviceSerial);
      return status?.isStreaming ?? false;
    },

    getInstallProgress: (state) => (deviceSerial: string): AudioInstallProgress | undefined => {
      return state.installProgress.get(deviceSerial);
    },

    getMetadata: (state) => (deviceSerial: string): AudioStreamMetadata | undefined => {
      return state.metadata.get(deviceSerial);
    },

    getAllStreamingDevices: (state): string[] => {
      const devices: string[] = [];
      state.audioStreams.forEach((status, serial) => {
        if (status.isStreaming) {
          devices.push(serial);
        }
      });
      return devices;
    },

    getStreamDuration: (state) => (deviceSerial: string): number => {
      const status = state.audioStreams.get(deviceSerial);
      if (!status?.isStreaming || !status.startTime) {
        return 0;
      }
      return Date.now() - status.startTime;
    },
  },

  actions: {
    setAudioStatus(deviceSerial: string, status: Partial<AudioStreamStatus>) {
      const existing = this.audioStreams.get(deviceSerial);
      const newStatus: AudioStreamStatus = {
        deviceSerial,
        state: 'idle',
        isInstalled: false,
        isStreaming: false,
        ...existing,
        ...status,
      };
      this.audioStreams.set(deviceSerial, newStatus);
    },

    setInstallProgress(deviceSerial: string, progress: AudioInstallProgress) {
      this.installProgress.set(deviceSerial, progress);
    },

    setMetadata(deviceSerial: string, metadata: AudioStreamMetadata) {
      this.metadata.set(deviceSerial, metadata);
    },

    startStreaming(deviceSerial: string) {
      this.setAudioStatus(deviceSerial, {
        state: 'streaming',
        isStreaming: true,
        startTime: Date.now(),
        error: undefined,
      });
    },

    stopStreaming(deviceSerial: string) {
      const status = this.audioStreams.get(deviceSerial);
      if (status) {
        const duration = status.startTime ? Date.now() - status.startTime : 0;
        this.setAudioStatus(deviceSerial, {
          state: 'idle',
          isStreaming: false,
          duration,
          startTime: undefined,
        });
      }
    },

    setError(deviceSerial: string, error: string) {
      this.setAudioStatus(deviceSerial, {
        state: 'error',
        isStreaming: false,
        error,
      });
    },

    markInstalled(deviceSerial: string) {
      this.setAudioStatus(deviceSerial, {
        isInstalled: true,
        state: 'idle',
      });
    },

    clearError(deviceSerial: string) {
      this.setAudioStatus(deviceSerial, {
        error: undefined,
      });
    },

    removeDevice(deviceSerial: string) {
      this.audioStreams.delete(deviceSerial);
      this.installProgress.delete(deviceSerial);
      this.metadata.delete(deviceSerial);
    },

    clearAll() {
      this.audioStreams.clear();
      this.installProgress.clear();
      this.metadata.clear();
    },
  },
});
