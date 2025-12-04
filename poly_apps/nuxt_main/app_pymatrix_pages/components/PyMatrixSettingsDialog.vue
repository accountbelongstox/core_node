<template>
  <div class="pm-modal-backdrop" @click="$emit('close')">
    <div class="pm-modal" @click.stop>
      <div class="pm-modal__header">
        <h3>Configuration</h3>
        <button @click="$emit('close')">×</button>
      </div>

      <div class="pm-modal__body">
        <div v-if="configStore.loading" class="loading">
          <div class="spinner"></div>
          <span>Loading configuration...</span>
        </div>

        <template v-else>
          <section class="settings-section">
            <div class="section-header">
              <h4>Global Defaults</h4>
              <p>Applied to every device unless an override is defined.</p>
            </div>

            <form class="form-grid" @submit.prevent="saveGlobal">
              <div
                v-for="field in configFields"
                :key="`global-${field.key}`"
                class="pm-form-group"
              >
                <label>{{ field.label }}</label>
                <template v-if="field.type === 'number'">
                  <input
                    v-model.number="globalForm[field.key]"
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
                    v-model.number="globalForm[field.key]"
                    class="pm-select"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <select
                    v-else
                    v-model="globalForm[field.key]"
                    class="pm-select"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </template>
                <template v-else-if="field.type === 'toggle'">
                  <label class="pm-switch">
                    <input type="checkbox" v-model="globalForm[field.key]" />
                    <span class="slider"></span>
                  </label>
                </template>
              </div>

              <div class="form-actions">
                <button class="pm-button pm-button--primary" type="submit" :disabled="savingGlobal">
                  {{ savingGlobal ? 'Saving...' : 'Save Global Settings' }}
                </button>
              </div>
            </form>
          </section>

          <section class="settings-section">
            <div class="section-header">
              <h4>Device Overrides</h4>
              <p>Override global settings for a specific device (matched by device name).</p>
            </div>

            <div class="device-selector">
              <label>Select existing override</label>
              <select v-model="selectedDeviceKey" class="pm-select">
                <option value="">— None —</option>
                <option v-for="name in deviceNames" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
            </div>

            <form class="form-grid" @submit.prevent="saveDevice">
              <div class="pm-form-group full-width">
                <label>Device Name</label>
                <input
                  v-model="deviceNameInput"
                  class="pm-input"
                  type="text"
                  placeholder="e.g. Samsung S23"
                  required
                />
              </div>

              <div
                v-for="field in configFields"
                :key="`device-${field.key}`"
                class="pm-form-group"
              >
                <label>{{ field.label }}</label>
                <template v-if="field.type === 'number'">
                  <input
                    v-model.number="deviceForm[field.key]"
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
                    v-model.number="deviceForm[field.key]"
                    class="pm-select"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <select
                    v-else
                    v-model="deviceForm[field.key]"
                    class="pm-select"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </template>
                <template v-else-if="field.type === 'toggle'">
                  <label class="pm-switch">
                    <input type="checkbox" v-model="deviceForm[field.key]" />
                    <span class="slider"></span>
                  </label>
                </template>
              </div>

              <div class="form-actions grouped">
                <button
                  class="pm-button pm-button--success"
                  type="submit"
                  :disabled="savingDevice || !deviceNameInput.trim()"
                >
                  {{ savingDevice ? 'Saving...' : 'Save Override' }}
                </button>
                <button
                  class="pm-button pm-button--danger"
                  type="button"
                  :disabled="!selectedDeviceKey"
                  @click="deleteDevice"
                >
                  Remove Override
                </button>
              </div>
            </form>
          </section>

          <p v-if="configStore.error" class="pm-error">
            {{ configStore.error }}
          </p>
        </template>
      </div>

      <div class="pm-modal__footer">
        <button class="pm-button pm-button--default" @click="$emit('close')">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useConfigStore } from '@/app_pymatrix_pages/stores/configStore';
import { DEVICE_CONFIG_FIELDS, type DeviceConfigField } from '@/app_pymatrix_pages/config/deviceConfigFields';
import type { DeviceConfig } from '@/types/pymatrix';

