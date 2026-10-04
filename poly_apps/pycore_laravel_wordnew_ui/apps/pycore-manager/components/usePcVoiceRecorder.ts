/**
 * Terminal voice recorder over the shared CapAudioRecorder: the Capacitor app records with the native
 * microphone plugin, browsers with getUserMedia + MediaRecorder. Browsers expose the microphone only to
 * secure pages (https, localhost); a plain-http LAN page reports 'insecure'.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  base64ToBlob,
  capRecorder,
  type CapRecorderError,
  type CapRecordingClip,
} from '../../wordnew/platform/capabilities/CapAudioRecorder';

const MIME_EXTENSIONS: Array<[RegExp, string]> = [
  [/mp4|m4a/i, 'm4a'], [/aac/i, 'aac'], [/ogg/i, 'ogg'], [/webm/i, 'webm'], [/3gp/i, '3gp'], [/wav/i, 'wav'],
];
const TICK_MS = 500;

export type PcVoiceRecorderError = 'denied' | 'insecure' | 'failed';

export interface PcVoiceRecorder {
  available: boolean;
  recording: boolean;
  elapsedSeconds: number;
  error: PcVoiceRecorderError | null;
  start: () => Promise<void>;
  /** Stops and hands the recording to onRecorded. */
  stop: () => void;
}

export function canRecordInPage(): boolean {
  if (capRecorder.isNative()) return true;
  return typeof window !== 'undefined'
    && window.isSecureContext
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined';
}

function extensionOf(mime: string): string {
  return MIME_EXTENSIONS.find(([pattern]) => pattern.test(mime))?.[1] ?? 'webm';
}

function clipFile(clip: CapRecordingClip): File {
  const type = clip.mimeType.split(';')[0] || 'audio/webm';
  const stamp = new Date(clip.timestamp).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const blob = clip.blob ?? base64ToBlob(clip.base64, type);
  return new File([blob], `voice-${stamp}.${extensionOf(type)}`, { type });
}

function recorderError(cause: unknown): PcVoiceRecorderError {
  const code = (cause as CapRecorderError | null)?.code;
  if (code === 'permission-denied') return 'denied';
  if (code === 'unsupported') return 'insecure';
  return 'failed';
}

export function usePcVoiceRecorder(onRecorded: (file: File) => void): PcVoiceRecorder {
  const [recording, setRecording] = useState(() => capRecorder.isRecording());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<PcVoiceRecorderError | null>(null);
  const aliveRef = useRef(true);
  const startingRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  // The recorder is a shared singleton: the UI follows its real state so a re-mounted composer still
  // shows (and can stop) a live recording. Leaving the composer discards the recording and frees the microphone.
  useEffect(() => {
    aliveRef.current = true;
    setRecording(capRecorder.isRecording());
    const unsubscribe = capRecorder.on('statechange', (state) => setRecording(state === 'recording' || state === 'paused'));
    return () => {
      aliveRef.current = false;
      unsubscribe();
      if (capRecorder.isRecording()) void capRecorder.cancel();
    };
  }, []);

  useEffect(() => {
    if (!recording) return undefined;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor(capRecorder.elapsedMs() / 1000)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [recording]);

  const start = useCallback(async () => {
    if (startingRef.current || capRecorder.isRecording()) return;
    setError(null);
    if (!canRecordInPage()) {
      setError('insecure');
      return;
    }
    startingRef.current = true;
    try {
      await capRecorder.start();
    } catch (cause) {
      if (aliveRef.current) setError(recorderError(cause));
      return;
    } finally {
      startingRef.current = false;
    }
    // The composer was left while the microphone prompt/start was pending: free the microphone.
    if (!aliveRef.current) void capRecorder.cancel();
  }, []);

  const stop = useCallback(() => {
    if (!capRecorder.isRecording()) return;
    setRecording(false);
    void capRecorder.stop().then(
      (clip) => {
        if (clip.size > 0) onRecordedRef.current(clipFile(clip));
      },
      () => {
        if (aliveRef.current) setError('failed');
      },
    );
  }, []);

  return { available: canRecordInPage(), recording, elapsedSeconds, error, start, stop };
}
