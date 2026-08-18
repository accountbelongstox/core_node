<template>
  <section class="settings-card space-y-2">
    <div class="settings-card__header">
      <div>
        <h4>{{ getMessage('recordingSettingsLabel') }}</h4>
        <p>{{ getMessage('audioSettingsSharedHint') }}</p>
      </div>
    </div>

    <div class="settings-section">
      <h5>{{ getMessage('apiServerConfigLabel') }}</h5>
      <div v-for="(server, index) in apiServers" :key="server.id" class="server-row">
        <div class="server-row__title">
          <input type="checkbox" :checked="server.enabled" @change="toggleServer(index)" />
          <input v-model="server.name" :placeholder="getMessage('serverNamePlaceholder')" @blur="save" />
          <button type="button" @click="removeServer(index)">x</button>
        </div>
        <div v-if="server.enabled" class="settings-grid">
          <input v-model="server.url" :placeholder="getMessage('urlPlaceholder')" @blur="save" />
          <input v-model="server.authToken" type="password" :placeholder="getMessage('optionalPlaceholder')" @blur="save" />
          <select v-model="server.streamingMode" @change="save">
            <option value="realtime">{{ getMessage('realtimeWebsocketOption') }}</option>
            <option value="chunks">{{ getMessage('chunkedUploadOption') }}</option>
            <option value="file">{{ getMessage('completeFileUploadOption') }}</option>
          </select>
          <input v-if="server.streamingMode === 'chunks'" v-model.number="server.chunkInterval" type="number" min="100" max="10000" @blur="save" />
        </div>
      </div>
      <button type="button" class="add-button" @click="addServer">+ {{ getMessage('addApiServerButton') }}</button>
    </div>

    <div class="settings-section settings-grid">
      <label><input v-model="recordingSettings.includeMicrophone" type="checkbox" @change="save" /> {{ getMessage('includeMicrophoneLabel') }}</label>
      <label><input v-model="recordingSettings.saveLocal" type="checkbox" @change="save" /> {{ getMessage('saveLocallyLabel') }}</label>
      <label><input v-model="recordingSettings.enableAutoStop" type="checkbox" @change="save" /> {{ getMessage('autoStopSilenceLabel') }}</label>
      <label v-if="recordingSettings.enableAutoStop">
        {{ getMessage('silenceDurationLabel') }}
        <input v-model.number="recordingSettings.silenceDuration" type="number" min="5" max="300" @blur="save" />
      </label>
      <label>
        {{ getMessage('maxDurationLabel') }}
        <select v-model.number="recordingSettings.maxDuration" @change="save">
          <option :value="60">{{ getMessage('oneMinuteOption') }}</option>
          <option :value="300">{{ getMessage('fiveMinutesOption') }}</option>
          <option :value="600">{{ getMessage('tenMinutesOption') }}</option>
          <option :value="1800">{{ getMessage('thirtyMinutesOption') }}</option>
          <option :value="3600">{{ getMessage('oneHourOption') }}</option>
          <option :value="0">{{ getMessage('noLimitOption') }}</option>
        </select>
      </label>
    </div>

    <div class="settings-section">
      <h5>{{ getMessage('sessionMetadataLabel') }}</h5>
      <textarea v-model="sessionMetadataText" rows="3" placeholder='{"word":"example","type":"word"}' @blur="save" />
      <p v-if="sessionMetadataError" class="error">{{ sessionMetadataError }}</p>
    </div>

    <label class="settings-section streaming-row">
      <input v-model="backgroundStreaming.enabled" type="checkbox" :disabled="isFirefox" @change="toggleBackgroundStreaming" />
      {{ getMessage('enableBackgroundStreamingLabel') }}
    </label>
  </section>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { getMessage } from '@/utils/i18n';
import { useAudioRecordingConfig } from '../composables/useAudioRecordingConfig';

const isFirefox = import.meta.env.FIREFOX;
const {
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
} = useAudioRecordingConfig();

const toggleBackgroundStreaming = async () => {
  if (isFirefox || !updateSessionMetadata(true)) {
    backgroundStreaming.value.enabled = false;
    await save();
    return;
  }
  await save();
  const response = await chrome.runtime.sendMessage({
    type: 'audio_toggle_background_streaming',
    enabled: backgroundStreaming.value.enabled,
    config: {
      apiServers: apiServers.value.filter((server) => server.enabled),
      recordingSettings: recordingSettings.value,
      sessionMetadata: sessionMetadata.value,
    },
  });
  if (!response?.success) {
    backgroundStreaming.value.enabled = !backgroundStreaming.value.enabled;
    await save();
  }
};

onMounted(initialize);
</script>

<style scoped>
.settings-card,
.settings-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.settings-card { padding: 10px; }
.settings-section { padding: 8px; background: var(--surface-2); }
.settings-card__header { margin-bottom: 8px; }
h4, h5 { margin: 0; color: var(--text); font-size: 11px; }
h5 { margin-bottom: 6px; font-size: 9px; text-transform: uppercase; }
p { margin: 2px 0 0; color: var(--text-faint); font-size: 9px; }
.settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.server-row { margin-top: 6px; padding: 6px; border-radius: 6px; background: var(--surface); }
.server-row__title { display: flex; gap: 6px; align-items: center; margin-bottom: 5px; }
.server-row__title input:nth-child(2) { flex: 1; }
input, select, textarea { padding: 5px 7px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface-solid, var(--surface)); color: var(--text); font-size: 10px; }
textarea { width: 100%; resize: vertical; }
label { color: var(--text-muted); font-size: 9px; }
.add-button { width: 100%; margin-top: 6px; padding: 5px; border-radius: 5px; background: var(--surface); color: var(--text); font-size: 9px; }
.streaming-row { display: flex; align-items: center; gap: 6px; }
.error { color: #fb7185; }
</style>
