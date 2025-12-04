<template>
  <div class="pm-topbar__search">
    <div class="pm-form-group pm-form-group--inline">
      <span class="pm-input__icon">🔍</span>
      <input
        v-model="searchQuery"
        type="text"
        class="pm-input"
        :placeholder="placeholder"
        @input="handleInput"
        @keydown.esc="handleClear"
      />
      <button
        v-if="searchQuery"
        class="pm-button pm-button--sm pm-button--ghost"
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
import { useDeviceStore } from '@/app_pymatrix_pages/stores/deviceStore';

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
