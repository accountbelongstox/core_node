import { ref, computed, onUnmounted } from 'vue';
import { buildApiUrl } from '@/apps/app_pymatrix/utils_app_pymatrix/api-urls';
import { useAudioStore } from '@/apps/app_pymatrix/stores_app_pymatrix/audioStore';
import type { AudioStreamStatus } from '@/types/pymatrix';

interface UseAudioStreamOptions {
  deviceSerial: string;
}

export function useAudioStream(options: UseAudioStreamOptions) {
  const audioStore = useAudioStore();
  const installing = ref(false);
  const starting = ref(false);
  const stopping = ref(false);

  const status = computed<AudioStreamStatus | undefined>(() =>
    audioStore.getAudioStatus(options.deviceSerial)
  );

  const isInstalled = computed(() =>
    audioStore.isInstalled(options.deviceSerial)
  );

  const isStreaming = computed(() =>
    audioStore.isStreaming(options.deviceSerial)
  );

  const installProgress = computed(() =>
    audioStore.getInstallProgress(options.deviceSerial)
  );

  const metadata = computed(() =>
    audioStore.getMetadata(options.deviceSerial)
  );

  const streamDuration = computed(() =>
    audioStore.getStreamDuration(options.deviceSerial)
  );

  async function installSndcpy(): Promise<boolean> {
    if (installing.value) {
      return false;
    }

    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      installing.value = true;
      audioStore.setAudioStatus(options.deviceSerial, { state: 'installing' });

      const url = buildApiUrl(`/audio/install/${options.deviceSerial}`);
      const response = await $fetch<{ success: boolean; message?: string }>(url, {
        method: 'POST',
      });

      if (response.success) {
        audioStore.markInstalled(options.deviceSerial);
        return true;
      } else {
        audioStore.setError(options.deviceSerial, response.message || 'Installation failed');
        return false;
      }
      console.error('Failed to install sndcpy:', error);
      audioStore.setError(
        options.deviceSerial,
        error?.message || 'Failed to install sndcpy'
      );
      return false;
    installing.value = false;
  }

  async function startStreaming(): Promise<boolean> {
    if (starting.value || isStreaming.value) {
      return false;
    }

    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      starting.value = true;
      audioStore.setAudioStatus(options.deviceSerial, { state: 'starting' });

      const url = buildApiUrl(`/audio/start/${options.deviceSerial}`);
      const response = await $fetch<{ success: boolean; message?: string }>(url, {
        method: 'POST',
      });

      if (response.success) {
        audioStore.startStreaming(options.deviceSerial);
        return true;
      } else {
        audioStore.setError(options.deviceSerial, response.message || 'Failed to start audio streaming');
        return false;
      }
      console.error('Failed to start audio streaming:', error);
      audioStore.setError(
        options.deviceSerial,
        error?.message || 'Failed to start audio streaming'
      );
      return false;
    starting.value = false;
  }

  async function stopStreaming(): Promise<boolean> {
    if (stopping.value || !isStreaming.value) {
      return false;
    }

    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      stopping.value = true;
      audioStore.setAudioStatus(options.deviceSerial, { state: 'stopping' });

      const url = buildApiUrl(`/audio/stop/${options.deviceSerial}`);
      const response = await $fetch<{ success: boolean; message?: string }>(url, {
        method: 'POST',
      });

      if (response.success) {
        audioStore.stopStreaming(options.deviceSerial);
        return true;
      } else {
        audioStore.setError(options.deviceSerial, response.message || 'Failed to stop audio streaming');
        return false;
      }
      console.error('Failed to stop audio streaming:', error);
      audioStore.setError(
        options.deviceSerial,
        error?.message || 'Failed to stop audio streaming'
      );
      return false;
    stopping.value = false;
  }

  async function checkInstallStatus(): Promise<boolean> {
    // ✅ REMOVED try-catch for debugging - let errors surface naturally
      const url = buildApiUrl(`/audio/status/${options.deviceSerial}`);
      const response = await $fetch<{
        success: boolean;
        installed: boolean;
        streaming: boolean;
      }>(url, {
        method: 'GET',
      });

      if (response.success) {
        audioStore.setAudioStatus(options.deviceSerial, {
          isInstalled: response.installed,
          isStreaming: response.streaming,
        });
        return response.installed;
      }
      return false;
      console.error('Failed to check audio status:', error);
      return false;
    }
  }

  function clearError() {
    audioStore.clearError(options.deviceSerial);
  }

  onUnmounted(() => {
    if (isStreaming.value) {
      stopStreaming();
    }
  });

  return {
    status,
    isInstalled,
    isStreaming,
    installing,
    starting,
    stopping,
    installProgress,
    metadata,
    streamDuration,
    installSndcpy,
    startStreaming,
    stopStreaming,
    checkInstallStatus,
    clearError,
  };
}
