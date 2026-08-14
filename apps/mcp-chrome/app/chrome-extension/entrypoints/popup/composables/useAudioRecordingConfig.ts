import { ref } from 'vue';
import { getMessage } from '@/utils/i18n';
import { localStorage } from '@/services/ExtensionStorage';
import { InitializationController } from '@/utils/async';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { toErrorMessage } from '@/utils/errors';

export interface AudioApiServer {
  id: string;
  name: string;
  url: string;
  authToken: string;
  streamingMode: 'realtime' | 'chunks' | 'file';
  chunkInterval: number;
  enabled: boolean;
}

export interface AudioRecordingSettings {
  includeMicrophone: boolean;
  saveLocal: boolean;
  enableAutoStop: boolean;
  silenceDuration: number;
  maxDuration: number;
}

export interface BackgroundStreamingSettings {
  enabled: boolean;
}

interface StoredAudioRecordingConfig {
  apiServers?: AudioApiServer[];
  recordingSettings?: Partial<AudioRecordingSettings>;
  backgroundStreaming?: BackgroundStreamingSettings | boolean;
  sessionMetadata?: Record<string, unknown>;
  sessionMetadataText?: string;
}

const DEFAULT_RECORDING_SETTINGS: AudioRecordingSettings = {
  includeMicrophone: true,
  saveLocal: false,
  enableAutoStop: false,
  silenceDuration: 30,
  maxDuration: 600,
};
const apiServers = ref<AudioApiServer[]>([]);
const recordingSettings = ref<AudioRecordingSettings>({ ...DEFAULT_RECORDING_SETTINGS });
const backgroundStreaming = ref<BackgroundStreamingSettings>({ enabled: false });
const sessionMetadataText = ref('');
const sessionMetadata = ref<Record<string, unknown>>({});
const sessionMetadataError = ref('');
const initialization = new InitializationController<void>();
let unsubscribe: (() => void) | null = null;

function applyConfig(config?: StoredAudioRecordingConfig): void {
  if (!config) {
    apiServers.value = [];
    recordingSettings.value = { ...DEFAULT_RECORDING_SETTINGS };
    backgroundStreaming.value = { enabled: false };
    sessionMetadata.value = {};
    sessionMetadataText.value = '';
    sessionMetadataError.value = '';
    return;
  }
  apiServers.value = Array.isArray(config.apiServers) ? config.apiServers : [];
  recordingSettings.value = {
    ...DEFAULT_RECORDING_SETTINGS,
    ...(config.recordingSettings || {}),
  };
  backgroundStreaming.value = typeof config.backgroundStreaming === 'boolean'
    ? { enabled: config.backgroundStreaming }
    : { enabled: config.backgroundStreaming?.enabled === true };
  sessionMetadata.value = config.sessionMetadata || {};
  sessionMetadataText.value = config.sessionMetadataText || (
    Object.keys(sessionMetadata.value).length
      ? JSON.stringify(sessionMetadata.value, null, 2)
      : ''
  );
  sessionMetadataError.value = '';
}

async function initialize(): Promise<void> {
  await initialization.run(async () => {
    applyConfig(
      await localStorage.getOptional<StoredAudioRecordingConfig>(
        STORAGE_KEYS.AUDIO_RECORDING_CONFIG,
      ),
    );
    unsubscribe = localStorage.subscribe<StoredAudioRecordingConfig>(
      STORAGE_KEYS.AUDIO_RECORDING_CONFIG,
      applyConfig,
    );
  });
}

function updateSessionMetadata(alertOnError = false): boolean {
  const raw = sessionMetadataText.value.trim();
  if (!raw) {
    sessionMetadata.value = {};
    sessionMetadataError.value = '';
    return true;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Metadata must be a JSON object');
    }
    sessionMetadata.value = parsed;
    sessionMetadataError.value = '';
    return true;
  } catch (error: unknown) {
    const message = toErrorMessage(error) || 'Invalid JSON';
    sessionMetadataError.value = message;
    if (alertOnError) alert(getMessage('invalidJsonError', [message]));
    return false;
  }
}

async function save(): Promise<void> {
  updateSessionMetadata(false);
  await localStorage.set<StoredAudioRecordingConfig>(STORAGE_KEYS.AUDIO_RECORDING_CONFIG, {
    apiServers: apiServers.value,
    recordingSettings: recordingSettings.value,
    backgroundStreaming: backgroundStreaming.value,
    sessionMetadata: sessionMetadata.value,
    sessionMetadataText: sessionMetadataText.value,
  });
}

function addServer(): void {
  apiServers.value.push({
    id: `server_${Date.now()}`,
    name: getMessage('defaultServerName', [(apiServers.value.length + 1).toString()]),
    url: '',
    authToken: '',
    streamingMode: 'realtime',
    chunkInterval: 1000,
    enabled: false,
  });
  void save();
}

function removeServer(index: number): void {
  apiServers.value.splice(index, 1);
  void save();
}

function toggleServer(index: number): void {
  const server = apiServers.value[index];
  if (!server) return;
  server.enabled = !server.enabled;
  void save();
}

export function useAudioRecordingConfig() {
  return {
    apiServers,
    recordingSettings,
    backgroundStreaming,
    sessionMetadataText,
    sessionMetadata,
    sessionMetadataError,
    initialize,
    updateSessionMetadata,
    save,
    addServer,
    removeServer,
    toggleServer,
    dispose: () => {
      unsubscribe?.();
      unsubscribe = null;
      initialization.reset();
    },
  };
}
