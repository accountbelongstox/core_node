<template>
  <label class="language-selector" :title="getMessage('languageSelectorLabel')">
    <span class="sr-only">{{ getMessage('languageSelectorLabel') }}</span>
    <select v-model="currentLanguage" @change="changeLanguage">
      <option v-for="locale in LOCALES" :key="locale.id" :value="locale.id">
        {{ locale.shortLabel }}
      </option>
    </select>
  </label>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { localStorage } from '@/services/ExtensionStorage';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { getCurrentLocale, getMessage } from '@/utils/i18n';

const LOCALES = [
  { id: 'en', shortLabel: 'EN' },
  { id: 'zh_CN', shortLabel: '简中' },
  { id: 'zh_TW', shortLabel: '繁中' },
  { id: 'de', shortLabel: 'DE' },
  { id: 'ja', shortLabel: '日本語' },
  { id: 'ko', shortLabel: '한국어' },
] as const;
const currentLanguage = ref(getCurrentLocale());

const changeLanguage = async () => {
  await localStorage.set(STORAGE_KEYS.USER_LANGUAGE, currentLanguage.value);
  window.location.reload();
};
</script>

<style scoped>
.language-selector select {
  min-width: 52px;
  padding: 5px 7px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 750;
  background: var(--surface-2);
  border-color: var(--border);
}
</style>
