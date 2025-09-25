// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import { type Ref, computed, ref } from 'vue';

export { useMediaRecorder };

function useMediaRecorder({ stream }: { stream: Ref<MediaStream | undefined> }): {
  isRecordingSupported: Ref<boolean>
  recordingState: Ref<'stopped' | 'recording' | 'paused'>
  startRecording: () => void
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  onRecordAvailable: (cb: (url: string) => void) => void
} {
  const isRecordingSupported = computed(() => MediaRecorder.isTypeSupported('video/webm'));
  const mediaRecorder = ref<MediaRecorder | null>(null);
  const recordedChunks = ref<Blob[]>([]);
  const recordAvailable = createEventHook();
  const recordingState = ref<'stopped' | 'recording' | 'paused'>('stopped');

  const createVideo = () => {
    const blob = new Blob(recordedChunks.value, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    recordedChunks.value = [];
    return url;
  };

  const startRecording = () => {
    if (!isRecordingSupported.value) {
      return;
    }
    if (!stream.value) {
      return;
    }
    if (recordingState.value !== 'stopped') {
      return;
    }

    mediaRecorder.value = new MediaRecorder(stream.value, { mimeType: 'video/webm' });

    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.value.push(e.data);
      }
    };

    mediaRecorder.value.onstop = () => {
      recordAvailable.trigger(createVideo());
    };

    if (mediaRecorder.value.state !== 'inactive') {
      return;
    }

    mediaRecorder.value.start();
    recordingState.value = 'recording';
  };

  const stopRecording = () => {
    if (!isRecordingSupported.value) {
      return;
    }
    if (!mediaRecorder.value) {
      return;
    }
    if (recordingState.value === 'stopped') {
      return;
    }

    mediaRecorder.value.stop();
    recordingState.value = 'stopped';
  };

  const pauseRecording = () => {
    if (!isRecordingSupported.value) {
      return;
    }
    if (!mediaRecorder.value) {
      return;
    }
    if (recordingState.value !== 'recording') {
      return;
    }

    mediaRecorder.value.pause();
    recordingState.value = 'paused';
  };

  const resumeRecording = () => {
    if (!isRecordingSupported.value) {
      return;
    }
    if (!mediaRecorder.value) {
      return;
    }

    if (recordingState.value !== 'paused') {
      return;
    }

    mediaRecorder.value.resume();
    recordingState.value = 'recording';
  };

  return {
    isRecordingSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordingState,

    onRecordAvailable: recordAvailable.on,
  };
}
