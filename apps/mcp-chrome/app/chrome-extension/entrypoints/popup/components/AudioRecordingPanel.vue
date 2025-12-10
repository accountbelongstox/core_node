<template>
  <div class="audio-panel-container">
    <div class="panel-header">
      <h3 class="panel-title">{{ getMessage('audioRecordingLabel') }}</h3>
      <button class="collapse-button" @click="collapsed = !collapsed">
        {{ collapsed ? '▼' : '▲' }}
      </button>
    </div>

    <div v-if="!collapsed" class="panel-content">
      <!-- Recording Status -->
      <div class="status-section">
        <div class="status-row">
          <span class="status-label">{{ getMessage('recordingStatusLabel') }}</span>
          <div class="status-indicator">
            <span :class="['status-dot', getRecordingStatusClass()]"></span>
            <span class="status-text">{{ getRecordingStatusText() }}</span>
          </div>
        </div>
        <div v-if="recordingInfo.isRecording" class="recording-info">
          <div class="info-row">
            <span class="info-label">{{ getMessage('durationLabel') }}</span>
            <span class="info-value">{{ formatDuration(recordingInfo.duration) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ getMessage('chunkCountLabel') }}</span>
            <span class="info-value">{{ recordingInfo.chunkCount }}</span>
          </div>
        </div>
      </div>

      <!-- API Server Configuration -->
      <div class="config-section">
        <h4 class="section-title">{{ getMessage('apiServerConfigLabel') }}</h4>

        <div class="server-list">
          <div
            v-for="(server, index) in apiServers"
            :key="server.id"
            class="server-item"
          >
            <div class="server-header">
              <input
                type="checkbox"
                :checked="server.enabled"
                @change="toggleServer(index)"
                class="server-checkbox"
              />
              <input
                v-model="server.name"
                @blur="saveConfig"
                :placeholder="getMessage('serverNamePlaceholder')"
                class="server-name-input"
              />
              <button @click="removeServer(index)" class="remove-button">
                🗑️
              </button>
            </div>

            <div v-if="server.enabled" class="server-config">
              <div class="config-row">
                <label class="config-label">{{ getMessage('urlLabel') }}</label>
                <input
                  v-model="server.url"
                  @blur="saveConfig"
                  :placeholder="getMessage('urlPlaceholder')"
                  class="config-input"
                />
              </div>

              <div class="config-row">
                <label class="config-label">{{ getMessage('authTokenLabel') }}</label>
                <input
                  v-model="server.authToken"
                  @blur="saveConfig"
                  type="password"
                  :placeholder="getMessage('optionalPlaceholder')"
                  class="config-input"
                />
              </div>

              <div class="config-row">
                <label class="config-label">{{ getMessage('streamingModeLabel') }}</label>
                <select
                  v-model="server.streamingMode"
                  @change="saveConfig"
                  class="config-select"
                >
                  <option value="realtime">{{ getMessage('realtimeWebsocketOption') }}</option>
                  <option value="chunks">{{ getMessage('chunkedUploadOption') }}</option>
                  <option value="file">{{ getMessage('completeFileUploadOption') }}</option>
                </select>
              </div>

              <div v-if="server.streamingMode === 'chunks'" class="config-row">
                <label class="config-label">{{ getMessage('chunkIntervalLabel') }}</label>
                <input
                  v-model.number="server.chunkInterval"
                  @blur="saveConfig"
                  type="number"
                  min="100"
                  max="10000"
                  class="config-input"
                />
              </div>
            </div>
          </div>
        </div>

        <button @click="addServer" class="add-server-button">
          {{ getMessage('addApiServerButton') }}
        </button>
      </div>

      <!-- Recording Settings -->
      <div class="config-section">
        <h4 class="section-title">{{ getMessage('recordingSettingsLabel') }}</h4>

        <div class="setting-row">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="recordingSettings.includeMicrophone"
              @change="saveConfig"
            />
            {{ getMessage('includeMicrophoneLabel') }}
          </label>
        </div>

        <div class="setting-row">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="recordingSettings.saveLocal"
              @change="saveConfig"
            />
            {{ getMessage('saveLocallyLabel') }}
          </label>
        </div>

        <div class="setting-row">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="recordingSettings.enableAutoStop"
              @change="saveConfig"
            />
            {{ getMessage('autoStopSilenceLabel') }}
          </label>
        </div>

        <div v-if="recordingSettings.enableAutoStop" class="setting-sub">
          <label class="config-label">{{ getMessage('silenceDurationLabel') }}</label>
          <input
            v-model.number="recordingSettings.silenceDuration"
            @blur="saveConfig"
            type="number"
            min="5"
            max="300"
            class="config-input-small"
          />
        </div>

        <div class="setting-row">
          <label class="config-label">{{ getMessage('maxDurationLabel') }}</label>
          <select
            v-model.number="recordingSettings.maxDuration"
            @change="saveConfig"
            class="config-select"
          >
            <option :value="60">{{ getMessage('oneMinuteOption') }}</option>
            <option :value="300">{{ getMessage('fiveMinutesOption') }}</option>
            <option :value="600">{{ getMessage('tenMinutesOption') }}</option>
            <option :value="1800">{{ getMessage('thirtyMinutesOption') }}</option>
            <option :value="3600">{{ getMessage('oneHourOption') }}</option>
            <option :value="0">{{ getMessage('noLimitOption') }}</option>
          </select>
        </div>
      </div>

      <!-- Session Metadata -->
      <div class="config-section">
        <h4 class="section-title">{{ getMessage('sessionMetadataLabel') }}</h4>
        <textarea
          v-model="sessionMetadataText"
          @blur="saveConfig"
          class="metadata-textarea"
          placeholder='{"word":"example","type":"word","source":"chrome_extension"}'
          rows="4"
        ></textarea>
        <p class="metadata-helper">
          {{ getMessage('sessionMetadataHelper') }}
        </p>
        <p v-if="sessionMetadataError" class="metadata-error">
          {{ sessionMetadataError }}
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="actions-section">
        <button
          @click="startRecording"
          :disabled="recordingInfo.isRecording"
          class="action-button primary"
        >
          🎙️ {{ getMessage('startRecordingButton') }}
        </button>
        <button
          @click="stopRecording"
          :disabled="!recordingInfo.isRecording"
          class="action-button danger"
        >
          ⏹️ {{ getMessage('stopRecordingButton') }}
        </button>
      </div>

      <!-- Enable Background Streaming -->
      <div class="background-section">
        <div class="background-header">
          <label class="background-label">
            <input
              type="checkbox"
              v-model="backgroundStreaming.enabled"
              @change="toggleBackgroundStreaming"
            />
            {{ getMessage('enableBackgroundStreamingLabel') }}
          </label>
          <span v-if="backgroundStreaming.enabled" class="streaming-badge">
            {{ getMessage('activeStatus') }}
          </span>
        </div>
        <p class="background-description">
          {{ getMessage('backgroundStreamingDescription') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { getMessage } from '../../../utils/i18n';

interface ApiServer {
  id: string;
  name: string;
  url: string;
  authToken: string;
  streamingMode: 'realtime' | 'chunks' | 'file';
  chunkInterval: number;
  enabled: boolean;
}

interface RecordingSettings {
  includeMicrophone: boolean;
  saveLocal: boolean;
  enableAutoStop: boolean;
  silenceDuration: number;
  maxDuration: number;
}

interface RecordingInfo {
  isRecording: boolean;
  duration: number;
  chunkCount: number;
}

interface BackgroundStreaming {
  enabled: boolean;
}

const collapsed = ref(false);
const sessionMetadataText = ref('');
const sessionMetadata = ref<Record<string, any>>({});
const sessionMetadataError = ref('');
const apiServers = ref<ApiServer[]>([]);
const recordingSettings = ref<RecordingSettings>({
  includeMicrophone: true,
  saveLocal: false,
  enableAutoStop: false,
  silenceDuration: 30,
  maxDuration: 600, // 10 minutes default
});

const recordingInfo = ref<RecordingInfo>({
  isRecording: false,
  duration: 0,
  chunkCount: 0,
});

const backgroundStreaming = ref<BackgroundStreaming>({
  enabled: false,
});

const updateSessionMetadata = (alertOnError = false) => {
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
  } catch (error: any) {
    const message = error?.message || 'Invalid JSON';
    sessionMetadataError.value = message;
    if (alertOnError) {
      alert(getMessage('invalidJsonError', [message]));
    }
    return false;
  }
};

const getRecordingStatusClass = () => {
  return recordingInfo.value.isRecording ? 'recording' : 'idle';
};

const getRecordingStatusText = () => {
  return recordingInfo.value.isRecording ? getMessage('recordingStatus') : getMessage('idleStatus');
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const addServer = () => {
  const newServer: ApiServer = {
    id: `server_${Date.now()}`,
    name: getMessage('defaultServerName', [(apiServers.value.length + 1).toString()]),
    url: '',
    authToken: '',
    streamingMode: 'realtime',
    chunkInterval: 1000,
    enabled: false,
  };
  apiServers.value.push(newServer);
  saveConfig();
};

const removeServer = (index: number) => {
  apiServers.value.splice(index, 1);
  saveConfig();
};

const toggleServer = (index: number) => {
  apiServers.value[index].enabled = !apiServers.value[index].enabled;
  saveConfig();
};

const saveConfig = async () => {
  try {
    updateSessionMetadata(false);
    const config = {
      apiServers: apiServers.value,
      recordingSettings: recordingSettings.value,
      backgroundStreaming: backgroundStreaming.value,
      sessionMetadata: sessionMetadata.value,
      sessionMetadataText: sessionMetadataText.value,
    };
    await chrome.storage.local.set({ audioRecordingConfig: config });
    console.log('Audio recording config saved');
  } catch (error) {
    console.error('Failed to save audio recording config:', error);
  }
};

const loadConfig = async () => {
  try {
    const result = await chrome.storage.local.get(['audioRecordingConfig']);
    if (result.audioRecordingConfig) {
      const config = result.audioRecordingConfig;
      apiServers.value = config.apiServers || [];
      recordingSettings.value = config.recordingSettings || recordingSettings.value;
      backgroundStreaming.value = config.backgroundStreaming || backgroundStreaming.value;
      sessionMetadata.value = config.sessionMetadata || {};
      sessionMetadataText.value =
        config.sessionMetadataText ||
        (Object.keys(sessionMetadata.value).length ? JSON.stringify(sessionMetadata.value, null, 2) : '');
      sessionMetadataError.value = '';
    }
  } catch (error) {
    console.error('Failed to load audio recording config:', error);
  }
};

const startRecording = async () => {
  try {
    const metadataValid = updateSessionMetadata(true);
    if (!metadataValid) {
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'audio_start_recording',
      config: {
        apiServers: apiServers.value.filter(s => s.enabled),
        recordingSettings: recordingSettings.value,
        sessionMetadata: sessionMetadata.value,
      },
    });

    if (response && response.success) {
      recordingInfo.value.isRecording = true;
      startDurationTimer();
    } else {
      console.error('Failed to start recording:', response?.error);
      alert(getMessage('startRecordingError', [response?.error || 'Unknown error']));
    }
  } catch (error) {
    console.error('Error starting recording:', error);
    alert(getMessage('recordingGeneralError', [String(error)]));
  }
};

const stopRecording = async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'audio_stop_recording',
    });

    if (response && response.success) {
      recordingInfo.value.isRecording = false;
      recordingInfo.value.duration = 0;
      recordingInfo.value.chunkCount = 0;
      stopDurationTimer();
    } else {
      console.error('Failed to stop recording:', response?.error);
    }
  } catch (error) {
    console.error('Error stopping recording:', error);
  }
};

