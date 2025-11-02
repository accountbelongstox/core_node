<template>
  <BasePanel
    :show="show"
    title="Device Tag Manager"
    size="lg"
    @close="handleClose"
  >
    <template #header-icon>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    </template>

    <div class="tag-manager-content">
      <!-- Create/Edit Tag Form -->
      <div class="tag-form-section">
        <h3 class="section-title">
          {{ editingTag ? 'Edit Tag' : 'Create New Tag' }}
        </h3>
        <div class="tag-form">
          <div class="form-group">
            <label class="form-label">Tag Name</label>
            <input
              v-model="formData.name"
              type="text"
              class="form-input"
              placeholder="Enter tag name"
              maxlength="20"
              @keydown.enter="handleSaveTag"
            />
            <span class="char-counter">{{ formData.name.length }}/20</span>
          </div>

          <div class="form-group">
            <label class="form-label">Color</label>
            <div class="color-picker-wrapper">
              <input
                v-model="formData.color"
                type="color"
                class="color-input"
              />
              <input
                v-model="formData.color"
                type="text"
                class="color-text-input"
                placeholder="#3b82f6"
                maxlength="7"
              />
              <div class="color-presets">
                <button
                  v-for="preset in colorPresets"
                  :key="preset"
                  class="color-preset-btn"
                  :style="{ backgroundColor: preset }"
                  @click="formData.color = preset"
                  :aria-label="`Select ${preset} color`"
                />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description (Optional)</label>
            <textarea
              v-model="formData.description"
              class="form-textarea"
              placeholder="Add a description for this tag"
              rows="2"
              maxlength="100"
            />
            <span class="char-counter">{{ (formData.description || '').length }}/100</span>
          </div>

          <div class="form-actions">
            <BaseButton
              v-if="editingTag"
              size="sm"
              variant="ghost"
              @click="cancelEdit"
            >
              Cancel
            </BaseButton>
            <BaseButton
              size="sm"
              variant="primary"
              :disabled="!formData.name.trim()"
              @click="handleSaveTag"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ editingTag ? 'Update Tag' : 'Create Tag' }}
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Tags List -->
      <div class="tags-list-section">
        <div class="section-header">
          <h3 class="section-title">All Tags ({{ tagsStore.allTags.length }})</h3>
          <div class="section-actions">
            <BaseButton
              size="xs"
              variant="ghost"
              @click="handleExport"
              title="Export custom tags"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </BaseButton>
            <BaseButton
              size="xs"
              variant="ghost"
              @click="handleImport"
              title="Import tags"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </BaseButton>
            <BaseButton
              size="xs"
              variant="danger"
              @click="handleReset"
              title="Reset to defaults"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </BaseButton>
          </div>
        </div>

        <!-- Predefined Tags -->
        <div v-if="tagsStore.predefinedTags.length > 0" class="tags-group">
          <h4 class="group-title">Predefined Tags</h4>
          <div class="tags-grid">
            <div
              v-for="tag in tagsStore.predefinedTags"
              :key="tag.id"
              class="tag-card predefined"
            >
              <div class="tag-card-header">
                <DeviceTagBadge :label="tag.name" :color="tag.color" size="md" />
                <span class="tag-usage">{{ tag.usageCount }} devices</span>
              </div>
              <p v-if="tag.description" class="tag-description">
                {{ tag.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Custom Tags -->
        <div v-if="tagsStore.customTags.length > 0" class="tags-group">
          <h4 class="group-title">Custom Tags</h4>
          <div class="tags-grid">
            <div
              v-for="tag in tagsStore.customTags"
              :key="tag.id"
              class="tag-card custom"
            >
              <div class="tag-card-header">
                <DeviceTagBadge :label="tag.name" :color="tag.color" size="md" />
                <div class="tag-actions">
                  <span class="tag-usage">{{ tag.usageCount }}</span>
                  <button
                    class="tag-action-btn"
                    @click="startEdit(tag)"
                    title="Edit tag"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    class="tag-action-btn delete"
                    @click="handleDeleteTag(tag)"
                    title="Delete tag"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <p v-if="tag.description" class="tag-description">
                {{ tag.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="tagsStore.customTags.length === 0" class="empty-state">
          <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p class="empty-text">No custom tags yet</p>
          <p class="empty-hint">Create your first tag using the form above</p>
        </div>
      </div>
    </div>

    <!-- Hidden file input for import -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileImport"
    />
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useTagsStore, type DeviceTag } from '../stores_app_pymatrix/tagsStore';
import { useToast } from '../composables_app_pymatrix/useToast';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import DeviceTagBadge from '~/common/components/ui/DeviceTagBadge.vue';

interface Props {
  show: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const tagsStore = useTagsStore();
const toast = useToast();

const fileInput = ref<HTMLInputElement | null>(null);
const editingTag = ref<DeviceTag | null>(null);

const formData = reactive({
  name: '',
  color: '#3b82f6',
  description: ''
});

const colorPresets = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316'  // orange
];

function handleClose() {
  emit('close');
  resetForm();
}

function resetForm() {
  formData.name = '';
  formData.color = '#3b82f6';
  formData.description = '';
  editingTag.value = null;
}

function handleSaveTag() {
  if (!formData.name.trim()) {
    toast.warning('Please enter a tag name');
    return;
  }

  if (editingTag.value) {
    // Update existing tag
    const success = tagsStore.updateTag(editingTag.value.id, {
      name: formData.name.trim(),
      color: formData.color,
      description: formData.description?.trim() || undefined
    });

    if (success) {
      toast.success(`Tag "${formData.name}" updated successfully`);
      resetForm();
    } else {
      toast.error('Failed to update tag');
    }
  } else {
    // Create new tag
    const newTag = tagsStore.createTag({
      name: formData.name.trim(),
      color: formData.color,
      description: formData.description?.trim() || undefined
    });

    if (newTag) {
      toast.success(`Tag "${newTag.name}" created successfully`);
      resetForm();
    } else {
      toast.error('Tag with this name already exists');
    }
  }
}

function startEdit(tag: DeviceTag) {
  editingTag.value = tag;
  formData.name = tag.name;
  formData.color = tag.color;
  formData.description = tag.description || '';
}

function cancelEdit() {
  resetForm();
}

function handleDeleteTag(tag: DeviceTag) {
  if (confirm(`Delete tag "${tag.name}"? This will remove it from all devices.`)) {
    const success = tagsStore.deleteTag(tag.id);
    if (success) {
      toast.success(`Tag "${tag.name}" deleted`);
    } else {
      toast.error('Failed to delete tag');
    }
  }
}

function handleExport() {
  const json = tagsStore.exportTags();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pymatrix-tags-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Tags exported successfully');
}

function handleImport() {
  fileInput.value?.click();
}

function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const json = e.target?.result as string;
      const result = tagsStore.importTags(json);
      if (result.success) {
        toast.success(`Imported ${result.imported} tags${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}`);
      } else {
        toast.error('Failed to import tags');
      }
    } catch (error) {
      toast.error('Invalid JSON file');
    }
  };
  reader.readAsText(file);

  // Reset file input
  target.value = '';
}

