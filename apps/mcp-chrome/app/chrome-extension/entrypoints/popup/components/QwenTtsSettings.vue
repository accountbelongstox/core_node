<template>
  <section class="settings-card">
    <div class="settings-card__header">
      <div>
        <h4>Qwen3-TTS</h4>
        <p>Shared by Laravel production tasks and the Extension test panel.</p>
      </div>
    </div>

    <div class="settings-grid">
      <label>
        <span>Mode</span>
        <select v-model="mode">
          <option value="voice_design">Voice Design</option>
          <option value="voice_clone">Voice Clone (Base)</option>
          <option value="custom_voice">TTS (CustomVoice)</option>
        </select>
      </label>

      <label>
        <span>Wait timeout (sec)</span>
        <input v-model.number="waitTimeoutSec" type="number" min="30" max="600" />
      </label>
    </div>

    <label v-if="mode === 'voice_design'">
      <span>Voice description</span>
      <textarea v-model="voiceDescription" rows="2" />
    </label>

    <label v-if="mode === 'custom_voice'">
      <span>Style instruction</span>
      <textarea v-model="styleInstruction" rows="2" />
    </label>

    <div class="settings-checks">
      <label><input v-model="autoDownload" type="checkbox" /> Auto-download test output</label>
      <label><input v-model="openInNewTab" type="checkbox" /> Open a new tab for each test</label>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { useQwenTtsSettings } from '../composables/useQwenTtsSettings';

const {
  mode,
  voiceDescription,
  styleInstruction,
  waitTimeoutSec,
  openInNewTab,
  autoDownload,
} = useQwenTtsSettings();
</script>

<style scoped>
.settings-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.settings-card__header h4 {
  margin: 0;
  color: var(--text);
  font-size: 11px;
}
.settings-card__header p {
  margin: 2px 0 0;
  color: var(--text-faint);
  font-size: 9px;
}
.settings-grid,
.settings-checks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--text-muted);
  font-size: 9px;
}
.settings-checks label {
  flex-direction: row;
  align-items: center;
}
input,
select,
textarea {
  padding: 5px 7px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 10px;
}
textarea {
  resize: vertical;
}
</style>
