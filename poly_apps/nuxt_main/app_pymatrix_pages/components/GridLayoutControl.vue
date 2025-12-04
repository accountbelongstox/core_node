<template>
  <div class="pm-layout-toggle">
    <div class="control-header">
      <span class="header-icon">⚙️</span>
      <span class="header-title">Grid Layout</span>
    </div>

    <div class="control-section">
      <label class="control-label">
        <span class="label-icon">📐</span>
        <span class="label-text">Columns</span>
      </label>
      <div class="column-buttons">
        <button
          v-for="option in columnOptions"
          :key="option.value"
          class="pm-button pm-button--sm pm-button--primary"
          :class="{ 'pm-button--active': gridColumns === option.value }"
          :title="option.label"
          @click="handleColumnChange(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="control-section">
      <label class="control-label">
        <span class="label-icon">🔄</span>
        <span class="label-text">Drag to Reorder</span>
      </label>
      <BaseToggle
        :model-value="dragEnabled"
        size="sm"
        @update:model-value="emit('update:dragEnabled', $event)"
      />
    </div>

    <div class="control-section">
      <button
        class="pm-button pm-button--sm pm-button--danger"
        :disabled="isDefault"
        @click="handleReset"
      >
        <span class="reset-icon">↺</span>
        <span class="reset-text">Reset Layout</span>
      </button>
    </div>

    <div class="control-info">
      <div class="info-item">
        <span class="info-label">Devices:</span>
        <span class="info-value">{{ deviceCount }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Effective Columns:</span>
        <span class="info-value">{{ effectiveColumns }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useUIPreferencesStore } from '@/app_pymatrix_pages/stores/uiPreferencesStore';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';

interface Props {
  deviceCount: number;
  dragEnabled?: boolean;
}

interface Emits {
  (e: 'update:dragEnabled', value: boolean): void;
  (e: 'reset'): void;
}

const props = withDefaults(defineProps<Props>(), {
  dragEnabled: false
});

const emit = defineEmits<Emits>();

const uiPreferencesStore = useUIPreferencesStore();

const columnOptions = [
  { value: 0, label: 'Auto' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' }
];

const gridColumns = computed(() => uiPreferencesStore.gridColumns);

const effectiveColumns = computed(() =>
  uiPreferencesStore.getEffectiveColumns(props.deviceCount)
);

const isDefault = computed(() =>
  uiPreferencesStore.gridColumns === 0 &&
  uiPreferencesStore.deviceOrder.length === 0
);

function handleColumnChange(columns: number) {
  uiPreferencesStore.setGridColumns(columns);
  console.log('[GridLayoutControl] Columns changed to:', columns === 0 ? 'auto' : columns);
}

function handleReset() {
  uiPreferencesStore.resetGridLayout();
  emit('reset');
  console.log('[GridLayoutControl] Layout reset');
}
</script>
