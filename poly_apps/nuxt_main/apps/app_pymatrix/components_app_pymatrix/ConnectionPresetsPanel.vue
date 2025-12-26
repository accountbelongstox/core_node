<template>
  <div class="pm-panel pm-panel--purple">
    <div class="pm-panel__header">
      <h3>Connection Presets</h3>
      <button class="pm-button pm-button--ghost pm-button--sm" @click="emit('close')">×</button>
    </div>

    <div class="pm-panel__body">
      <!-- Toolbar -->
      <div class="presets-toolbar">
        <button class="pm-button pm-button--primary pm-button--sm" @click="showCreateDialog = true">
          <span>➕</span> Create Preset
        </button>

        <div style="flex: 1;"></div>

        <button class="pm-button pm-button--outline pm-button--sm" @click="handleExport">
          <span>📤</span> Export
        </button>

        <button class="pm-button pm-button--outline pm-button--sm" @click="handleImport">
          <span>📥</span> Import
        </button>

        <button class="pm-button pm-button--outline pm-button--sm" @click="handleResetDefaults">
          <span>🔄</span> Reset
        </button>
      </div>

      <!-- Presets List -->
      <div class="presets-list">
        <!-- Default Presets -->
        <div v-if="presetsStore.defaultPresets.length > 0" class="preset-section">
          <h4>Default Presets</h4>
          <div class="preset-cards">
            <div
              v-for="preset in presetsStore.defaultPresets"
              :key="preset.id"
              class="pm-preset-card"
              :class="{ 'is-active': presetsStore.activePresetId === preset.id }"
            >
              <div class="pm-preset-card__header">
                <div>
                  <h5 class="pm-preset-card__title">{{ preset.name }}</h5>
                  <p v-if="preset.description">{{ preset.description }}</p>
                </div>
                <span v-if="presetsStore.activePresetId === preset.id" class="pm-preset-card__badge">
                  ✓ Active
                </span>
              </div>

              <div class="pm-preset-card__config">
                <div class="pm-preset-card__config-item">
                  <span>Resolution:</span>
                  <span>{{ preset.config.max_size }}px</span>
                </div>
                <div class="pm-preset-card__config-item">
                  <span>Bit Rate:</span>
                  <span>{{ formatBitRate(preset.config.bit_rate) }}</span>
                </div>
                <div class="pm-preset-card__config-item">
                  <span>FPS:</span>
                  <span>{{ preset.config.max_fps }}</span>
                </div>
                <div class="pm-preset-card__config-item">
                  <span>Codec:</span>
                  <span>{{ preset.config.codec.toUpperCase() }}</span>
                </div>
              </div>

              <div class="preset-actions">
                <button
                  class="pm-button pm-button--primary pm-button--xs"
                  @click="handleSelectPreset(preset.id)"
                >
                  {{ presetsStore.activePresetId === preset.id ? 'Selected' : 'Select' }}
                </button>
                <button
                  class="pm-button pm-button--outline pm-button--xs"
                  @click="handleDuplicatePreset(preset.id)"
                >
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Presets -->
        <div v-if="presetsStore.customPresets.length > 0" class="preset-section">
          <h4>Custom Presets</h4>
          <div class="preset-cards">
            <div
              v-for="preset in presetsStore.customPresets"
              :key="preset.id"
              class="pm-preset-card"
              :class="{ 'is-active': presetsStore.activePresetId === preset.id }"
            >
              <div class="pm-preset-card__header">
                <div>
                  <h5 class="pm-preset-card__title">{{ preset.name }}</h5>
                  <p v-if="preset.description">{{ preset.description }}</p>
                </div>
                <span v-if="presetsStore.activePresetId === preset.id" class="pm-preset-card__badge">
                  ✓ Active
                </span>
              </div>

              <div class="pm-preset-card__config">
                <div class="pm-preset-card__config-item">
                  <span>Resolution:</span>
                  <span>{{ preset.config.max_size }}px</span>
                </div>
                <div class="pm-preset-card__config-item">
                  <span>Bit Rate:</span>
                  <span>{{ formatBitRate(preset.config.bit_rate) }}</span>
                </div>
                <div class="pm-preset-card__config-item">
                  <span>FPS:</span>
                  <span>{{ preset.config.max_fps }}</span>
                </div>
                <div class="pm-preset-card__config-item">
                  <span>Codec:</span>
                  <span>{{ preset.config.codec.toUpperCase() }}</span>
                </div>
              </div>

              <div class="preset-actions">
                <button
                  class="pm-button pm-button--primary pm-button--xs"
                  @click="handleSelectPreset(preset.id)"
                >
                  {{ presetsStore.activePresetId === preset.id ? 'Selected' : 'Select' }}
                </button>
                <button
                  class="pm-button pm-button--outline pm-button--xs"
                  @click="handleEditPreset(preset)"
                >
                  Edit
                </button>
                <button
                  class="pm-button pm-button--outline pm-button--xs"
                  @click="handleDuplicatePreset(preset.id)"
                >
                  Duplicate
                </button>
                <button
                  class="pm-button pm-button--danger pm-button--xs"
                  @click="handleDeletePreset(preset.id)"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="presetsStore.customPresets.length === 0" class="empty-state">
          <p>No custom presets yet. Create one to get started!</p>
        </div>
      </div>
    </div>

    <div class="pm-panel__footer">
      <button class="pm-button pm-button--ghost" @click="emit('close')">
        Close
      </button>
    </div>
  </div>

  <!-- Create/Edit Preset Dialog -->
  <div v-if="showCreateDialog" class="pm-panel pm-panel--purple dialog-overlay" @click.self="closeCreateDialog">
    <div class="pm-panel dialog-content">
      <div class="pm-panel__header">
        <h3>{{ editingPreset ? 'Edit Preset' : 'Create Preset' }}</h3>
        <button class="pm-button pm-button--ghost" @click="closeCreateDialog">×</button>
      </div>

      <form class="pm-panel__body" @submit.prevent="handleSavePreset">
        <div class="pm-form-group">
          <label class="pm-form-label">Preset Name</label>
          <input
            v-model="presetForm.name"
            type="text"
            class="pm-input"
            placeholder="Enter preset name"
            required
          />
          <p v-if="nameError" style="color: #ef4444; font-size: 12px; margin: 0;">{{ nameError }}</p>
        </div>

        <div class="pm-form-group">
          <label class="pm-form-label">Description (optional)</label>
          <textarea
            v-model="presetForm.description"
            class="pm-textarea"
            placeholder="Enter preset description"
            rows="2"
          ></textarea>
        </div>

        <div class="config-grid">
          <div class="pm-form-group">
            <label class="pm-form-label">Max Resolution (px)</label>
            <input
              v-model.number="presetForm.config.max_size"
              type="number"
              class="pm-input"
              min="120"
              max="4320"
              step="10"
            />
          </div>

          <div class="pm-form-group">
            <label class="pm-form-label">Bit Rate (bps)</label>
            <input
              v-model.number="presetForm.config.bit_rate"
              type="number"
              class="pm-input"
              min="100000"
              max="20000000"
              step="100000"
            />
          </div>

          <div class="pm-form-group">
            <label class="pm-form-label">Max FPS</label>
            <input
              v-model.number="presetForm.config.max_fps"
              type="number"
              class="pm-input"
              min="1"
              max="120"
            />
          </div>

          <div class="pm-form-group">
            <label class="pm-form-label">Video Codec</label>
            <select v-model="presetForm.config.codec" class="pm-input">
              <option value="h264">H.264</option>
              <option value="h265">H.265</option>
              <option value="av1">AV1</option>
            </select>
          </div>

          <div class="pm-form-group">
            <label class="pm-form-label">Orientation</label>
            <select v-model.number="presetForm.config.locked_video_orientation" class="pm-input">
              <option :value="-1">Auto</option>
              <option :value="0">0°</option>
              <option :value="1">90°</option>
              <option :value="2">180°</option>
              <option :value="3">270°</option>
            </select>
          </div>

          <div class="pm-form-group">
            <label class="pm-form-label">Enable Control</label>
            <BaseToggle
              :model-value="presetForm.config.control"
              @update:model-value="presetForm.config.control = $event"
            />
          </div>
        </div>
      </form>

      <div class="pm-panel__footer">
        <button class="pm-button pm-button--ghost" type="button" @click="closeCreateDialog">
          Cancel
        </button>
        <button class="pm-button pm-button--primary" type="submit" @click="handleSavePreset">
          {{ editingPreset ? 'Update' : 'Create' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Hidden file input for import -->
  <input
    ref="fileInput"
    type="file"
    accept=".json"
    style="display: none"
    @change="handleFileSelect"
  />
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';
import { useConnectionPresetsStore, type ConnectionPreset } from '@/app_pymatrix_pages/stores/connectionPresetsStore';
import { useToast } from '@/app_pymatrix_pages/composables/useToast';
import type { DeviceConfig } from '@/types/pymatrix';

interface Props {
  show?: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'preset-selected', presetId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: false
});

const emit = defineEmits<Emits>();

const presetsStore = useConnectionPresetsStore();
const toast = useToast();

// Load presets on mount
presetsStore.loadPresets();

// Create/Edit Dialog
const showCreateDialog = ref(false);
const editingPreset = ref<ConnectionPreset | null>(null);
const nameError = ref('');

const presetForm = reactive<{
  name: string;
  description: string;
  config: DeviceConfig;
}>({
  name: '',
  description: '',
  config: {
    max_size: 1280,
    bit_rate: 4000000,
    max_fps: 30,
    codec: 'h264',
    control: true,
    locked_video_orientation: -1
  }
});

// File input ref for import
const fileInput = ref<HTMLInputElement | null>(null);

// Format bit rate for display
function formatBitRate(bitRate: number): string {
  if (bitRate >= 1000000) {
    return `${(bitRate / 1000000).toFixed(1)} Mbps`;
  }
  return `${(bitRate / 1000).toFixed(0)} Kbps`;
}

// Reset form
function resetForm() {
  presetForm.name = '';
  presetForm.description = '';
  presetForm.config = {
    max_size: 1280,
    bit_rate: 4000000,
    max_fps: 30,
    codec: 'h264',
    control: true,
    locked_video_orientation: -1
  };
  nameError.value = '';
}

// Close create dialog
function closeCreateDialog() {
  showCreateDialog.value = false;
  editingPreset.value = null;
  resetForm();
}

// Handle select preset
function handleSelectPreset(presetId: string) {
  presetsStore.setActivePreset(presetId);
  emit('preset-selected', presetId);
  toast.success('Preset Selected', `Preset "${presetsStore.findPreset(presetId)?.name}" is now active`);
}

// Handle edit preset
function handleEditPreset(preset: ConnectionPreset) {
  editingPreset.value = preset;
  presetForm.name = preset.name;
  presetForm.description = preset.description || '';
  presetForm.config = { ...preset.config };
  showCreateDialog.value = true;
}

// Handle save preset
function handleSavePreset() {
  // Validate name
  if (!presetForm.name.trim()) {
    nameError.value = 'Preset name is required';
    return;
  }

  // Check for name conflict
  if (presetsStore.presetNameExists(presetForm.name, editingPreset.value?.id)) {
    nameError.value = 'A preset with this name already exists';
    return;
  }

  if (editingPreset.value) {
    // Update existing preset
    presetsStore.updatePreset(editingPreset.value.id, {
      name: presetForm.name.trim(),
      description: presetForm.description.trim() || undefined,
      config: { ...presetForm.config }
    });
    toast.success('Preset Updated', `Preset "${presetForm.name}" has been updated`);
  } else {
    // Create new preset
    const presetId = presetsStore.createPreset({
      name: presetForm.name.trim(),
      description: presetForm.description.trim() || undefined,
      config: { ...presetForm.config },
      isDefault: false
    });
    toast.success('Preset Created', `Preset "${presetForm.name}" has been created`);

    // Auto-select the new preset
    presetsStore.setActivePreset(presetId);
    emit('preset-selected', presetId);
  }

  closeCreateDialog();
}

// Handle duplicate preset
function handleDuplicatePreset(presetId: string) {
  const newId = presetsStore.duplicatePreset(presetId);
  if (newId) {
    const preset = presetsStore.findPreset(newId);
    toast.success('Preset Duplicated', `Preset "${preset?.name}" has been created`);
  }
}

// Handle delete preset
function handleDeletePreset(presetId: string) {
  const preset = presetsStore.findPreset(presetId);
  if (!preset) return;

  if (confirm(`Are you sure you want to delete "${preset.name}"?`)) {
    presetsStore.deletePreset(presetId);
    toast.success('Preset Deleted', `Preset "${preset.name}" has been deleted`);
  }
}

// Handle export
function handleExport() {
  try {
    const json = presetsStore.exportPresets();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pymatrix-presets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export Successful', 'Presets have been exported');
  } catch (error) {
    console.error('[ConnectionPresetsPanel] Export error:', error);
    toast.error('Export Failed', 'Failed to export presets');
  }
}

// Handle import
function handleImport() {
  fileInput.value?.click();
}

// Handle file select
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = e.target?.result as string;
      const result = presetsStore.importPresets(json);

      if (result.success > 0) {
        toast.success('Import Successful', `${result.success} preset(s) imported`);
      }
      if (result.failed > 0) {
        toast.warning('Import Partial', `${result.failed} preset(s) failed to import`);
      }
    } catch (error) {
      console.error('[ConnectionPresetsPanel] Import error:', error);
      toast.error('Import Failed', 'Failed to import presets');
    }
  };
  reader.readAsText(file);

  // Reset file input
  target.value = '';
}

// Handle reset to defaults
function handleResetDefaults() {
  if (confirm('Are you sure you want to reset all presets to defaults? All custom presets will be deleted.')) {
    presetsStore.resetToDefaults();
    toast.success('Reset Complete', 'Presets have been reset to defaults');
  }
}

// Watch for name changes to clear error
watch(() => presetForm.name, () => {
  nameError.value = '';
});
</script>
