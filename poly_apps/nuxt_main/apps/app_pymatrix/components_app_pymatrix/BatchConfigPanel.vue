<template>
  <BaseModal
    v-model="isOpen"
    title="Batch Device Configuration"
    header-icon="⚙️"
    size="xl"
    variant="primary"
    :closable="true"
    :close-on-overlay="!hasUnsavedChanges"
    @close="handleClose"
  >
    <!-- Configuration Content -->
    <div class="batch-config-container">
      <!-- Device Selection -->
      <div class="section">
        <h4 class="section-title">
          <span class="section-icon">📱</span>
          Select Devices
          <span class="device-count">({{ selectedDevices.length }} selected)</span>
        </h4>
        <div class="device-selection">
          <div class="device-actions">
            <button class="btn btn-sm" @click="selectAllDevices">Select All</button>
            <button class="btn btn-sm" @click="deselectAllDevices">Deselect All</button>
            <button class="btn btn-sm" @click="selectOnlineOnly">Online Only</button>
          </div>
          <div class="device-list">
            <div
              v-for="device in availableDevices"
              :key="device.serial"
              class="device-item"
              :class="{ selected: isDeviceSelected(device.serial), offline: !device.connected }"
              @click="toggleDevice(device.serial)"
            >
              <input type="checkbox" :checked="isDeviceSelected(device.serial)" @click.stop />
              <div class="device-info">
                <span class="device-name">{{ device.deviceName }}</span>
                <span class="device-serial">{{ device.serial }}</span>
                <span v-if="!device.connected" class="device-status offline">Offline</span>
                <span v-else class="device-status online">Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Template Selection -->
      <div class="section">
        <h4 class="section-title">
          <span class="section-icon">📋</span>
          Configuration Template
        </h4>
        <div class="template-selection">
          <button
            v-for="template in configTemplates"
            :key="template.id"
            class="template-btn"
            :class="{ active: selectedTemplate === template.id }"
            @click="selectTemplate(template.id)"
          >
            <span class="template-icon">{{ template.icon }}</span>
            <span class="template-name">{{ template.name }}</span>
            <p class="template-desc">{{ template.description }}</p>
          </button>
        </div>
      </div>

      <!-- Configuration Options -->
      <div class="section">
        <h4 class="section-title">
          <span class="section-icon">🎛️</span>
          Configuration Options
          <button class="btn-link" @click="toggleSelectAllOptions">
            {{ allOptionsSelected ? 'Deselect All' : 'Select All' }}
          </button>
        </h4>
        <div class="config-options">
          <div
            v-for="option in configOptions"
            :key="option.key"
            class="config-option"
            :class="{ disabled: !option.applicable }"
          >
            <label class="option-label">
              <input
                type="checkbox"
                v-model="option.enabled"
                :disabled="!option.applicable"
              />
              <div class="option-info">
                <span class="option-name">{{ option.name }}</span>
                <span class="option-desc">{{ option.description }}</span>
              </div>
            </label>
            <div v-if="option.enabled && option.hasValue" class="option-value">
              <input
                v-if="option.type === 'number'"
                type="number"
                v-model.number="option.value"
                :min="option.min"
                :max="option.max"
                class="input-field"
              />
              <select
                v-else-if="option.type === 'select'"
                v-model="option.value"
                class="select-field"
              >
                <option v-for="choice in option.choices" :key="choice" :value="choice">
                  {{ choice }}
                </option>
              </select>
              <input
                v-else
                type="text"
                v-model="option.value"
                class="input-field"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Conflict Resolution -->
      <div v-if="conflicts.length > 0" class="section section-warning">
        <h4 class="section-title">
          <span class="section-icon">⚠️</span>
          Configuration Conflicts
        </h4>
        <div class="conflicts-list">
          <div v-for="(conflict, index) in conflicts" :key="index" class="conflict-item">
            <span class="conflict-message">{{ conflict.message }}</span>
            <button class="btn btn-sm" @click="resolveConflict(conflict)">Resolve</button>
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div class="section">
        <h4 class="section-title">
          <span class="section-icon">👁️</span>
          Configuration Preview
        </h4>
        <div class="config-preview">
          <div class="preview-summary">
            <div class="summary-item">
              <span class="label">Devices:</span>
              <span class="value">{{ selectedDevices.length }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Options:</span>
              <span class="value">{{ enabledOptionsCount }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Template:</span>
              <span class="value">{{
                selectedTemplate ? getTemplateName(selectedTemplate) : 'Custom'
              }}</span>
            </div>
          </div>
          <div class="preview-code">
            <pre>{{ configPreviewJson }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <template #footer>
      <div class="footer-actions">
        <button class="btn btn-secondary" @click="handleClose">Cancel</button>
        <button class="btn btn-success" @click="applyConfiguration" :disabled="!canApply">
          <span v-if="isApplying" class="spinner"></span>
          <span>{{ isApplying ? 'Applying...' : 'Apply Configuration' }}</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseModal from '~/common/components/ui/BaseModal.vue';
import { useDeviceList } from '~/apps/app_pymatrix/composables_app_pymatrix/useDeviceList';

interface ConfigTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  config: Record<string, any>;
}

interface ConfigOption {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  applicable: boolean;
  hasValue: boolean;
  type?: 'number' | 'text' | 'select';
  value?: any;
  min?: number;
  max?: number;
  choices?: string[];
}

interface Conflict {
  message: string;
  deviceSerial: string;
  optionKey: string;
}

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'applied', config: any): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { devices } = useDeviceList();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const selectedDevices = ref<string[]>([]);
const selectedTemplate = ref<string | null>(null);
const isApplying = ref(false);
const hasUnsavedChanges = ref(false);
const conflicts = ref<Conflict[]>([]);

// Configuration Templates
const configTemplates = ref<ConfigTemplate[]>([
  {
    id: 'gaming',
    name: 'Gaming',
    icon: '🎮',
    description: 'High performance for gaming (60fps, low latency)',
    config: {
      videoQuality: 'high',
      maxFps: 60,
      bitrate: 8000000,
      screenPower: 'on',
      brightness: 255,
      screenRotation: 0
    }
  },
  {
    id: 'streaming',
    name: 'Streaming',
    icon: '📹',
    description: 'Optimized for live streaming (balanced quality)',
    config: {
      videoQuality: 'medium',
      maxFps: 30,
      bitrate: 4000000,
      screenPower: 'on',
      brightness: 200,
      screenRotation: 0
    }
  },
  {
    id: 'battery-saver',
    name: 'Battery Saver',
    icon: '🔋',
    description: 'Low power consumption (low fps, low brightness)',
    config: {
      videoQuality: 'low',
      maxFps: 15,
      bitrate: 1000000,
      screenPower: 'on',
      brightness: 100,
      screenRotation: 0
    }
  },
  {
    id: 'testing',
    name: 'Testing',
    icon: '🧪',
    description: 'Standard settings for app testing',
    config: {
      videoQuality: 'medium',
      maxFps: 30,
      bitrate: 3000000,
      screenPower: 'on',
      brightness: 150,
      screenRotation: 0
    }
  }
]);

// Configuration Options
const configOptions = ref<ConfigOption[]>([
  {
    key: 'videoQuality',
    name: 'Video Quality',
    description: 'Streaming video quality preset',
    enabled: true,
    applicable: true,
    hasValue: true,
    type: 'select',
    value: 'medium',
    choices: ['low', 'medium', 'high', 'ultra']
  },
  {
    key: 'maxFps',
    name: 'Max FPS',
    description: 'Maximum frames per second for video stream',
    enabled: true,
    applicable: true,
    hasValue: true,
    type: 'number',
    value: 30,
    min: 10,
    max: 60
  },
  {
    key: 'bitrate',
    name: 'Bitrate',
    description: 'Video bitrate in bps',
    enabled: true,
    applicable: true,
    hasValue: true,
    type: 'number',
    value: 4000000,
    min: 500000,
    max: 10000000
  },
  {
    key: 'screenPower',
    name: 'Screen Power',
    description: 'Turn screen on/off',
    enabled: true,
    applicable: true,
    hasValue: true,
    type: 'select',
    value: 'on',
    choices: ['on', 'off', 'toggle']
  },
  {
    key: 'brightness',
    name: 'Screen Brightness',
    description: 'Screen brightness level (0-255)',
    enabled: true,
    applicable: true,
    hasValue: true,
    type: 'number',
    value: 150,
    min: 0,
    max: 255
  },
  {
    key: 'screenRotation',
    name: 'Screen Rotation',
    description: 'Screen rotation angle',
    enabled: false,
    applicable: true,
    hasValue: true,
    type: 'select',
    value: 0,
    choices: ['0', '90', '180', '270']
  }
]);

const availableDevices = computed(() => {
  return devices.value || [];
});

const allOptionsSelected = computed(() => {
  return configOptions.value.every(opt => opt.enabled || !opt.applicable);
});

const enabledOptionsCount = computed(() => {
  return configOptions.value.filter(opt => opt.enabled).length;
});

const canApply = computed(() => {
  return selectedDevices.value.length > 0 && enabledOptionsCount.value > 0 && !isApplying.value;
});

const configPreviewJson = computed(() => {
  const config: Record<string, any> = {};
  configOptions.value.forEach(opt => {
    if (opt.enabled && opt.hasValue) {
      config[opt.key] = opt.value;
    }
  });
  return JSON.stringify({ devices: selectedDevices.value, config }, null, 2);
});

function isDeviceSelected(serial: string): boolean {
  return selectedDevices.value.includes(serial);
}

function toggleDevice(serial: string) {
  const index = selectedDevices.value.indexOf(serial);
  if (index >= 0) {
    selectedDevices.value.splice(index, 1);
  } else {
    selectedDevices.value.push(serial);
  }
  hasUnsavedChanges.value = true;
}

function selectAllDevices() {
  selectedDevices.value = availableDevices.value.map(d => d.serial);
  hasUnsavedChanges.value = true;
}

function deselectAllDevices() {
  selectedDevices.value = [];
  hasUnsavedChanges.value = true;
}

function selectOnlineOnly() {
  selectedDevices.value = availableDevices.value
    .filter(d => d.connected)
    .map(d => d.serial);
  hasUnsavedChanges.value = true;
}

function selectTemplate(templateId: string) {
  selectedTemplate.value = templateId;
  const template = configTemplates.value.find(t => t.id === templateId);
  if (template) {
    // Apply template config to options
    Object.entries(template.config).forEach(([key, value]) => {
      const option = configOptions.value.find(o => o.key === key);
      if (option) {
        option.enabled = true;
        option.value = value;
      }
    });
    hasUnsavedChanges.value = true;
  }
}

function toggleSelectAllOptions() {
  const newValue = !allOptionsSelected.value;
  configOptions.value.forEach(opt => {
    if (opt.applicable) {
      opt.enabled = newValue;
    }
  });
  hasUnsavedChanges.value = true;
}

function getTemplateName(templateId: string): string {
  const template = configTemplates.value.find(t => t.id === templateId);
  return template?.name || 'Unknown';
}

function resolveConflict(conflict: Conflict) {
  // Remove conflict
  const index = conflicts.value.findIndex(
    c => c.deviceSerial === conflict.deviceSerial && c.optionKey === conflict.optionKey
  );
  if (index >= 0) {
    conflicts.value.splice(index, 1);
  }
}

async function applyConfiguration() {
  if (!canApply.value) return;

  isApplying.value = true;
  conflicts.value = [];

  try {
    // Build configuration
    const config: Record<string, any> = {};
    configOptions.value.forEach(opt => {
      if (opt.enabled && opt.hasValue) {
        config[opt.key] = opt.value;
      }
    });

    // Call backend API to apply configuration
    const response = await $fetch('/api/devices/batch/configure', {
      method: 'POST',
      body: {
        devices: selectedDevices.value,
        config
      }
    });

    console.log('[BatchConfigPanel] Configuration applied:', response);

    // Emit success
    emit('applied', { devices: selectedDevices.value, config, response });

    // Show success message
    // (You can integrate with your toast notification system here)
    alert(`Configuration applied to ${selectedDevices.value.length} devices successfully!`);

    hasUnsavedChanges.value = false;
    handleClose();
  } catch (error) {
    console.error('[BatchConfigPanel] Failed to apply configuration:', error);
    alert('Failed to apply configuration. Please try again.');
  } finally {
    isApplying.value = false;
  }
}

function handleClose() {
  if (hasUnsavedChanges.value) {
    const confirmed = confirm('You have unsaved changes. Are you sure you want to close?');
    if (!confirmed) return;
  }
  emit('update:modelValue', false);
  // Reset state
  selectedDevices.value = [];
  selectedTemplate.value = null;
  hasUnsavedChanges.value = false;
  conflicts.value = [];
}

// Watch for template changes
watch(selectedTemplate, (newTemplate) => {
  if (newTemplate) {
    console.log('[BatchConfigPanel] Template selected:', newTemplate);
  }
});
</script>

<style scoped>
.batch-config-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  background: #ffffff;
}

