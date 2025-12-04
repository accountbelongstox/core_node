<template>
  <div class="pm-panel pm-panel--purple">
    <!-- Filter Header -->
    <div class="pm-panel__header">
      <h3 class="pm-panel__title">
        <span class="pm-panel__title-icon">🎛️</span>
        Filters
      </h3>
      <button
        v-if="deviceStore.hasActiveFilters"
        class="pm-button pm-button--sm pm-button--danger pm-button--outline"
        type="button"
        @click="handleClearAll"
      >
        Clear All
      </button>
    </div>

    <!-- Connection State Filter -->
    <div class="pm-panel__body">
      <div class="pm-form-group">
        <label class="pm-form-label">Connection State</label>
        <div class="pm-flex pm-flex-col pm-gap-2">
          <label
            v-for="state in connectionStates"
            :key="state.value"
            class="pm-checkbox"
          >
            <input
              type="checkbox"
              class="pm-checkbox__input"
              :checked="deviceStore.filters.stateFilter.includes(state.value)"
              @change="handleStateToggle(state.value)"
            />
            <span class="pm-checkbox__box"></span>
            <span class="pm-checkbox__label pm-flex pm-items-center pm-gap-2">
              <span :class="['pm-status-dot', `pm-status-dot--${state.value === 'connected' ? 'online' : state.value === 'connecting' ? 'connecting' : 'offline'}`]"></span>
              {{ state.label }}
            </span>
          </label>
        </div>
      </div>

      <!-- Model Filter -->
      <div v-if="availableModels.length > 0" class="pm-form-group">
        <label class="pm-form-label">Device Model</label>
        <div class="pm-flex pm-flex-col pm-gap-2">
          <label
            v-for="model in availableModels"
            :key="model"
            class="pm-checkbox"
          >
            <input
              type="checkbox"
              class="pm-checkbox__input"
              :checked="deviceStore.filters.modelFilter.includes(model)"
              @change="handleModelToggle(model)"
            />
            <span class="pm-checkbox__box"></span>
            <span class="pm-checkbox__label">{{ model }}</span>
          </label>
        </div>
      </div>

      <!-- Streaming Filter -->
      <div class="pm-form-group">
        <label class="pm-form-label">Streaming Status</label>
        <div class="pm-flex pm-flex-col pm-gap-2">
          <label
            v-for="option in streamingOptions"
            :key="option.value"
            class="pm-radio"
          >
            <input
              type="radio"
              class="pm-radio__input"
              name="streaming-filter"
              :checked="deviceStore.filters.streamingFilter === option.value"
              @change="handleStreamingChange(option.value)"
            />
            <span class="pm-radio__circle"></span>
            <span class="pm-radio__label">{{ option.label }}</span>
          </label>
        </div>
      </div>

      <!-- Tag Filter -->
      <div v-if="tagsStore.allTags.length > 0" class="pm-form-group">
        <label class="pm-form-label">Tags</label>
        <div class="pm-flex pm-flex-row pm-gap-2" style="flex-wrap: wrap;">
          <DeviceTagBadge
            v-for="tag in tagsStore.allTags"
            :key="tag.id"
            :label="tag.name"
            :color="tag.color"
            size="sm"
            :clickable="true"
            @click="handleTagToggle(tag.id)"
            :class="{ 'pm-tag-badge--selected': deviceStore.filters.tagFilter.includes(tag.id) }"
          />
        </div>
        <div v-if="deviceStore.filters.tagFilter.length > 0" class="pm-form-help">
          Showing devices with all selected tags
        </div>
      </div>

      <!-- Active Filters Summary -->
      <div v-if="activeFilterCount > 0" class="pm-panel pm-panel--blue pm-p-4">
        <div class="pm-text-base pm-font-semibold pm-mb-2">
          {{ activeFilterCount }} active filter{{ activeFilterCount !== 1 ? 's' : '' }}
        </div>
        <div class="pm-flex pm-gap-2" style="flex-wrap: wrap;">
          <span
            v-for="tag in activeFilterTags"
            :key="tag"
            class="pm-badge pm-badge--info"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDeviceStore } from '@/app_pymatrix_pages/stores/deviceStore';
import { useTagsStore } from '@/app_pymatrix_pages/stores/tagsStore';
import DeviceTagBadge from '@/common/components/ui/DeviceTagBadge.vue';

const deviceStore = useDeviceStore();
const tagsStore = useTagsStore();

/**
 * Connection state options
 */
const connectionStates = [
  { value: 'connected' as const, label: 'Connected' },
  { value: 'disconnected' as const, label: 'Disconnected' },
  { value: 'connecting' as const, label: 'Connecting' }
];

/**
 * Streaming status options
 */
const streamingOptions = [
  { value: null, label: 'All' },
  { value: true, label: 'Streaming' },
  { value: false, label: 'Not Streaming' }
];

/**
 * Get available models from store
 */
const availableModels = computed(() => deviceStore.availableModels);

/**
 * Handle connection state toggle
 */
const handleStateToggle = (state: 'connected' | 'disconnected' | 'connecting') => {
  deviceStore.toggleStateFilter(state);
};

/**
 * Handle model filter toggle
 */
const handleModelToggle = (model: string) => {
  deviceStore.toggleModelFilter(model);
};

/**
 * Handle streaming filter change
 */
const handleStreamingChange = (value: boolean | null) => {
  deviceStore.setStreamingFilter(value);
};

/**
 * Handle tag filter toggle
 */
const handleTagToggle = (tagId: string) => {
  deviceStore.toggleTagFilter(tagId);
};

/**
 * Clear all filters
 */
const handleClearAll = () => {
  deviceStore.clearFilters();
};

/**
 * Count active filters
 */
const activeFilterCount = computed(() => {
  let count = 0;
  const filters = deviceStore.filters;

  if (filters.searchQuery.trim()) count++;
  if (filters.stateFilter.length > 0) count++;
  if (filters.modelFilter.length > 0) count++;
  if (filters.streamingFilter !== null) count++;
  if (filters.groupFilter.length > 0) count++;
  if (filters.tagFilter.length > 0) count++;

  return count;
});

/**
 * Generate active filter tags
 */
const activeFilterTags = computed(() => {
  const tags: string[] = [];
  const filters = deviceStore.filters;

  if (filters.searchQuery.trim()) {
    tags.push(`Search: "${filters.searchQuery}"`);
  }

  if (filters.stateFilter.length > 0) {
    tags.push(`State: ${filters.stateFilter.length}`);
  }

  if (filters.modelFilter.length > 0) {
    tags.push(`Model: ${filters.modelFilter.length}`);
  }

  if (filters.streamingFilter !== null) {
    tags.push(filters.streamingFilter ? 'Streaming' : 'Not Streaming');
  }

  if (filters.groupFilter.length > 0) {
    tags.push(`Groups: ${filters.groupFilter.length}`);
  }

  if (filters.tagFilter.length > 0) {
    tags.push(`Tags: ${filters.tagFilter.length}`);
  }

  return tags;
});
</script>
