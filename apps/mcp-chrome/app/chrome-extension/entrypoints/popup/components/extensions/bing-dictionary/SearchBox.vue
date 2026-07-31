<template>
  <div class="search-box">
    <input
      :value="searchQuery"
      @input="onInput"
      @keyup.enter="onSearch"
      type="text"
      :placeholder="getMessage('dictionarySearchPlaceholder')"
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
    <span>{{ getMessage('dictionaryLookingUp') }}</span>
  </div>

  <div v-if="error" class="error-message">
    <span class="error-icon">[!]</span>
    <span>{{ error }}</span>
  </div>
</template>

<script lang="ts" setup>
import { getMessage } from '@/utils/i18n';
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