const toggleBackgroundStreaming = async () => {
  try {
    if (backgroundStreaming.value.enabled && !updateSessionMetadata(true)) {
      backgroundStreaming.value.enabled = false;
      return;
    }

    await saveConfig();

    const response = await chrome.runtime.sendMessage({
      type: 'audio_toggle_background_streaming',
      enabled: backgroundStreaming.value.enabled,
      config: {
        apiServers: apiServers.value.filter(s => s.enabled),
        recordingSettings: recordingSettings.value,
        sessionMetadata: sessionMetadata.value,
      },
    });

    if (!response || !response.success) {
      console.error('Failed to toggle background streaming:', response?.error);
      backgroundStreaming.value.enabled = !backgroundStreaming.value.enabled;
    }
  } catch (error) {
    console.error('Error toggling background streaming:', error);
    backgroundStreaming.value.enabled = !backgroundStreaming.value.enabled;
  }
};

let durationTimer: ReturnType<typeof setInterval> | null = null;

const startDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
  }
  durationTimer = setInterval(() => {
    recordingInfo.value.duration++;
  }, 1000);
};

const stopDurationTimer = () => {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
};

// Listen for recording status updates from background
const setupRecordingStatusListener = () => {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'audio_recording_status_update') {
      recordingInfo.value = message.status;
    }
  });
};

