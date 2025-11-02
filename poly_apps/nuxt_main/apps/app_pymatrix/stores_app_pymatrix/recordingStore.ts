import { defineStore } from 'pinia';
import type { RecordingState, RecordingFormat, RecordingMode } from '../../../types/pymatrix';

interface RecordingStoreState {
  recordings: Map<string, RecordingState>;
  globalRecording: boolean;
}

export const useRecordingStore = defineStore('pymatrix-recording', {
  state: (): RecordingStoreState => ({
    recordings: new Map(),
    globalRecording: false
  }),

  getters: {
    isRecording: (state) => (deviceSerial: string) => {
      return state.recordings.get(deviceSerial)?.isRecording ?? false;
    },

    getRecordingState: (state) => (deviceSerial: string) => {
      return state.recordings.get(deviceSerial);
    },

    getRecordingDuration: (state) => (deviceSerial: string) => {
      const recording = state.recordings.get(deviceSerial);
      if (!recording || !recording.isRecording || !recording.startTime) {
        return 0;
      }
      return Math.floor((Date.now() - recording.startTime) / 1000);
    },

    activeRecordingsCount: (state) => {
      let count;
      count = 0;
      for (const recording of state.recordings.values()) {
        if (recording.isRecording) {
          count++;
        }
      }
      return count;
    },

    allRecordings: (state) => {
      return Array.from(state.recordings.values());
    }
  },

  actions: {
    startRecording(
      deviceSerial: string,
      format: RecordingFormat = 'mp4',
      mode: RecordingMode = 'normal'
    ) {
      const recordingState: RecordingState = {
        deviceSerial,
        isRecording: true,
        format,
        mode,
        startTime: Date.now()
      };

      this.recordings.set(deviceSerial, recordingState);

      if (this.activeRecordingsCount > 0) {
        this.globalRecording = true;
      }
    },

    stopRecording(deviceSerial: string, filePath?: string, fileSize?: number) {
      const recording = this.recordings.get(deviceSerial);
      if (!recording) return;

      recording.isRecording = false;
      recording.duration = this.getRecordingDuration(deviceSerial);
      recording.filePath = filePath;
      recording.fileSize = fileSize;

      this.recordings.set(deviceSerial, recording);

      if (this.activeRecordingsCount === 0) {
        this.globalRecording = false;
      }
    },

    updateRecording(deviceSerial: string, updates: Partial<RecordingState>) {
      const recording = this.recordings.get(deviceSerial);
      if (!recording) return;

      const updatedRecording = { ...recording, ...updates };
      this.recordings.set(deviceSerial, updatedRecording);
    },

    clearRecording(deviceSerial: string) {
      this.recordings.delete(deviceSerial);

      if (this.activeRecordingsCount === 0) {
        this.globalRecording = false;
      }
    },

    clearAllRecordings() {
      this.recordings.clear();
      this.globalRecording = false;
    },

    toggleRecording(
      deviceSerial: string,
      format: RecordingFormat = 'mp4',
      mode: RecordingMode = 'normal'
    ) {
      const isCurrentlyRecording = this.isRecording(deviceSerial);

      if (isCurrentlyRecording) {
        this.stopRecording(deviceSerial);
      } else {
        this.startRecording(deviceSerial, format, mode);
      }

      return !isCurrentlyRecording;
    }
  }
});
