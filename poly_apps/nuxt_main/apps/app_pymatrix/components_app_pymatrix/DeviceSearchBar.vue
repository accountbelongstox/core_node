<template>
  <div class="device-search-bar">
    <div class="search-input-wrapper">
      <span class="search-icon">🔍</span>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        @input="handleInput"
        @keydown.esc="handleClear"
      />
      <button
        v-if="searchQuery"
        class="clear-button"
        type="button"
        title="Clear search"
        @click="handleClear"
      >
        ✕
      </button>
    </div>
    <div v-if="showResultCount" class="search-result-count">
      {{ resultText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDeviceStore } from '../stores_app_pymatrix/deviceStore';

interface Props {
  placeholder?: string;
  showResultCount?: boolean;
  debounceMs?: number;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Search devices by name, serial, or model...',
  showResultCount: true,
  debounceMs: 300
});

const deviceStore = useDeviceStore();

// Local search query (for immediate UI feedback)
const searchQuery = ref(deviceStore.filters.searchQuery);

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Handle input changes with debouncing
 */
const handleInput = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    deviceStore.setSearchQuery(searchQuery.value);
  }, props.debounceMs);
};

/**
 * Clear search query
 */
const handleClear = () => {
  searchQuery.value = '';
  deviceStore.clearSearchQuery();
};

/**
 * Sync local state with store when store changes externally
 */
watch(
  () => deviceStore.filters.searchQuery,
  (newValue) => {
    if (newValue !== searchQuery.value) {
      searchQuery.value = newValue;
    }
  }
);

/**
 * Compute result text based on filtered count
 */
const resultText = computed(() => {
  const filteredCount = deviceStore.filteredDeviceCount;
  const totalCount = deviceStore.deviceCount;

  if (!searchQuery.value && !deviceStore.hasActiveFilters) {
    return `${totalCount} device${totalCount !== 1 ? 's' : ''}`;
  }

  return `${filteredCount} of ${totalCount} device${totalCount !== 1 ? 's' : ''}`;
});
</script>

<style scoped>
.device-search-bar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 1rem;
  font-size: 1.25rem;
  pointer-events: none;
  opacity: 0.5;
}

.search-input {
  width: 100%;
  padding: 0.75rem 3rem 0.75rem 3rem;
  font-size: 0.95rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  background-color: #ffffff;
  color: #1f2937;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.clear-button {
  position: absolute;
  right: 1rem;
  padding: 0.25rem 0.5rem;
  font-size: 1.25rem;
  line-height: 1;
  color: #6b7280;
  background: none;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-button:hover {
  color: #374151;
  background-color: #f3f4f6;
}

.clear-button:active {
  transform: scale(0.95);
}

.search-result-count {
  padding-left: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .search-input {
    border-color: #374151;
    background-color: #1f2937;
    color: #f9fafb;
  }

  .search-input:focus {
    border-color: #60a5fa;
    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
  }

  .search-input::placeholder {
    color: #6b7280;
  }

  .clear-button {
    color: #9ca3af;
  }

  .clear-button:hover {
    color: #d1d5db;
    background-color: #374151;
  }

  .search-result-count {
    color: #9ca3af;
  }
}
</style>
