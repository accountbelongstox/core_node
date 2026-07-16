/**
 * Qwen3-TTS popup composable.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { logger } from '@/utils/logger';
import { sendWithWake } from '@/utils/sendWithWake';
import {
  DEFAULT_QWEN_TTS_TEXT,
  DEFAULT_QWEN_VOICE_DESCRIPTION,
  QWEN_TTS_LAST_VERIFIED,
  type QwenTtsMode,
  type QwenTtsProgress,
  type QwenTtsResult,
  emptyQwenTtsProgress,
} from '@/utils/qwen-tts-core';

const LOG = 'Qwen TTS UI';

type QwenTtsResponse<T> = T & { success?: boolean; error?: string };

const sendQwen = <T>(payload: Record<string, unknown>): Promise<QwenTtsResponse<T>> =>
  sendWithWake(() => chrome.runtime.sendMessage(payload), LOG);

export function useQwenTts() {
  const text = usePersistedRef('qwenTtsText', DEFAULT_QWEN_TTS_TEXT);
  const mode = usePersistedRef<QwenTtsMode>('qwenTtsMode', 'voice_design');
  const voiceDescription = usePersistedRef('qwenTtsVoiceDescription', DEFAULT_QWEN_VOICE_DESCRIPTION);
  const styleInstruction = usePersistedRef('qwenTtsStyleInstruction', '');
  const waitTimeoutSec = usePersistedRef('qwenTtsWaitTimeoutSec', 180);
  const openInNewTab = usePersistedRef('qwenTtsOpenInNewTab', false);
  const autoDownload = usePersistedRef('qwenTtsAutoDownload', true);

  const loading = ref(false);
  const error = ref('');
  const result = ref<QwenTtsResult | null>(null);
  const progress = ref<QwenTtsProgress>(emptyQwenTtsProgress());

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const refreshProgress = async () => {
    const res = await sendQwen<{ progress?: QwenTtsProgress }>({
      type: 'qwen_tts',
      action: 'get_status',
    });
    if (res?.progress) {
      progress.value = { ...emptyQwenTtsProgress(), ...res.progress };
    }
  };

  const generate = async () => {
    loading.value = true;
    error.value = '';
    result.value = null;
    try {
      const res = await sendQwen<{ result?: QwenTtsResult }>({
        type: 'qwen_tts',
        action: 'generate',
        request: {
          text: text.value.trim(),
          mode: mode.value,
          voiceDescription: voiceDescription.value.trim(),
          styleInstruction: styleInstruction.value.trim(),
          waitTimeoutMs: Math.max(30, waitTimeoutSec.value) * 1000,
          openInNewTab: openInNewTab.value,
          download: autoDownload.value,
        },
      });
      if (!res) {
        error.value = 'No response from extension background — reload the extension and retry';
        return;
      }
      result.value = res?.result || null;
      if (!res?.success || !result.value?.ok) {
        error.value = res?.error || result.value?.error || result.value?.message || 'Qwen TTS failed';
      } else {
        logger.info(LOG, `Generated ${result.value.downloadFilename || 'audio'} in ${result.value.elapsedMs}ms`);
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Qwen TTS failed';
      logger.error(LOG, error.value, e);
    } finally {
      loading.value = false;
      await refreshProgress();
    }
  };

  const downloadLocal = () => {
    const audio = result.value?.audio;
    if (!audio?.bytes?.length) return;
    const mime = audio.mime || 'audio/wav';
    const ext = mime.includes('mpeg') || mime.includes('mp3') ? 'mp3' : 'wav';
    const blob = new Blob([new Uint8Array(audio.bytes)], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.value?.downloadFilename || `qwen3-tts.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  onMounted(() => {
    void refreshProgress();
    pollTimer = setInterval(() => {
      if (loading.value || progress.value.running) void refreshProgress();
    }, 1500);
  });

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
  });

  return {
    text,
    mode,
    voiceDescription,
    styleInstruction,
    waitTimeoutSec,
    openInNewTab,
    autoDownload,
    loading,
    error,
    result,
    progress,
    lastVerified: QWEN_TTS_LAST_VERIFIED,
    generate,
    downloadLocal,
  };
}
