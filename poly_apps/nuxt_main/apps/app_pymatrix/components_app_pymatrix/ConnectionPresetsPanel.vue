<template>
  <BasePanel
    :show="show"
    size="xl"
    title="Connection Presets"
    title-icon="⚙️"
    @close="emit('close')"
  >
    <template #body>
      <div class="presets-container">
        <!-- Toolbar -->
        <div class="presets-toolbar">
          <BaseButton
            variant="primary"
            size="sm"
            @click="showCreateDialog = true"
          >
            <span class="btn-icon">➕</span>
            Create Preset
          </Button>

          <div class="toolbar-spacer"></div>

          <BaseButton
            variant="outline"
            size="sm"
            @click="handleExport"
          >
            <span class="btn-icon">📤</span>
            Export
          </BaseButton>

          <BaseButton
            variant="outline"
            size="sm"
            @click="handleImport"
          >
            <span class="btn-icon">📥</span>
            Import
          </BaseButton>

          <BaseButton
            variant="outline"
            size="sm"
            @click="handleResetDefaults"
          >
            <span class="btn-icon">🔄</span>
            Reset
          </BaseButton>
        </div>

        <!-- Presets List -->
        <div class="presets-list">
          <!-- Default Presets -->
          <div v-if="presetsStore.defaultPresets.length > 0" class="preset-section">
            <h4 class="section-title">Default Presets</h4>
            <div class="preset-cards">
              <div
                v-for="preset in presetsStore.defaultPresets"
                :key="preset.id"
                class="preset-card"
                :class="{ 'is-active': presetsStore.activePresetId === preset.id }"
              >
                <div class="preset-card-header">
                  <div class="preset-info">
                    <h5 class="preset-name">{{ preset.name }}</h5>
                    <p v-if="preset.description" class="preset-description">
                      {{ preset.description }}
                    </p>
                  </div>
                  <span v-if="presetsStore.activePresetId === preset.id" class="active-badge">
                    ✓ Active
                  </span>
                </div>

                <div class="preset-config">
                  <div class="config-item">
                    <span class="config-label">Resolution:</span>
                    <span class="config-value">{{ preset.config.max_size }}px</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">Bit Rate:</span>
                    <span class="config-value">{{ formatBitRate(preset.config.bit_rate) }}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">FPS:</span>
                    <span class="config-value">{{ preset.config.max_fps }}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">Codec:</span>
                    <span class="config-value">{{ preset.config.codec.toUpperCase() }}</span>
                  </div>
                </div>

                <div class="preset-actions">
                  <BaseButton
                    variant="primary"
                    size="xs"
                    @click="handleSelectPreset(preset.id)"
                  >
                    {{ presetsStore.activePresetId === preset.id ? 'Selected' : 'Select' }}
                  </BaseButton>
                  <BaseButton
                    variant="outline"
                    size="xs"
                    @click="handleDuplicatePreset(preset.id)"
                  >
                    Duplicate
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Presets -->
          <div v-if="presetsStore.customPresets.length > 0" class="preset-section">
            <h4 class="section-title">Custom Presets</h4>
            <div class="preset-cards">
              <div
                v-for="preset in presetsStore.customPresets"
                :key="preset.id"
                class="preset-card"
                :class="{ 'is-active': presetsStore.activePresetId === preset.id }"
              >
                <div class="preset-card-header">
                  <div class="preset-info">
                    <h5 class="preset-name">{{ preset.name }}</h5>
                    <p v-if="preset.description" class="preset-description">
                      {{ preset.description }}
                    </p>
                  </div>
                  <span v-if="presetsStore.activePresetId === preset.id" class="active-badge">
                    ✓ Active
                  </span>
                </div>

                <div class="preset-config">
                  <div class="config-item">
                    <span class="config-label">Resolution:</span>
                    <span class="config-value">{{ preset.config.max_size }}px</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">Bit Rate:</span>
                    <span class="config-value">{{ formatBitRate(preset.config.bit_rate) }}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">FPS:</span>
                    <span class="config-value">{{ preset.config.max_fps }}</span>
                  </div>
                  <div class="config-item">
                    <span class="config-label">Codec:</span>
                    <span class="config-value">{{ preset.config.codec.toUpperCase() }}</span>
                  </div>
                </div>

                <div class="preset-actions">
                  <BaseButton
                    variant="primary"
                    size="xs"
                    @click="handleSelectPreset(preset.id)"
                  >
                    {{ presetsStore.activePresetId === preset.id ? 'Selected' : 'Select' }}
                  </BaseButton>
                  <BaseButton
                    variant="outline"
                    size="xs"
                    @click="handleEditPreset(preset)"
                  >
                    Edit
                  </BaseButton>
                  <BaseButton
                    variant="outline"
                    size="xs"
                    @click="handleDuplicatePreset(preset.id)"
                  >
                    Duplicate
                  </BaseButton>
                  <BaseButton
                    variant="danger"
                    size="xs"
                    @click="handleDeletePreset(preset.id)"
                  >
                    Delete
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="presetsStore.customPresets.length === 0" class="empty-state">
            <p class="empty-message">No custom presets yet. Create one to get started!</p>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="presets-footer">
        <BaseButton
          variant="ghost"
          @click="emit('close')"
        >
          Close
        </BaseButton>
      </div>
    </template>
  </BasePanel>

  <!-- Create/Edit Preset Dialog -->
  <div v-if="showCreateDialog" class="dialog-overlay" @click.self="closeCreateDialog">
    <div class="dialog-content">
      <div class="dialog-header">
        <h3 class="dialog-title">{{ editingPreset ? 'Edit Preset' : 'Create Preset' }}</h3>
        <button class="dialog-close-btn" @click="closeCreateDialog">×</button>
      </div>

      <form class="dialog-body" @submit.prevent="handleSavePreset">
        <div class="form-group">
          <label class="form-label">Preset Name</label>
          <input
            v-model="presetForm.name"
            type="text"
            class="form-input"
            placeholder="Enter preset name"
            required
          />
          <p v-if="nameError" class="form-error">{{ nameError }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">Description (optional)</label>
          <textarea
            v-model="presetForm.description"
            class="form-input"
            placeholder="Enter preset description"
            rows="2"
          ></textarea>
        </div>

        <div class="config-grid">
          <div class="form-group">
            <label class="form-label">Max Resolution (px)</label>
            <input
              v-model.number="presetForm.config.max_size"
              type="number"
              class="form-input"
              min="120"
              max="4320"
              step="10"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Bit Rate (bps)</label>
            <input
              v-model.number="presetForm.config.bit_rate"
              type="number"
              class="form-input"
              min="100000"
              max="20000000"
              step="100000"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Max FPS</label>
            <input
              v-model.number="presetForm.config.max_fps"
              type="number"
              class="form-input"
              min="1"
              max="120"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Video Codec</label>
            <select v-model="presetForm.config.codec" class="form-input">
              <option value="h264">H.264</option>
              <option value="h265">H.265</option>
              <option value="av1">AV1</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Orientation</label>
            <select v-model.number="presetForm.config.locked_video_orientation" class="form-input">
              <option :value="-1">Auto</option>
              <option :value="0">0°</option>
              <option :value="1">90°</option>
              <option :value="2">180°</option>
              <option :value="3">270°</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Enable Control</label>
            <BaseToggle
              :model-value="presetForm.config.control"
              @update:model-value="presetForm.config.control = $event"
            />
          </div>
        </div>

        <div class="dialog-footer">
          <BaseButton
            variant="ghost"
            type="button"
            @click="closeCreateDialog"
          >
            Cancel
          </BaseButton>
          <BaseButton
            variant="primary"
            type="submit"
          >
            {{ editingPreset ? 'Update' : 'Create' }}
          </BaseButton>
        </div>
      </form>
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
</BasePanel>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';
import { useConnectionPresetsStore, type ConnectionPreset } from '../stores_app_pymatrix/connectionPresetsStore';
import { useToast } from '../composables_app_pymatrix/useToast';
import type { DeviceConfig } from '../../../types/pymatrix';

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

<style scoped>
.presets-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 600px;
}

.presets-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.toolbar-spacer {
  flex: 1;
}

.btn-icon {
  font-size: 14px;
  margin-right: 6px;
}

.presets-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.preset-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.preset-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.preset-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.preset-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.preset-card.is-active {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.5);
}

.preset-card-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  margin-bottom: 12px;
}

.preset-info {
  flex: 1;
}

.preset-name {
  font-size: 16px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 4px 0;
}

.preset-description {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  line-height: 1.4;
}

.active-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #3b82f6;
  white-space: nowrap;
}

.preset-config {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.config-label {
  color: rgba(255, 255, 255, 0.6);
}

.config-value {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 600;
}

.preset-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-message {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}

.presets-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Create/Edit Dialog Styles */
.dialog-overlay {
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

.dialog-content {
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.98) 0%, rgba(30, 30, 30, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-title {
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
}

.dialog-close-btn {
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

.dialog-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 1);
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.form-input {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(59, 130, 246, 0.5);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.form-error {
  font-size: 12px;
  color: #ef4444;
  margin: 0;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
