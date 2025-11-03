<template>
  <div class="device-filter-panel">
    <!-- Filter Header -->
    <div class="filter-header">
      <h3 class="filter-title">
        <span class="filter-icon">🎛️</span>
        Filters
      </h3>
      <button
        v-if="deviceStore.hasActiveFilters"
        class="clear-all-button"
        type="button"
        @click="handleClearAll"
      >
        Clear All
      </button>
    </div>

    <!-- Connection State Filter -->
    <div class="filter-section">
      <h4 class="filter-section-title">Connection State</h4>
      <div class="filter-options">
        <label
          v-for="state in connectionStates"
          :key="state.value"
          class="filter-checkbox-label"
        >
          <input
            type="checkbox"
            class="filter-checkbox"
            :checked="deviceStore.filters.stateFilter.includes(state.value)"
            @change="handleStateToggle(state.value)"
          />
          <span class="filter-label-text">
            <span :class="['state-indicator', `state-${state.value}`]"></span>
            {{ state.label }}
          </span>
        </label>
      </div>
    </div>

    <!-- Model Filter -->
    <div v-if="availableModels.length > 0" class="filter-section">
      <h4 class="filter-section-title">Device Model</h4>
      <div class="filter-options">
        <label
          v-for="model in availableModels"
          :key="model"
          class="filter-checkbox-label"
        >
          <input
            type="checkbox"
            class="filter-checkbox"
            :checked="deviceStore.filters.modelFilter.includes(model)"
            @change="handleModelToggle(model)"
          />
          <span class="filter-label-text">
            {{ model }}
          </span>
        </label>
      </div>
    </div>

    <!-- Streaming Filter -->
    <div class="filter-section">
      <h4 class="filter-section-title">Streaming Status</h4>
      <div class="filter-options">
        <label
          v-for="option in streamingOptions"
          :key="option.value"
          class="filter-radio-label"
        >
          <input
            type="radio"
            class="filter-radio"
            name="streaming-filter"
            :checked="deviceStore.filters.streamingFilter === option.value"
            @change="handleStreamingChange(option.value)"
          />
          <span class="filter-label-text">
            {{ option.label }}
          </span>
        </label>
      </div>
    </div>

    <!-- Tag Filter -->
    <div v-if="tagsStore.allTags.length > 0" class="filter-section">
      <h4 class="filter-section-title">Tags</h4>
      <div class="tag-filter-grid">
        <DeviceTagBadge
          v-for="tag in tagsStore.allTags"
          :key="tag.id"
          :label="tag.name"
          :color="tag.color"
          size="sm"
          :clickable="true"
          @click="handleTagToggle(tag.id)"
          :class="{ 'tag-selected': deviceStore.filters.tagFilter.includes(tag.id) }"
        />
      </div>
      <div v-if="deviceStore.filters.tagFilter.length > 0" class="tag-filter-hint">
        Showing devices with all selected tags
      </div>
    </div>

    <!-- Active Filters Summary -->
    <div v-if="activeFilterCount > 0" class="active-filters-summary">
      <div class="summary-text">
        {{ activeFilterCount }} active filter{{ activeFilterCount !== 1 ? 's' : '' }}
      </div>
      <div class="summary-tags">
        <span
          v-for="tag in activeFilterTags"
          :key="tag"
          class="filter-tag"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDeviceStore } from '../stores_app_pymatrix/deviceStore';
import { useTagsStore } from '../stores_app_pymatrix/tagsStore';
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

<style scoped>
.device-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
}

.filter-icon {
  font-size: 1.25rem;
}

.clear-all-button {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #ef4444;
  background-color: transparent;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-all-button:hover {
  color: #ffffff;
  background-color: #ef4444;
  border-color: #ef4444;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-section-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-checkbox-label,
.filter-radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.filter-checkbox-label:hover,
.filter-radio-label:hover {
  background-color: #f9fafb;
}

.filter-checkbox,
.filter-radio {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.filter-label-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
}

.state-indicator {
  display: inline-block;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
}

.state-indicator.state-connected {
  background-color: #10b981;
}

.state-indicator.state-disconnected {
  background-color: #ef4444;
}

.state-indicator.state-connecting {
  background-color: #f59e0b;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.active-filters-summary {
  padding: 1rem;
  background-color: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 0.5rem;
}

.summary-text {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e40af;
}

.summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filter-tag {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #1e40af;
  background-color: #dbeafe;
  border-radius: 0.375rem;
}

/* Tag Filter Grid */
.tag-filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag-selected {
  position: relative;
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.tag-filter-hint {
  margin-top: 0.5rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
  background-color: #f9fafb;
  border-radius: 0.375rem;
  text-align: center;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .device-filter-panel {
    background-color: #1f2937;
    border-color: #374151;
  }

  .filter-title {
    color: #f9fafb;
  }

  .clear-all-button {
    color: #f87171;
    border-color: #7f1d1d;
  }

  .clear-all-button:hover {
    color: #ffffff;
    background-color: #dc2626;
    border-color: #dc2626;
  }

  .filter-section-title {
    color: #9ca3af;
  }

  .filter-checkbox-label:hover,
  .filter-radio-label:hover {
    background-color: #374151;
  }

  .filter-label-text {
    color: #d1d5db;
  }

  .active-filters-summary {
    background-color: #1e3a8a;
    border-color: #1e40af;
  }

  .summary-text {
    color: #93c5fd;
  }

  .filter-tag {
    color: #dbeafe;
    background-color: #1e40af;
  }

  .tag-selected {
    outline-color: #60a5fa;
  }

  .tag-filter-hint {
    color: #9ca3af;
    background-color: #374151;
  }
}
</style>
