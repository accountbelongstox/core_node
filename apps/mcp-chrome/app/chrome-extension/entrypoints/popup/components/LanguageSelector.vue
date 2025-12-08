<template>
  <div class="language-selector">
    <label class="selector-label">
      <span class="label-text">{{ getMessage('languageSelectorLabel') }}</span>
      <select v-model="currentLanguage" @change="changeLanguage" class="language-select">
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

<style scoped>
.language-selector {
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 16px;
}

.selector-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.label-text {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.language-select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.language-select:hover {
  border-color: #8b5cf6;
}

.language-select:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}
</style>
