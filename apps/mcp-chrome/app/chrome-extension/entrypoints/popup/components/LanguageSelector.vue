<template>
  <div class="flex flex-col items-end">
    <select
      v-model="currentLanguage"
      @change="changeLanguage"
      class="bg-transparent text-[10px] font-bold text-slate-400 border-none focus:ring-0 p-0 hover:text-indigo-400 transition-colors cursor-pointer text-right"
    >
      <option value="en" class="bg-slate-900 text-slate-200">ENGLISH / EN</option>
      <option value="zh_CN" class="bg-slate-900 text-slate-200">CHINESE / ZH</option>
      <option value="zh_TW" class="bg-slate-900 text-slate-200">繁體中文</option>
      <option value="de" class="bg-slate-900 text-slate-200">Deutsch</option>
      <option value="ja" class="bg-slate-900 text-slate-200">日本語</option>
      <option value="ko" class="bg-slate-900 text-slate-200">한국어</option>
    </select>
    <span class="text-[8px] text-slate-600 font-mono tracking-tighter">{{ getMessage('languageSelectorLabel') }}</span>
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

