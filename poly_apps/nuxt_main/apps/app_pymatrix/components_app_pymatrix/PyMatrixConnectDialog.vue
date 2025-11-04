<template>
  <div class="pm-modal-backdrop" @click="$emit('close')">
    <div class="pm-modal" @click.stop>
      <div class="pm-modal__header">
        <h3>Connect Device</h3>
        <button @click="$emit('close')">×</button>
      </div>

      <form class="pm-modal__body" @submit.prevent="handleConnect">
        <!-- Preset Selector -->
        <div class="preset-section">
          <div class="pm-form-group">
            <label>Connection Preset</label>
            <div class="preset-controls">
              <select v-model="selectedPresetId" class="pm-select preset-select" @change="handlePresetChange">
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

        <div class="pm-form-group">
          <label>Select Discovered Device</label>
          <select v-model="selectedSerial" class="pm-select">
            <option value="">— Manual Entry —</option>
            <option v-for="device in deviceOptions" :key="device.serial" :value="device.serial">
              {{ device.label }}
            </option>
          </select>
        </div>

        <div class="pm-form-group">
          <label>Device Serial</label>
          <input
            v-model="manualSerial"
            type="text"
            class="pm-input"
            placeholder="Enter device serial (e.g., ABC123DEF456)"
          />
        </div>

        <div class="pm-form-group">
          <label>Device Name (used for overrides)</label>
          <input
            v-model="deviceName"
            type="text"
            class="pm-input"
            placeholder="e.g. Samsung S23"
          />
        </div>

        <div class="config-grid">
          <div
            v-for="field in configFields"
            :key="field.key"
            class="pm-form-group"
          >
            <label>{{ field.label }}</label>
            <template v-if="field.type === 'number'">
              <input
                v-model.number="configForm[field.key]"
                class="pm-input"
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
                class="pm-select"
              >
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <select
                v-else
                v-model="configForm[field.key]"
                class="pm-select"
              >
                <option v-for="option in field.options" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </template>
            <template v-else-if="field.type === 'toggle'">
              <label class="pm-switch">
                <input type="checkbox" v-model="configForm[field.key]" />
                <span class="slider"></span>
              </label>
            </template>
          </div>
        </div>

        <p v-if="errorMessage" class="pm-error">{{ errorMessage }}</p>

        <div class="pm-modal__footer">
          <button class="pm-button pm-button--default" type="button" @click="$emit('close')">
            Cancel
          </button>
          <button class="pm-button pm-button--rainbow" type="submit" :disabled="submitting">
            {{ submitting ? 'Connecting…' : 'Connect' }}
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- Save Preset Dialog -->
  <div v-if="showSavePresetDialog" class="pm-modal-backdrop" @click.self="closeSavePresetDialog">
    <div class="pm-modal">
      <div class="pm-modal__header">
        <h4>Save as Preset</h4>
        <button @click="closeSavePresetDialog">×</button>
      </div>
      <form class="pm-modal__body" @submit.prevent="handleSavePreset">
        <div class="pm-form-group">
          <label>Preset Name</label>
          <input
            v-model="savePresetName"
            type="text"
            class="pm-input"
            placeholder="e.g., My Custom Preset"
            required
          />
        </div>
        <div class="pm-form-group">
          <label>Description (optional)</label>
          <textarea
            v-model="savePresetDescription"
            class="pm-input"
            placeholder="Enter preset description"
            rows="2"
          ></textarea>
        </div>
        <div class="pm-modal__footer">
          <button type="button" class="pm-button pm-button--default" @click="closeSavePresetDialog">
            Cancel
          </button>
          <button type="submit" class="pm-button pm-button--primary">
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
import type { Device, DeviceConfig } from '@/types/pymatrix';

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

<style scoped>
/* ConnectDialog Styles with NFTMax Theme */

/* Modal Backdrop */
.pm-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  animation: pm-fadeIn 0.3s ease;
}

/* Modal Container */
.pm-modal {
  background: var(--pm-bg-card);
  border-radius: var(--pm-radius-lg);
  max-width: 650px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--pm-shadow-lg);
  animation: pm-scaleUp 0.3s ease;
}

/* Modal Header */
.pm-modal__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--pm-space-lg);
  border-bottom: 1px solid var(--pm-border);
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.05) 0%, rgba(243, 57, 248, 0.05) 100%);
}

.pm-modal__header h3,
.pm-modal__header h4 {
  font-size: var(--pm-font-size-xl);
  font-weight: 700;
  margin: 0;
  background: var(--pm-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pm-modal__header button {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-circle);
  font-size: 28px;
  color: var(--pm-text-secondary);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  line-height: 1;
  padding: 0;
}

.pm-modal__header button:hover {
  background: var(--pm-danger);
  color: #ffffff;
  border-color: transparent;
  transform: rotate(90deg) scale(1.1);
}

/* Modal Body */
.pm-modal__body {
  flex: 1;
  padding: var(--pm-space-lg);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-md);
}

/* Preset Section */
.preset-section {
  padding-bottom: var(--pm-space-md);
  margin-bottom: var(--pm-space-md);
  border-bottom: 1px solid var(--pm-border);
  animation: pm-fadeUp 0.4s ease;
}

.preset-controls {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.preset-select {
  flex: 1;
}

.preset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  background: var(--pm-bg-main);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-md);
  color: var(--pm-text-secondary);
  font-size: 20px;
  cursor: pointer;
  transition: var(--pm-transition-fast);
  position: relative;
  overflow: hidden;
}

