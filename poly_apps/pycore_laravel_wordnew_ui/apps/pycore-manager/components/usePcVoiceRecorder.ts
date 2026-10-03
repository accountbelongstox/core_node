/**
 * In-page voice recorder (MediaRecorder). Browsers expose the microphone only to secure pages:
 * the Capacitor app (https scheme), https and localhost. A plain-http LAN page records through
 * the system recorder app instead (file input with `capture`), see PcTerminalInputBox.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
const MIME_EXTENSIONS: Array<[RegExp, string]> = [[/mp4/i, 'm4a'], [/ogg/i, 'ogg'], [/webm/i, 'webm']];
const TICK_MS = 500;

export type PcVoiceRecorderError = 'denied' | 'failed';

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
  return typeof window !== 'undefined'
    && window.isSecureContext
    && Boolean(navigator.mediaDevices?.getUserMedia)
    && typeof MediaRecorder !== 'undefined';
}

function recorderMimeType(): string {
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function extensionOf(mime: string): string {
  return MIME_EXTENSIONS.find(([pattern]) => pattern.test(mime))?.[1] ?? 'webm';
}

export function usePcVoiceRecorder(onRecorded: (file: File) => void): PcVoiceRecorder {
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<PcVoiceRecorderError | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }, []);

  // Leaving the composer while recording discards the recording and frees the microphone.
  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!recording) return undefined;
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [recording]);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause: any) {
      setError(cause?.name === 'NotAllowedError' || cause?.name === 'SecurityError' ? 'denied' : 'failed');
      return;
    }
    const mimeType = recorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || 'audio/webm';
      release();
      if (!chunks.length) return;
      const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      onRecordedRef.current(new File(chunks, `voice-${stamp}.${extensionOf(type)}`, { type: type.split(';')[0] }));
    };
    recorder.onerror = () => {
      setError('failed');
      release();
    };
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }, [release]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  return { available: canRecordInPage(), recording, elapsedSeconds, error, start, stop };
}
