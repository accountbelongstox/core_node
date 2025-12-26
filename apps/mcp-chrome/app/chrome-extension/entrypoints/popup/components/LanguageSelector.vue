<template>
  <div class="flex items-center gap-2">
    <label class="flex items-center gap-2">
      <span class="text-sm font-medium text-white">{{ getMessage('languageSelectorLabel') }}</span>
      <select v-model="currentLanguage" @change="changeLanguage" class="px-3 py-1.5 bg-white bg-opacity-20 text-white border border-white border-opacity-30 rounded-lg text-sm font-medium cursor-pointer hover:bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all">
        <option value="en">English</option>
        <option value="zh_CN">简体中文</option>
        <option value="zh_TW">繁體中文</option>
        <option value="de">Deutsch</option>
        <option value="ja">日本語</option>
        <option value="ko">한국어</option>
      </select>
    </label>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { getMessage } from '../../../utils/i18n';

const currentLanguage = ref<string>('en');

const loadLanguagePreference = async () => {
  try {
    const result = await chrome.storage.local.get(['userLanguage']);
    if (result.userLanguage) {
      currentLanguage.value = result.userLanguage;
    } else {
      // Try to detect browser language
      const browserLang = navigator.language || 'en';
      if (browserLang.startsWith('zh-CN') || browserLang.startsWith('zh_CN')) {
        currentLanguage.value = 'zh_CN';
      } else if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh_TW') || browserLang.startsWith('zh-HK')) {
        currentLanguage.value = 'zh_TW';
      } else if (browserLang.startsWith('de')) {
        currentLanguage.value = 'de';
      } else if (browserLang.startsWith('ja')) {
        currentLanguage.value = 'ja';
      } else if (browserLang.startsWith('ko')) {
        currentLanguage.value = 'ko';
      } else {
        currentLanguage.value = 'en';
      }
      // Save detected language
      await chrome.storage.local.set({ userLanguage: currentLanguage.value });
    }
  } catch (error) {
    console.error('Failed to load language preference:', error);
    currentLanguage.value = 'en';
  }
};

const changeLanguage = async () => {
  try {
    await chrome.storage.local.set({ userLanguage: currentLanguage.value });
    // Reload the page to apply language changes
    window.location.reload();
  } catch (error) {
    console.error('Failed to save language preference:', error);
  }
};

onMounted(() => {
  loadLanguagePreference();
});
</script>

