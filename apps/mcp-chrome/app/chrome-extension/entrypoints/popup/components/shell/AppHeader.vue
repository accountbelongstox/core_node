<template>
  <header class="app-header">
    <div class="brand-lockup">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M13 2 4 14h7v8l9-13h-7V2Z" /></svg>
      </span>
      <div>
        <h1>{{ getMessage('headerTitle') }}</h1>
        <p>{{ getMessage('headerSubtitle') }}</p>
      </div>
    </div>

    <div class="app-header__actions">
      <LatestCodeFileWidget />
      <EndpointDropdown />
      <LanguageSelector />
      <button v-if="!isTabView" class="icon-button" :title="getMessage('openPersistentTab')" @click="openInTab">
        <svg viewBox="0 0 24 24"><path d="M14 3h7v7m0-7L10 14M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></svg>
      </button>
      <button class="icon-button" :title="getMessage(theme === 'dark' ? 'useLightTheme' : 'useDarkTheme')" @click="toggleTheme">
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>
      </button>
      <span class="connection-pill" :class="{ 'connection-pill--ready': isReady }">
        <span class="status-dot" :class="{ 'status-dot--success': isReady }" />
        {{ getMessage(isReady ? 'onlineStatus' : 'offlineStatus') }}
      </span>
    </div>
  </header>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useServerConnection } from '../../composables/useServerConnection';
import { useTheme } from '../../composables/useTheme';
import { getMessage } from '@/utils/i18n';
import EndpointDropdown from '../EndpointDropdown.vue';
import LanguageSelector from '../LanguageSelector.vue';
import LatestCodeFileWidget from '../LatestCodeFileWidget.vue';

defineProps<{ isTabView: boolean }>();

const { isReady } = useServerConnection();
const { theme, toggleTheme, initTheme } = useTheme();
const openInTab = () => chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?view=tab') });

onMounted(initTheme);
</script>
