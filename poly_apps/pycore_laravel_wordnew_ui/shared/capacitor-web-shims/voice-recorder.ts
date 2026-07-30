/**
 * Web shim for @capacitor-community/voice-recorder.
 *
 * Backs the community VoiceRecorder plugin with the browser MediaRecorder +
 * getUserMedia APIs so audio recording works in the web build (where
 * `@capacitor-community/voice-recorder` is aliased to this file — see
 * vite.config.ts). Returns base64 audio exactly like the native plugin.
 *
 * NOTE: primarily provided for the wordnew mobile APP (native Capacitor build);
 * this browser fallback keeps the web shell working.
 */

import { blobToBase64 } from '../../core/utils/blob';

export type CurrentRecordingStatus = 'NONE' | 'RECORDING' | 'PAUSED';

export interface GenericResponse {
  value: boolean;
}

export interface CurrentRecordingStatusResponse {
  status: CurrentRecordingStatus;
}

export interface RecordingData {
  value: {
    recordDataBase64: string;
    msDuration: number;
    mimeType: string;
  };
}

interface WebState {
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  status: CurrentRecordingStatus;
  startedAt: number;
  pausedTotal: number;
  pausedAt: number;
  mimeType: string;
}

const state: WebState = {
  stream: null,
  recorder: null,
  chunks: [],
  status: 'NONE',
  startedAt: 0,
  pausedTotal: 0,
  pausedAt: 0,
  mimeType: 'audio/webm',
};

function pickMime(): string {
  const MR: any = (typeof window !== 'undefined' && (window as any).MediaRecorder) || null;
  if (!MR || typeof MR.isTypeSupported !== 'function') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac'];
  for (const c of candidates) if (MR.isTypeSupported(c)) return c;
  return '';
}

function elapsedMs(): number {
  if (state.status === 'NONE') return 0;
  const now = Date.now();
  const base = now - state.startedAt - state.pausedTotal;
  const live = state.status === 'PAUSED' ? base - (now - state.pausedAt) : base;
  return Math.max(0, live);
}

function teardown(): void {
  try {
    state.stream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  state.stream = null;
  state.recorder = null;
}

export const VoiceRecorder = {
  async canDeviceVoiceRecord(): Promise<GenericResponse> {
    const ok =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof (window as any)?.MediaRecorder !== 'undefined';
    return { value: !!ok };
  },

  async hasAudioRecordingPermission(): Promise<GenericResponse> {
    try {
      const perm = (navigator as any)?.permissions;
      if (perm?.query) {
        const res = await perm.query({ name: 'microphone' as PermissionName });
        return { value: res.state === 'granted' };
      }
    } catch {
      /* fall through */
    }
    return { value: false };
  },

  async requestAudioRecordingPermission(): Promise<GenericResponse> {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
      return { value: true };
    } catch {
      return { value: false };
    }
  },

  async startRecording(): Promise<GenericResponse> {
    if (state.status !== 'NONE') throw new Error('ALREADY_RECORDING');
    const MR: any = (window as any).MediaRecorder;
    if (!MR) throw new Error('MISSING_PERMISSION');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMime();
    const recorder = mimeType ? new MR(stream, { mimeType }) : new MR(stream);
    state.stream = stream;
    state.recorder = recorder;
    state.chunks = [];
    state.mimeType = recorder.mimeType || mimeType || 'audio/webm';
    state.startedAt = Date.now();
    state.pausedTotal = 0;
    state.pausedAt = 0;
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) state.chunks.push(e.data);
    };
    recorder.start(250);
    state.status = 'RECORDING';
    return { value: true };
  },

  async stopRecording(): Promise<RecordingData> {
    const recorder = state.recorder;
    if (!recorder || state.status === 'NONE') throw new Error('RECORDING_HAS_NOT_STARTED');
    const ms = elapsedMs();
    const mimeType = state.mimeType;
    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(state.chunks, { type: mimeType }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(state.chunks, { type: mimeType }));
      }
    });
    teardown();
    state.status = 'NONE';
    const recordDataBase64 = await blobToBase64(blob);
    return { value: { recordDataBase64, msDuration: ms, mimeType } };
  },

  async pauseRecording(): Promise<GenericResponse> {
    if (state.status !== 'RECORDING' || !state.recorder) return { value: false };
    try {
      state.recorder.pause();
      state.pausedAt = Date.now();
      state.status = 'PAUSED';
      return { value: true };
    } catch {
      return { value: false };
    }
  },

  async resumeRecording(): Promise<GenericResponse> {
    if (state.status !== 'PAUSED' || !state.recorder) return { value: false };
    try {
      state.recorder.resume();
      state.pausedTotal += Date.now() - state.pausedAt;
      state.pausedAt = 0;
      state.status = 'RECORDING';
      return { value: true };
    } catch {
      return { value: false };
    }
  },

  async getCurrentStatus(): Promise<CurrentRecordingStatusResponse> {
    return { status: state.status };
  },
};

export default { VoiceRecorder };
