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
    <div class="pm-panel pm-panel--sunset">
      <!-- Device Selection -->
      <div class="pm-section">
        <h4 class="pm-section-title">
          <span class="pm-section-icon">📱</span>
          Select Devices
          <span class="pm-device-count">({{ selectedDevices.length }} selected)</span>
        </h4>
        <div class="pm-device-selection">
          <div class="pm-device-actions">
            <button class="pm-button pm-button--sm" @click="selectAllDevices">Select All</button>
            <button class="pm-button pm-button--sm" @click="deselectAllDevices">Deselect All</button>
            <button class="pm-button pm-button--sm" @click="selectOnlineOnly">Online Only</button>
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
      <div class="pm-section">
        <h4 class="pm-section-title">
          <span class="pm-section-icon">📋</span>
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
      <div class="pm-section">
        <h4 class="pm-section-title">
          <span class="pm-section-icon">🎛️</span>
          Configuration Options
          <button class="pm-button pm-button--link" @click="toggleSelectAllOptions">
            {{ allOptionsSelected ? 'Deselect All' : 'Select All' }}
          </button>
        </h4>
        <div class="pm-config-options">
          <div
            v-for="option in configOptions"
            :key="option.key"
            class="pm-form-group"
            :class="{ 'pm-form-group--disabled': !option.applicable }"
          >
            <label class="pm-form-label">
              <input
                type="checkbox"
                v-model="option.enabled"
                :disabled="!option.applicable"
              />
              <div class="pm-option-info">
                <span class="pm-option-name">{{ option.name }}</span>
                <span class="pm-option-desc">{{ option.description }}</span>
              </div>
            </label>
            <div v-if="option.enabled && option.hasValue" class="pm-option-value">
              <input
                v-if="option.type === 'number'"
                type="number"
                v-model.number="option.value"
                :min="option.min"
                :max="option.max"
                class="pm-input"
              />
              <select
                v-else-if="option.type === 'select'"
                v-model="option.value"
                class="pm-select"
              >
                <option v-for="choice in option.choices" :key="choice" :value="choice">
                  {{ choice }}
                </option>
              </select>
              <input
                v-else
                type="text"
                v-model="option.value"
                class="pm-input"
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
      <div class="pm-footer-actions">
        <button class="pm-button pm-button--secondary" @click="handleClose">Cancel</button>
        <button class="pm-button pm-button--success" @click="applyConfiguration" :disabled="!canApply">
          <span v-if="isApplying" class="pm-spinner"></span>
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