interface Emits {
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

const configStore = useConfigStore();

const configFields: DeviceConfigField[] = DEVICE_CONFIG_FIELDS;

const globalForm = reactive<DeviceConfig>({ ...configStore.globalConfig });
const deviceForm = reactive<DeviceConfig>({ ...configStore.globalConfig });

const selectedDeviceKey = ref<string>('');
const deviceNameInput = ref('');

const savingGlobal = ref(false);
const savingDevice = ref(false);

const deviceNames = computed(() => Object.keys(configStore.deviceConfigs));

function applyConfig(target: DeviceConfig, source: DeviceConfig) {
  configFields.forEach((field) => {
    target[field.key] = source[field.key];
  });
}

watch(
  () => configStore.globalConfig,
  (value) => {
    applyConfig(globalForm, value);
    if (!selectedDeviceKey.value) {
      applyConfig(deviceForm, value);
    }
  },
  { immediate: true }
);

watch(
  () => selectedDeviceKey.value,
  (deviceKey) => {
    if (deviceKey) {
      const deviceConfig = configStore.getDeviceConfig(deviceKey);
      if (deviceConfig) {
        applyConfig(deviceForm, deviceConfig);
        deviceNameInput.value = deviceKey;
        return;
      }
    }
    deviceNameInput.value = '';
    applyConfig(deviceForm, configStore.globalConfig);
  }
);

async function saveGlobal() {
  savingGlobal.value = true;
  try {
    await configStore.saveGlobal(globalForm);
  } finally {
    savingGlobal.value = false;
  }
}

async function saveDevice() {
  if (!deviceNameInput.value.trim()) {
    return;
  }
  savingDevice.value = true;
  try {
    const name = deviceNameInput.value.trim();
    await configStore.saveDevice(name, deviceForm);
    selectedDeviceKey.value = name;
  } finally {
    savingDevice.value = false;
  }
}

async function deleteDevice() {
  if (!selectedDeviceKey.value) {
    return;
  }
  savingDevice.value = true;
  try {
    await configStore.removeDevice(selectedDeviceKey.value);
    selectedDeviceKey.value = '';
    deviceNameInput.value = '';
    applyConfig(deviceForm, configStore.globalConfig);
  } finally {
    savingDevice.value = false;
  }
}
</script>

<style scoped>
/* SettingsDialog Styles with NFTMax Theme */

/* Modal Backdrop */
.pm-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--pm-space-lg);
  animation: pm-fadeIn 0.3s ease;
}

/* Modal Container */
.pm-modal {
  background: var(--pm-color-surface);
  border-radius: var(--pm-radius-xl);
  box-shadow: var(--pm-shadow-lg);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: pm-scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Modal Header */
.pm-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pm-space-xl);
  border-bottom: 1px solid var(--pm-color-border-soft);
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.03) 0%, rgba(243, 57, 248, 0.03) 100%);
}

.pm-modal__header h3 {
  margin: 0;
  font-size: var(--pm-font-size-xl);
  font-weight: 700;
  background: var(--pm-gradient-main);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pm-modal__header button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(235, 87, 87, 0.1);
  border: 1px solid rgba(235, 87, 87, 0.2);
  border-radius: 50%;
  color: var(--pm-color-danger);
  font-size: 28px;
  font-weight: 300;
  cursor: pointer;
  transition: var(--pm-transition-fast);
  line-height: 1;
}

.pm-modal__header button:hover {
  background: var(--pm-color-danger);
  color: #ffffff;
  border-color: var(--pm-color-danger);
  transform: rotate(90deg) scale(1.1);
  box-shadow: 0 4px 16px rgba(235, 87, 87, 0.4);
}

/* Modal Body */
.pm-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--pm-space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-lg);
}

/* Settings Section */
.settings-section {
  background: var(--pm-color-surface);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-lg);
  padding: var(--pm-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-md);
  transition: var(--pm-transition-fast);
  animation: pm-fadeUp 0.4s ease;
}

.settings-section:hover {
  box-shadow: var(--pm-shadow-md);
  transform: translateY(-2px);
}

.settings-section:nth-child(2) {
  animation-delay: 0.1s;
}

/* Section Header */
.section-header {
  padding-bottom: 12px;
  border-bottom: 2px solid transparent;
  border-image: var(--pm-gradient-main) 1;
  border-image-slice: 1;
  margin-bottom: 8px;
}

.section-header h4 {
  margin: 0 0 8px 0;
  font-size: var(--pm-font-size-lg);
  font-weight: 600;
  color: var(--pm-text-default);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-header h4::before {
  content: '⚙️';
  font-size: 20px;
}

.section-header p {
  margin: 0;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-muted);
  line-height: 1.5;
}

/* Form Grid */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--pm-space-md);
}

/* Form Group */
.pm-form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: pm-fadeIn 0.3s ease;
}

.pm-form-group.full-width {
  grid-column: 1 / -1;
}

.pm-form-group label {
  font-size: var(--pm-font-size-sm);
  font-weight: 500;
  color: var(--pm-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.pm-form-group label::before {
  content: '◆';
  font-size: 8px;
  color: var(--pm-color-primary);
}

/* Input Styles */
.pm-input {
  width: 100%;
  height: 44px;
  padding: 0 18px;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-default);
  background: #ffffff;
  border: 1.5px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-xl);
  outline: none;
  transition: var(--pm-transition-fast);
}

.pm-input:hover {
  border-color: var(--pm-color-primary);
}

.pm-input:focus {
  border-color: var(--pm-color-primary);
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.1);
  background: #ffffff;
}

.pm-input::placeholder {
  color: var(--pm-text-muted);
}

/* Select Styles */
.pm-select {
  width: 100%;
  height: 44px;
  padding: 0 40px 0 18px;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-default);
  background: #ffffff;
  border: 1.5px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-xl);
  outline: none;
  cursor: pointer;
  transition: var(--pm-transition-fast);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%235356FB' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 16px center;
}