.section-warning {
  border-color: #fbbf24;
  background: #fef3c7;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
}

.section-icon {
  font-size: 1.25rem;
}

.device-count {
  margin-left: auto;
  font-size: 0.875rem;
  font-weight: normal;
  color: #6b7280;
}

/* Device Selection */
.device-selection {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.device-actions {
  display: flex;
  gap: 0.5rem;
}

.device-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #f9fafb;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.device-item:hover {
  border-color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.device-item.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}

.device-item.offline {
  opacity: 0.6;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.device-name {
  font-weight: 500;
  color: #111827;
  font-size: 0.875rem;
}

.device-serial {
  font-size: 0.75rem;
  color: #6b7280;
}

.device-status {
  font-size: 0.75rem;
  font-weight: 500;
}

.device-status.online {
  color: #10b981;
}

.device-status.offline {
  color: #ef4444;
}

/* Template Selection */
.template-selection {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.template-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.template-btn:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.template-btn.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.template-icon {
  font-size: 2rem;
}

.template-name {
  font-weight: 600;
  color: #111827;
}

.template-desc {
  margin: 0;
  font-size: 0.75rem;
  color: #6b7280;
  text-align: center;
}

/* Config Options */
.config-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-option {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: white;
}

.config-option.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  cursor: pointer;
}

.option-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.option-name {
  font-weight: 500;
  color: #111827;
}

.option-desc {
  font-size: 0.875rem;
  color: #6b7280;
}

.option-value {
  min-width: 150px;
}

.input-field,
.select-field {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.input-field:focus,
.select-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Conflicts */
.conflicts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.conflict-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border: 1px solid #f59e0b;
  border-radius: 4px;
  background: white;
}

.conflict-message {
  color: #92400e;
  font-size: 0.875rem;
}

/* Preview */
.config-preview {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #f9fafb;
}

.summary-item .label {
  font-size: 0.875rem;
  color: #6b7280;
}

.summary-item .value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.preview-code {
  max-height: 200px;
  overflow-y: auto;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: #1f2937;
}

.preview-code pre {
  margin: 0;
  color: #e5e7eb;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Footer */
.footer-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

/* Buttons */
.btn {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover:not(:disabled) {
  background: #e5e7eb;
}

.btn-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.btn-success:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
}

.btn-link {
  padding: 0;
  border: none;
  background: none;
  color: #3b82f6;
  font-size: 0.875rem;
  cursor: pointer;
  margin-left: auto;
}

.btn-link:hover {
  text-decoration: underline;
}

.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
