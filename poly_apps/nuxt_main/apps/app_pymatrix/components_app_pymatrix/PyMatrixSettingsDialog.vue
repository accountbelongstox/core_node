<template>
  <div class="pymatrix-dialog-overlay" @click="$emit('close')">
    <div class="pymatrix-dialog" @click.stop>
      <div class="pymatrix-dialog__header">
        <h3 class="pymatrix-dialog__title">Configuration</h3>
        <button class="pymatrix-dialog__close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="pymatrix-dialog__body">
        <div v-if="configStore.loading" class="pymatrix-dialog__loading">
          <div class="pymatrix-dialog__spinner"></div>
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
                class="pymatrix-dialog__form-group"
              >
                <label class="pymatrix-dialog__form-label">{{ field.label }}</label>
                <template v-if="field.type === 'number'">
                  <input
                    v-model.number="globalForm[field.key]"
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
                    v-model.number="globalForm[field.key]"
                    class="pymatrix-dialog__form-input"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <select
                    v-else
                    v-model="globalForm[field.key]"
                    class="pymatrix-dialog__form-input"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </template>
                <template v-else-if="field.type === 'toggle'">
                  <label class="pymatrix-dialog__switch">
                    <input type="checkbox" v-model="globalForm[field.key]" />
                    <span class="slider"></span>
                  </label>
                </template>
              </div>

              <div class="form-actions">
                <button class="pymatrix-dialog__button pymatrix-dialog__button--primary" type="submit" :disabled="savingGlobal">
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
              <label class="pymatrix-dialog__form-label">Select existing override</label>
              <select v-model="selectedDeviceKey" class="pymatrix-dialog__form-input">
                <option value="">— None —</option>
                <option v-for="name in deviceNames" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
            </div>

            <form class="form-grid" @submit.prevent="saveDevice">
              <div class="pymatrix-dialog__form-group full-width">
                <label class="pymatrix-dialog__form-label">Device Name</label>
                <input
                  v-model="deviceNameInput"
                  class="pymatrix-dialog__form-input"
                  type="text"
                  placeholder="e.g. Samsung S23"
                  required
                />
              </div>

              <div
                v-for="field in configFields"
                :key="`device-${field.key}`"
                class="pymatrix-dialog__form-group"
              >
                <label class="pymatrix-dialog__form-label">{{ field.label }}</label>
                <template v-if="field.type === 'number'">
                  <input
                    v-model.number="deviceForm[field.key]"
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
                    v-model.number="deviceForm[field.key]"
                    class="pymatrix-dialog__form-input"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <select
                    v-else
                    v-model="deviceForm[field.key]"
                    class="pymatrix-dialog__form-input"
                  >
                    <option v-for="option in field.options" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </template>
                <template v-else-if="field.type === 'toggle'">
                  <label class="pymatrix-dialog__switch">
                    <input type="checkbox" v-model="deviceForm[field.key]" />
                    <span class="slider"></span>
                  </label>
                </template>
              </div>

              <div class="form-actions grouped">
                <button
                  class="pymatrix-dialog__button pymatrix-dialog__button--primary"
                  type="submit"
                  :disabled="savingDevice || !deviceNameInput.trim()"
                >
                  {{ savingDevice ? 'Saving...' : 'Save Override' }}
                </button>
                <button
                  class="pymatrix-dialog__button pymatrix-dialog__button--danger"
                  type="button"
                  :disabled="!selectedDeviceKey"
                  @click="deleteDevice"
                >
                  Remove Override
                </button>
              </div>
            </form>
          </section>

          <p v-if="configStore.error" class="pymatrix-dialog__error">
            {{ configStore.error }}
          </p>
        </template>
      </div>

      <div class="pymatrix-dialog__footer">
        <button class="pymatrix-dialog__button" @click="$emit('close')">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useConfigStore } from '../stores_app_pymatrix/configStore';
import { DEVICE_CONFIG_FIELDS, type DeviceConfigField } from '../config_app_pymatrix/deviceConfigFields';
import type { DeviceConfig } from '../../../types/pymatrix';

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

<style scoped src="../assets/css/dialog.css"></style>
<style scoped>
.settings-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.section-header p {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.pymatrix-dialog__form-group.full-width {
  grid-column: 1 / -1;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.form-actions.grouped {
  justify-content: space-between;
}

.device-selector {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-section .pymatrix-dialog__form-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
</style>
