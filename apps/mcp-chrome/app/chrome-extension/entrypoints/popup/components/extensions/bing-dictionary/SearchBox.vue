<template>
  <div class="search-box">
    <input
      :value="searchQuery"
      @input="onInput"
      @keyup.enter="onSearch"
      type="text"
      placeholder="Enter word to look up..."
      class="search-input"
    />
    <button
      class="search-button"
      @click="onSearch"
      :disabled="isLoading || !searchQuery"
    >
      {{ isLoading ? '[LOADING...]' : '[SEARCH]' }}
    </button>
  </div>

  <div v-if="isLoading" class="loading-state">
    <span class="loading-spinner"></span>
    <span>Looking up word...</span>
  </div>

  <div v-if="error" class="error-message">
    <span class="error-icon">[!]</span>
    <span>{{ error }}</span>
  </div>
</template>

<script lang="ts" setup>
interface Props {
  searchQuery: string;
  isLoading: boolean;
  error: string;
}

interface Emits {
  (e: 'update:searchQuery', value: string): void;
  (e: 'search'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:searchQuery', target.value);
};

const onSearch = () => {
  emit('search');
};
</script>