.preset-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--pm-gradient-primary);
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.preset-btn:hover {
  border-color: var(--pm-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.3);
}

.preset-btn:hover::before {
  opacity: 1;
}

.preset-btn:hover {
  color: #ffffff;
}

.manage-btn:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.save-btn:hover {
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

/* Form Groups */
.pm-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: pm-fadeUp 0.4s ease;
}

.pm-form-group label {
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  color: var(--pm-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.pm-form-group label::before {
  content: '◆';
  font-size: 8px;
  color: var(--pm-primary);
}

/* Config Grid */
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--pm-space-md);
  padding-top: var(--pm-space-sm);
}

/* Input Styles (using theme classes) */
.pm-input {
  width: 100%;
  height: 48px;
  padding: 12px 20px;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-primary);
  background: var(--pm-bg-main);
  border: 1.5px solid var(--pm-border);
  border-radius: var(--pm-radius-xl);
  outline: none;
  transition: var(--pm-transition-fast);
}

.pm-input:hover {
  border-color: var(--pm-primary);
}

.pm-input:focus {
  border-color: var(--pm-primary);
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.1);
  background: #ffffff;
}

.pm-input::placeholder {
  color: var(--pm-text-muted);
}

textarea.pm-input {
  height: auto;
  resize: vertical;
  padding: 12px 20px;
}

/* Select Styles */
.pm-select {
  width: 100%;
  height: 48px;
  padding: 12px 40px 12px 20px;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-primary);
  background: var(--pm-bg-main);
  border: 1.5px solid var(--pm-border);
  border-radius: var(--pm-radius-xl);
  outline: none;
  transition: var(--pm-transition-fast);
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%23878F9A' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 20px center;
}

.pm-select:hover {
  border-color: var(--pm-primary);
}

.pm-select:focus {
  border-color: var(--pm-primary);
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.1);
}

/* Toggle Switch (using theme classes) */
.pm-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.pm-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.pm-switch .slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--pm-text-secondary);
  transition: var(--pm-transition-normal);
  border-radius: 34px;
}

.pm-switch .slider::before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: #ffffff;
  transition: var(--pm-transition-normal);
  border-radius: 50%;
}

.pm-switch input:checked + .slider {
  background: var(--pm-gradient-primary);
}

.pm-switch input:checked + .slider::before {
  transform: translateX(24px);
}

.pm-switch input:focus + .slider {
  box-shadow: 0 0 4px var(--pm-primary);
}

/* Error Message */
.pm-error {
  padding: 12px 16px;
  background: rgba(235, 87, 87, 0.1);
  border: 1px solid var(--pm-danger);
  border-radius: var(--pm-radius-md);
  color: var(--pm-danger);
  font-size: var(--pm-font-size-sm);
  margin: 0;
  animation: pm-fadeIn 0.3s ease;
}

/* Modal Footer */
.pm-modal__footer {
  display: flex;
  gap: 12px;
  padding: var(--pm-space-lg);
  border-top: 1px solid var(--pm-border);
  background: var(--pm-bg-main);
  justify-content: flex-end;
}

/* Buttons */
.pm-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 28px;
  font-size: var(--pm-font-size-base);
  font-weight: 600;
  border-radius: var(--pm-radius-full);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  outline: none;
  border: none;
  min-width: 120px;
  position: relative;
  overflow: hidden;
}

.pm-button::before {
  content: '';
  position: absolute;
  inset: 0;
  background: transparent;
  opacity: 0;
  transition: var(--pm-transition-fast);
  z-index: 0;
}

.pm-button span {
  position: relative;
  z-index: 1;
}

/* Default Button */
.pm-button--default {
  background: var(--pm-bg-main);
  color: var(--pm-text-primary);
  border: 1px solid var(--pm-border);
}

.pm-button--default::before {
  background: var(--pm-primary);
}

.pm-button--default:hover {
  border-color: var(--pm-primary);
  color: var(--pm-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.2);
}

/* Primary Button */
.pm-button--primary {
  background: var(--pm-primary);
  color: #ffffff;
}

.pm-button--primary::before {
  background: var(--pm-secondary);
}

.pm-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(83, 86, 251, 0.4);
}

.pm-button--primary:hover::before {
  opacity: 1;
}

/* Rainbow/Gradient Button */
.pm-button--rainbow {
  background: var(--pm-gradient-primary);
  color: #ffffff;
  font-weight: 700;
}

.pm-button--rainbow::before {
  background: var(--pm-gradient-primary-reverse);
  opacity: 1;
}

.pm-button--rainbow:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 6px 20px rgba(243, 57, 248, 0.5);
}

.pm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Animations */
@keyframes pm-fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pm-scaleUp {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pm-fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar Styling */
.pm-modal__body::-webkit-scrollbar {
  width: 6px;
}

.pm-modal__body::-webkit-scrollbar-track {
  background: var(--pm-bg-main);
  border-radius: 10px;
}

.pm-modal__body::-webkit-scrollbar-thumb {
  background: var(--pm-border);
  border-radius: 10px;
  transition: var(--pm-transition-fast);
}

.pm-modal__body::-webkit-scrollbar-thumb:hover {
  background: var(--pm-primary);
}

/* Responsive */
@media (max-width: 767px) {
  .pm-modal {
    width: 95%;
    max-height: 95vh;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .preset-controls {
    flex-wrap: wrap;
  }

  .pm-modal__footer {
    flex-direction: column-reverse;
  }

  .pm-button {
    width: 100%;
  }
}
</style>
