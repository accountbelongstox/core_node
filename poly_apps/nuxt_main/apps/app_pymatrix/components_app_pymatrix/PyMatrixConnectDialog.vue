<template>
  <div class="pymatrix-dialog-overlay" @click="$emit('close')">
    <div class="pymatrix-dialog" @click.stop>
      <div class="pymatrix-dialog__header">
        <h3 class="pymatrix-dialog__title">Connect Device</h3>
        <button class="pymatrix-dialog__close-btn" @click="$emit('close')">×</button>
      </div>

      <form class="pymatrix-dialog__body" @submit.prevent="handleConnect">
        <!-- Preset Selector -->
        <div class="preset-section">
          <div class="pymatrix-dialog__form-group">
            <label class="pymatrix-dialog__form-label">Connection Preset</label>
            <div class="preset-controls">
              <select v-model="selectedPresetId" class="pymatrix-dialog__form-input preset-select" @change="handlePresetChange">
                <option value="">— No Preset —</option>
                <option v-for="preset in presetsStore.allPresets" :key="preset.id" :value="preset.id">
                  {{ preset.name }} {{ preset.isDefault ? '' : '(Custom)' }}
                </option>
              </select>
              <button
                type="button"
                class="preset-btn manage-btn"
                @click="showPresetsPanel = true"
                title="Manage Presets"
              >
                ⚙️
              </button>
              <button
                type="button"
                class="preset-btn save-btn"
                @click="showSavePresetDialog = true"
                title="Save Current Settings as Preset"
              >
                💾
              </button>
            </div>
          </div>
        </div>

        <div class="pymatrix-dialog__form-group">
          <label class="pymatrix-dialog__form-label">Select Discovered Device</label>
          <select v-model="selectedSerial" class="pymatrix-dialog__form-input">
            <option value="">— Manual Entry —</option>
            <option v-for="device in deviceOptions" :key="device.serial" :value="device.serial">
              {{ device.label }}
            </option>
          </select>
        </div>

        <div class="pymatrix-dialog__form-group">
          <label class="pymatrix-dialog__form-label">Device Serial</label>
          <input
            v-model="manualSerial"
            type="text"
            class="pymatrix-dialog__form-input"
            placeholder="Enter device serial (e.g., ABC123DEF456)"
          />
        </div>

        <div class="pymatrix-dialog__form-group">
          <label class="pymatrix-dialog__form-label">Device Name (used for overrides)</label>
          <input
            v-model="deviceName"
            type="text"
            class="pymatrix-dialog__form-input"
            placeholder="e.g. Samsung S23"
          />
        </div>

        <div class="config-grid">
          <div
            v-for="field in configFields"
            :key="field.key"
            class="pymatrix-dialog__form-group"
          >
            <label class="pymatrix-dialog__form-label">{{ field.label }}</label>
            <template v-if="field.type === 'number'">
              <input
                v-model.number="configForm[field.key]"
                class="pymatrix-dialog__form-input"
                type="number"
                :min="field.min"
                :max="field.max"
                :step="field.step || 1"
              />
            </template>
            <template v-else-if="field.type === 'select'">
              <select
                v-if="'valueType' in field && field.valueType === 'number'"
                v-model.number="configForm[field.key]"
                class="pymatrix-dialog__form-input"
              >
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <select
                v-else
                v-model="configForm[field.key]"
                class="pymatrix-dialog__form-input"
              >
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </template>
            <template v-else-if="field.type === 'toggle'">
              <label class="pymatrix-dialog__switch">
                <input type="checkbox" v-model="configForm[field.key]" />
                <span class="slider"></span>
              </label>
            </template>
          </div>
        </div>

        <p v-if="errorMessage" class="pymatrix-dialog__error">{{ errorMessage }}</p>

        <div class="pymatrix-dialog__footer">
          <button class="pymatrix-dialog__button" type="button" @click="$emit('close')">
            Cancel
          </button>
          <button class="pymatrix-dialog__button pymatrix-dialog__button--primary" type="submit" :disabled="submitting">
            {{ submitting ? 'Connecting…' : 'Connect' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Save Preset Dialog -->
  <div v-if="showSavePresetDialog" class="save-preset-overlay" @click.self="closeSavePresetDialog">
    <div class="save-preset-dialog">
      <div class="save-preset-header">
        <h4 class="save-preset-title">Save as Preset</h4>
        <button class="save-preset-close-btn" @click="closeSavePresetDialog">×</button>
      </div>
      <form class="save-preset-body" @submit.prevent="handleSavePreset">
        <div class="save-preset-form-group">
          <label class="save-preset-form-label">Preset Name</label>
          <input
            v-model="savePresetName"
            type="text"
            class="save-preset-form-input"
            placeholder="e.g., My Custom Preset"
            required
          />
        </div>
        <div class="save-preset-form-group">
          <label class="save-preset-form-label">Description (optional)</label>
          <textarea
            v-model="savePresetDescription"
            class="save-preset-form-input"
            placeholder="Enter preset description"
            rows="2"
          ></textarea>
        </div>
        <div class="save-preset-footer">
          <button type="button" class="save-preset-btn cancel-btn" @click="closeSavePresetDialog">
            Cancel
          </button>
          <button type="submit" class="save-preset-btn save-btn">
            Save Preset
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Connection Presets Panel -->
  <ConnectionPresetsPanel
    :show="showPresetsPanel"
    @close="showPresetsPanel = false"
    @preset-selected="(id) => selectedPresetId = id"
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue';
import { useConfigStore } from '../stores_app_pymatrix/configStore';
import { useConnectionPresetsStore } from '../stores_app_pymatrix/connectionPresetsStore';
import { DEVICE_CONFIG_FIELDS, type DeviceConfigField } from '../config_app_pymatrix/deviceConfigFields';
import ConnectionPresetsPanel from './ConnectionPresetsPanel.vue';
import type { Device, DeviceConfig } from '../../../types/pymatrix';

interface Props {
  availableDevices?: Device[];
}

interface Emits {
  (e: 'close'): void;
  (e: 'connect', payload: { serial: string; deviceName?: string; config: DeviceConfig }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const configStore = useConfigStore();
const presetsStore = useConnectionPresetsStore();

const selectedSerial = ref<string>('');
const manualSerial = ref<string>('');
const deviceName = ref<string>('');
const selectedPresetId = ref<string>('');

const configFields: DeviceConfigField[] = DEVICE_CONFIG_FIELDS;
const configForm = reactive<DeviceConfig>({ ...configStore.globalConfig });

const submitting = ref(false);
const errorMessage = ref('');

// Preset management
const showPresetsPanel = ref(false);
const showSavePresetDialog = ref(false);
const savePresetName = ref('');
const savePresetDescription = ref('');

// Load presets on mount
onMounted(() => {
  presetsStore.loadPresets();
  // Set active preset if exists
  if (presetsStore.activePresetId) {
    selectedPresetId.value = presetsStore.activePresetId;
  }
});

const deviceOptions = computed(() =>
  (props.availableDevices || []).map((device) => ({
    serial: device.serial,
    label: `${device.name || device.model || device.serial} (${device.serial})`,
    device,
  }))
);

function applyConfig(source: DeviceConfig) {
  configFields.forEach((field) => {
    configForm[field.key] = source[field.key];
  });
}

// Handle preset change
function handlePresetChange() {
  if (!selectedPresetId.value) return;

  const preset = presetsStore.findPreset(selectedPresetId.value);
  if (preset) {
    applyConfig(preset.config);
    console.log('[PyMatrixConnectDialog] Preset loaded:', preset.name);
  }
}

// Handle save preset
function handleSavePreset() {
  if (!savePresetName.value.trim()) {
    alert('Please enter a preset name');
    return;
  }

  if (presetsStore.presetNameExists(savePresetName.value)) {
    alert('A preset with this name already exists');
    return;
  }

  const presetId = presetsStore.createPreset({
    name: savePresetName.value.trim(),
    description: savePresetDescription.value.trim() || undefined,
    config: { ...configForm },
    isDefault: false
  });

  presetsStore.setActivePreset(presetId);
  selectedPresetId.value = presetId;
  showSavePresetDialog.value = false;
  savePresetName.value = '';
  savePresetDescription.value = '';
  console.log('[PyMatrixConnectDialog] Preset saved:', savePresetName.value);
}

// Handle close save preset dialog
function closeSavePresetDialog() {
  showSavePresetDialog.value = false;
  savePresetName.value = '';
  savePresetDescription.value = '';
}

watch(
  () => configStore.globalConfig,
  (value) => {
    if (!selectedSerial.value && !manualSerial.value) {
      applyConfig(value);
    }
  },
  { immediate: true }
);

watch(
  () => selectedSerial.value,
  (serial) => {
    if (!serial) {
      manualSerial.value = '';
      deviceName.value = '';
      applyConfig(configStore.globalConfig);
      return;
    }
    const option = deviceOptions.value.find((item) => item.serial === serial);
    if (option) {
      manualSerial.value = option.serial;
      const inferredName = option.device.name || option.device.model || option.serial;
      deviceName.value = inferredName;
      const effectiveConfig = configStore.getEffectiveConfig(inferredName);
      applyConfig(effectiveConfig);
    }
  }
);

async function handleConnect() {
  const serial = (selectedSerial.value || manualSerial.value || '').trim();
  if (!serial) {
    errorMessage.value = 'Please provide a device serial.';
    return;
  }

  errorMessage.value = '';
  submitting.value = true;
  try {
    emit('connect', {
      serial,
      deviceName: deviceName.value.trim() || undefined,
      config: { ...configForm },
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped src="../assets/css/dialog.css"></style>
<style scoped>
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.pymatrix-dialog__form-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

/* Preset Section Styles */
.preset-section {
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.preset-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.preset-select {
  flex: 1;
}

.preset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 1);
}

.manage-btn:hover {
  border-color: rgba(59, 130, 246, 0.5);
  color: #3b82f6;
}

.save-btn:hover {
  border-color: rgba(34, 197, 94, 0.5);
  color: #22c55e;
}

/* Save Preset Dialog Styles */
.save-preset-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.save-preset-dialog {
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.98) 0%, rgba(30, 30, 30, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 90%;
  max-width: 450px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(16px);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.save-preset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.save-preset-title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
}

.save-preset-close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-preset-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 1);
}

.save-preset-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.save-preset-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.save-preset-form-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.save-preset-form-input {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s ease;
}

.save-preset-form-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(59, 130, 246, 0.5);
}

.save-preset-form-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.save-preset-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.save-preset-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-preset-btn.cancel-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.save-preset-btn.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.save-preset-btn.save-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  color: white;
}

.save-preset-btn.save-btn:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transform: translateY(-1px);
}
</style>