.pm-select:hover {
  border-color: var(--pm-color-primary);
  background-color: rgba(83, 86, 251, 0.02);
}

.pm-select:focus {
  border-color: var(--pm-color-primary);
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.1);
  background-color: #ffffff;
}

/* Toggle Switch */
.pm-switch {
  position: relative;
  display: inline-block;
  width: 54px;
  height: 30px;
  cursor: pointer;
}

.pm-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.pm-switch .slider {
  position: absolute;
  inset: 0;
  background: var(--pm-color-border-soft);
  border-radius: var(--pm-radius-pill);
  transition: var(--pm-transition-fast);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pm-switch .slider::before {
  content: '';
  position: absolute;
  height: 24px;
  width: 24px;
  left: 3px;
  bottom: 3px;
  background: #ffffff;
  border-radius: 50%;
  transition: var(--pm-transition-fast);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.pm-switch input:checked + .slider {
  background: var(--pm-gradient-main);
}

.pm-switch input:checked + .slider::before {
  transform: translateX(24px);
}

.pm-switch:hover .slider {
  box-shadow: 0 0 8px rgba(83, 86, 251, 0.3);
}

/* Device Selector */
.device-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.05) 0%, rgba(243, 57, 248, 0.05) 100%);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-md);
}

.device-selector label {
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  color: var(--pm-text-default);
}

/* Form Actions */
.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--pm-color-border-soft);
}

.form-actions.grouped {
  justify-content: space-between;
}

/* Buttons */
.pm-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 28px;
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  border-radius: var(--pm-radius-pill);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  border: none;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.pm-button::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.pm-button:hover {
  transform: translateY(-2px);
}

.pm-button:active {
  transform: translateY(0);
}

.pm-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Primary Button */
.pm-button--primary {
  background: var(--pm-gradient-main);
  color: #ffffff;
}

.pm-button--primary::before {
  background: var(--pm-gradient-primary-reverse);
  opacity: 1;
}

.pm-button--primary:hover {
  box-shadow: 0 8px 20px rgba(243, 57, 248, 0.4);
}

.pm-button--primary:hover::before {
  opacity: 0;
}

/* Success Button */
.pm-button--success {
  background: var(--pm-color-success);
  color: #ffffff;
}

.pm-button--success::before {
  background: linear-gradient(135deg, #27AE60 0%, #229954 100%);
  opacity: 1;
}

.pm-button--success:hover {
  box-shadow: 0 8px 20px rgba(39, 174, 96, 0.4);
}

.pm-button--success:hover::before {
  opacity: 0;
}

/* Danger Button */
.pm-button--danger {
  background: var(--pm-color-danger);
  color: #ffffff;
}

.pm-button--danger::before {
  background: linear-gradient(135deg, #EB5757 0%, #E74C3C 100%);
  opacity: 1;
}

.pm-button--danger:hover {
  box-shadow: 0 8px 20px rgba(235, 87, 87, 0.4);
}

.pm-button--danger:hover::before {
  opacity: 0;
}

/* Default Button */
.pm-button--default {
  background: #ffffff;
  color: var(--pm-text-default);
  border: 1px solid var(--pm-color-border-soft);
}

.pm-button--default:hover {
  border-color: var(--pm-color-primary);
  color: var(--pm-color-primary);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.2);
}

/* Modal Footer */
.pm-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: var(--pm-space-lg) var(--pm-space-xl);
  border-top: 1px solid var(--pm-color-border-soft);
  background: var(--pm-color-surface);
}

/* Loading State */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 40px;
}

.loading span {
  font-size: var(--pm-font-size-base);
  color: var(--pm-text-muted);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--pm-color-border-soft);
  border-top-color: var(--pm-color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error Message */
.pm-error {
  padding: 16px 20px;
  background: rgba(235, 87, 87, 0.1);
  border: 1px solid rgba(235, 87, 87, 0.3);
  border-radius: var(--pm-radius-md);
  color: var(--pm-color-danger);
  font-size: var(--pm-font-size-sm);
  margin: 0;
  animation: pm-fadeIn 0.3s ease;
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
    transform: scale(0.9);
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
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar Styling */
.pm-modal__body::-webkit-scrollbar {
  width: 8px;
}

.pm-modal__body::-webkit-scrollbar-track {
  background: var(--pm-color-surface);
  border-radius: 10px;
}

.pm-modal__body::-webkit-scrollbar-thumb {
  background: var(--pm-color-border-soft);
  border-radius: 10px;
  transition: var(--pm-transition-fast);
}

.pm-modal__body::-webkit-scrollbar-thumb:hover {
  background: var(--pm-color-primary);
}

/* Responsive */
@media (max-width: 767px) {
  .pm-modal-backdrop {
    padding: var(--pm-space-md);
  }

  .pm-modal {
    max-width: 100%;
  }

  .pm-modal__header,
  .pm-modal__body,
  .pm-modal__footer {
    padding: var(--pm-space-md);
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-actions.grouped {
    flex-direction: column-reverse;
  }

  .pm-button {
    width: 100%;
  }
}
</style>