onMounted(async () => {
  await loadConfig();
  setupRecordingStatusListener();

  // Check initial recording status
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'audio_get_recording_status',
    });
    if (response && response.success) {
      recordingInfo.value = response.status;
      if (recordingInfo.value.isRecording) {
        startDurationTimer();
      }
    }
  } catch (error) {
    console.error('Failed to get initial recording status:', error);
  }
});
</script>

<style scoped>
.audio-panel-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #faf5ff, #f3e8ff);
  border-bottom: 1px solid #e9d5ff;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #7c3aed;
  margin: 0;
}

.collapse-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #7c3aed;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.collapse-button:hover {
  background: rgba(124, 58, 237, 0.1);
}

.panel-content {
  padding: 20px;
}

.status-section {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-label {
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.recording {
  background: #ef4444;
  animation: pulse 2s infinite;
}

.status-dot.idle {
  background: #6b7280;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.recording-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.info-label {
  font-size: 13px;
  color: #64748b;
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.config-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 12px 0;
}

.server-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.server-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
}

.server-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.server-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.server-name-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
}

.remove-button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.remove-button:hover {
  background: #fee2e2;
}

.server-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e5e7eb;
}

.config-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.config-input,
.config-select {
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.config-input:focus,
.config-select:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.config-input-small {
  width: 100px;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.add-server-button {
  width: 100%;
  padding: 10px;
  background: #f1f5f9;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.add-server-button:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #475569;
}

.setting-row {
  margin-bottom: 12px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
}

.setting-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.setting-sub {
  margin-left: 24px;
  margin-top: 8px;
}

.actions-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.action-button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-button.primary {
  background: #8b5cf6;
  color: white;
}

.action-button.primary:hover:not(:disabled) {
  background: #7c3aed;
}

.action-button.danger {
  background: #ef4444;
  color: white;
}

.action-button.danger:hover:not(:disabled) {
  background: #dc2626;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.background-section {
  background: #fef9e7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 16px;
}

.metadata-textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  resize: vertical;
}

.metadata-helper {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.metadata-error {
  margin-top: 4px;
  font-size: 12px;
  color: #dc2626;
  font-weight: 600;
}

.background-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.background-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
  cursor: pointer;
}

.background-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.streaming-badge {
  background: #10b981;
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
}

.background-description {
  font-size: 13px;
  color: #78350f;
  margin: 0;
  line-height: 1.4;
}
</style>
