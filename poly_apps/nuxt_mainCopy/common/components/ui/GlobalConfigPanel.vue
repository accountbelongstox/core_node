<template>
  <div class="global-config-panel">
    <div class="config-section">
      <h3 class="config-title">{{ t('theme') }}</h3>
      <div class="config-options">
        <button
          v-for="themeOption in themeOptions"
          :key="themeOption.value"
          :class="['config-btn', { active: theme === themeOption.value }]"
          @click="setTheme(themeOption.value)"
        >
          <span class="icon">{{ themeOption.icon }}</span>
          <span>{{ themeOption.label }}</span>
        </button>
      </div>
    </div>

    <div class="config-section">
      <h3 class="config-title">{{ t('language') }}</h3>
      <div class="language-grid">
        <button
          v-for="lang in availableLanguages"
          :key="lang.code"
          :class="['language-btn', { active: currentLanguage.code === lang.code }]"
          @click="changeLanguage(lang.code)"
        >
          <span class="flag-icon">{{ getFlagEmoji(lang.flag) }}</span>
          <span class="lang-name">{{ lang.nativeName }}</span>
        </button>
      </div>
    </div>

    <div class="config-section">
      <h3 class="config-title">{{ t('direction') }}</h3>
      <div class="config-options">
        <button
          :class="['config-btn', { active: !isRTL }]"
          @click="setRTL('ltr')"
        >
          <span>{{ t('ltr') }}</span>
        </button>
        <button
          :class="['config-btn', { active: isRTL }]"
          @click="setRTL('rtl')"
        >
          <span>{{ t('rtl') }}</span>
        </button>
      </div>
    </div>

    <div class="config-section">
      <h3 class="config-title">{{ t('layout') }}</h3>
      <div class="config-options">
        <button
          :class="['config-btn', { active: config.layout === 'full' }]"
          @click="setLayout('full')"
        >
          <span>{{ t('full') }}</span>
        </button>
        <button
          :class="['config-btn', { active: config.layout === 'boxed-layout' }]"
          @click="setLayout('boxed-layout')"
        >
          <span>{{ t('boxed') }}</span>
        </button>
      </div>
    </div>

    <div class="config-section">
      <div class="config-actions">
        <button class="btn-reset" @click="resetToDefaults">
          {{ t('reset') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGlobalConfig } from '@/common/composables/useGlobalConfig';
import { useI18nConfig } from '@/common/composables/useI18nConfig';
import type { ThemeMode, LayoutType, DirectionType } from '@/common/stores/app-config-store';

const { theme, isRTL, config, setTheme, setLayout, setRTL, resetToDefaults } = useGlobalConfig();
const { currentLanguage, availableLanguages, changeLanguage, t } = useI18nConfig();

const themeOptions = computed(() => [
  { value: 'light' as ThemeMode, label: t('light'), icon: '☀️' },
  { value: 'dark' as ThemeMode, label: t('dark'), icon: '🌙' },
  { value: 'system' as ThemeMode, label: 'System', icon: '💻' },
]);

const getFlagEmoji = (countryCode: string): string => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};
</script>

<style scoped>
.global-config-panel {
  padding: 1.5rem;
  background: var(--color-light);
  border-radius: 0.5rem;
}

.config-section {
  margin-bottom: 1.5rem;
}

.config-section:last-child {
  margin-bottom: 0;
}

.config-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--color-dark);
}

.config-options {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.config-btn {
  flex: 1;
  min-width: 100px;
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-primary);
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 500;
}

.config-btn:hover {
  background: var(--color-primary);
  color: white;
}

.config-btn.active {
  background: var(--color-primary);
  color: white;
}

.icon {
  font-size: 1.25rem;
}

.language-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.5rem;
}

.language-btn {
  padding: 0.75rem;
  border: 2px solid var(--color-primary);
  background: white;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
}

.language-btn:hover {
  background: var(--color-primary);
  color: white;
}

.language-btn.active {
  background: var(--color-primary);
  color: white;
}

.flag-icon {
  font-size: 1.5rem;
}

.lang-name {
  font-size: 0.875rem;
}

.config-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-reset {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid var(--color-danger);
  background: white;
  color: var(--color-danger);
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: var(--color-danger);
  color: white;
}

.dark .global-config-panel {
  background: var(--color-dark);
}

.dark .config-title {
  color: var(--color-light);
}

.dark .config-btn,
.dark .language-btn {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-light);
}

.dark .config-btn:hover,
.dark .language-btn:hover {
  background: var(--color-primary);
}

.dark .btn-reset {
  background: rgba(255, 255, 255, 0.1);
}
</style>
