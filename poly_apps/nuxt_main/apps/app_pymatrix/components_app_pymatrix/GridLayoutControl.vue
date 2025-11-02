<template>
  <div class="grid-layout-control">
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
          class="column-btn"
          :class="{ 'is-active': gridColumns === option.value }"
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
        class="reset-btn"
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
import { useUIPreferencesStore } from '../stores_app_pymatrix/uiPreferencesStore';
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

<style scoped>
.grid-layout-control {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  min-width: 280px;
}

.control-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-icon {
  font-size: 20px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.label-icon {
  font-size: 14px;
}

.label-text {
  flex: 1;
}

.column-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.column-btn {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.column-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
  transform: translateY(-1px);
}

.column-btn.is-active {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #3b82f6;
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.column-btn.is-active:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
  transform: translateY(-1px);
}

.reset-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.reset-icon {
  font-size: 16px;
}

.reset-text {
  font-size: 13px;
}

.control-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.info-label {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.info-value {
  color: rgba(255, 255, 255, 0.95);
  font-weight: 700;
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 4px;
}
</style>