function handleReset() {
  if (confirm('Reset to default tags? All custom tags will be deleted.')) {
    tagsStore.resetToDefaults();
    toast.success('Tags reset to defaults');
    resetForm();
  }
}
</script>

<style scoped>
.tag-manager-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 70vh;
  overflow-y: auto;
}

/* Form Section */
.tag-form-section {
  background: rgba(30, 41, 59, 0.5);
  border-radius: 8px;
  padding: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #f1f5f9;
}

.tag-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #cbd5e1;
}

.form-input,
.form-textarea,
.color-text-input {
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 13px;
  transition: all 0.2s ease;
}

.form-input:focus,
.form-textarea:focus,
.color-text-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.char-counter {
  position: absolute;
  right: 8px;
  top: 26px;
  font-size: 11px;
  color: #64748b;
  pointer-events: none;
}

.form-textarea + .char-counter {
  top: auto;
  bottom: 8px;
}

.color-picker-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input {
  width: 48px;
  height: 36px;
  padding: 2px;
  background: transparent;
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 6px;
  cursor: pointer;
}

.color-text-input {
  flex: 1;
  max-width: 100px;
}

.color-presets {
  display: flex;
  gap: 6px;
}

.color-preset-btn {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.color-preset-btn:hover {
  transform: scale(1.15);
  border-color: rgba(255, 255, 255, 0.5);
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Tags List Section */
.tags-list-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-actions {
  display: flex;
  gap: 6px;
}

.tags-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tags-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.tag-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(100, 116, 139, 0.2);
  border-radius: 8px;
  padding: 12px;
  transition: all 0.2s ease;
}

.tag-card:hover {
  border-color: rgba(100, 116, 139, 0.4);
  background: rgba(30, 41, 59, 0.7);
}

.tag-card.predefined {
  border-left: 3px solid #3b82f6;
}

.tag-card.custom {
  border-left: 3px solid #8b5cf6;
}

.tag-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tag-usage {
  font-size: 11px;
  color: #64748b;
}

.tag-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.tag-action-btn {
  padding: 4px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.tag-action-btn:hover {
  background: rgba(100, 116, 139, 0.2);
  color: #cbd5e1;
}

.tag-action-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.tag-description {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #475569;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: #64748b;
}

/* Scrollbar Styling */
.tag-manager-content::-webkit-scrollbar {
  width: 8px;
}

.tag-manager-content::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 4px;
}

.tag-manager-content::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 4px;
}

.tag-manager-content::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.7);
}
</style>
