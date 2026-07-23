import { usePersistedRef } from '@/composables/usePersistedRef';
import {
  DEFAULT_QWEN_TTS_SETTINGS,
  QWEN_TTS_SETTING_KEYS,
  type QwenTtsMode,
} from '@/utils/qwen-tts-core';

export function useQwenTtsSettings() {
  const mode = usePersistedRef<QwenTtsMode>(
    QWEN_TTS_SETTING_KEYS.MODE,
    DEFAULT_QWEN_TTS_SETTINGS.mode,
  );
  const voiceDescription = usePersistedRef(
    QWEN_TTS_SETTING_KEYS.VOICE_DESCRIPTION,
    DEFAULT_QWEN_TTS_SETTINGS.voiceDescription,
  );
  const styleInstruction = usePersistedRef(
    QWEN_TTS_SETTING_KEYS.STYLE_INSTRUCTION,
    DEFAULT_QWEN_TTS_SETTINGS.styleInstruction,
  );
  const waitTimeoutSec = usePersistedRef(
    QWEN_TTS_SETTING_KEYS.WAIT_TIMEOUT_SEC,
    DEFAULT_QWEN_TTS_SETTINGS.waitTimeoutSec,
  );
  const openInNewTab = usePersistedRef(
    QWEN_TTS_SETTING_KEYS.OPEN_IN_NEW_TAB,
    DEFAULT_QWEN_TTS_SETTINGS.openInNewTab,
  );
  const autoDownload = usePersistedRef(
    QWEN_TTS_SETTING_KEYS.AUTO_DOWNLOAD,
    DEFAULT_QWEN_TTS_SETTINGS.autoDownload,
  );

  return {
    mode,
    voiceDescription,
    styleInstruction,
    waitTimeoutSec,
    openInNewTab,
    autoDownload,
  };
}
