<template>
  <BasePanel
    :model-value="show"
    title="Device Tag Manager"
    size="lg"
    @close="handleClose"
  >
    <template #header-icon>
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    </template>

    <div class="pm-panel pm-panel--purple">
      <!-- Create/Edit Tag Form -->
      <div class="pm-tag-form-section">
        <h3 class="pm-section-title">
          {{ editingTag ? 'Edit Tag' : 'Create New Tag' }}
        </h3>
        <div class="pm-tag-form">
          <div class="pm-form-group">
            <label class="pm-form-label">Tag Name</label>
            <input
              v-model="formData.name"
              type="text"
              class="pm-input"
              placeholder="Enter tag name"
              maxlength="20"
              @keydown.enter="handleSaveTag"
            />
            <span class="pm-char-counter">{{ formData.name.length }}/20</span>
          </div>

          <div class="pm-form-group">
            <label class="pm-form-label">Color</label>
            <div class="pm-color-picker">
              <input
                v-model="formData.color"
                type="color"
                class="pm-color-input"
              />
              <input
                v-model="formData.color"
                type="text"
                class="pm-input"
                placeholder="#3b82f6"
                maxlength="7"
              />
              <div class="pm-color-presets">
                <button
                  v-for="preset in colorPresets"
                  :key="preset"
                  class="pm-color-preset-btn"
                  :style="{ backgroundColor: preset }"
                  @click="formData.color = preset"
                  :aria-label="`Select ${preset} color`"
                />
              </div>
            </div>
          </div>

          <div class="pm-form-group">
            <label class="pm-form-label">Description (Optional)</label>
            <textarea
              v-model="formData.description"
              class="pm-textarea"
              placeholder="Add a description for this tag"
              rows="2"
              maxlength="100"
            ></textarea>
            <span class="pm-char-counter">{{ (formData.description || '').length }}/100</span>
          </div>

          <div class="pm-form-actions">
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
      <div class="pm-tags-list-section">
        <div class="pm-section-header">
          <h3 class="pm-section-title">All Tags ({{ tagsStore.allTags.length }})</h3>
          <div class="pm-section-actions">
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
        <div v-if="tagsStore.predefinedTags.length > 0" class="pm-tags-group">
          <h4 class="pm-group-title">Predefined Tags</h4>
          <div class="pm-tags-grid">
            <div
              v-for="tag in tagsStore.predefinedTags"
              :key="tag.id"
              class="pm-tag-card pm-tag-card--predefined"
            >
              <div class="pm-tag-card-header">
                <DeviceTagBadge :label="tag.name" :color="tag.color" size="md" />
                <span class="pm-tag-badge">{{ tag.usageCount }} devices</span>
              </div>
              <p v-if="tag.description" class="pm-tag-description">
                {{ tag.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Custom Tags -->
        <div v-if="tagsStore.customTags.length > 0" class="pm-tags-group">
          <h4 class="pm-group-title">Custom Tags</h4>
          <div class="pm-tags-grid">
            <div
              v-for="tag in tagsStore.customTags"
              :key="tag.id"
              class="pm-tag-card pm-tag-card--custom"
            >
              <div class="pm-tag-card-header">
                <DeviceTagBadge :label="tag.name" :color="tag.color" size="md" />
                <div class="pm-tag-actions">
                  <span class="pm-tag-badge">{{ tag.usageCount }}</span>
                  <button
                    class="pm-button pm-button--ghost pm-button--icon"
                    @click="startEdit(tag)"
                    title="Edit tag"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    class="pm-button pm-button--danger pm-button--icon"
                    @click="handleDeleteTag(tag)"
                    title="Delete tag"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <p v-if="tag.description" class="pm-tag-description">
                {{ tag.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="tagsStore.customTags.length === 0" class="pm-empty-state">
          <svg class="pm-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p class="pm-empty-text">No custom tags yet</p>
          <p class="pm-empty-hint">Create your first tag using the form above</p>
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

