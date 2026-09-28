<template>
  <div
    data-popup-root
    class="app-shell theme-dark"
    :class="{ 'app-shell--tab': isTabView }"
  >
    <AppHeader :is-tab-view="isTabView" />
    <AppNavigation v-model="activeTab" />

    <main class="app-content no-scrollbar">
      <ServerPanel v-show="activeTab === 'server'" />
      <DataPanel v-show="activeTab === 'data'" />
      <TaskCenterPanel v-show="activeTab === 'tasks'" />
      <ImportToolsPanel v-show="activeTab === 'import'" />
      <ExtensionsPanel v-show="activeTab === 'extensions'" />
      <AiWebPanel v-show="activeTab === 'aiweb'" />
      <AudioRecordingPanel v-show="activeTab === 'audio'" />
      <SettingsCenter v-show="activeTab === 'settings'" />
      <DebugPanel v-show="activeTab === 'debug'" />
    </main>

    <AppFooter />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { useDataManagement } from './composables/useDataManagement';
import { useDebugCenter } from './composables/useDebugCenter';
import { useServerConnection } from './composables/useServerConnection';
import type { PopupTabId } from './types';
import AiWebPanel from './components/AiWebPanel.vue';
import AudioRecordingPanel from './components/AudioRecordingPanel.vue';
import DataPanel from './components/DataPanel.vue';
import DebugPanel from './components/DebugPanel.vue';
import ExtensionsPanel from './components/ExtensionsPanel.vue';
import ImportToolsPanel from './components/ImportToolsPanel.vue';
import ServerPanel from './components/ServerPanel.vue';
import SettingsCenter from './components/SettingsCenter.vue';
import TaskCenterPanel from './components/extensions/TaskCenterPanel.vue';
import AppFooter from './components/shell/AppFooter.vue';
import AppHeader from './components/shell/AppHeader.vue';
import AppNavigation from './components/shell/AppNavigation.vue';
import './theme.css';

const isTabView = new URLSearchParams(window.location.search).get('view') === 'tab';
const activeTab = usePersistedRef<PopupTabId>('activeTab', 'server');
const serverConnection = useServerConnection();
const dataManagement = useDataManagement();
const debugCenter = useDebugCenter();

onMounted(async () => {
  await Promise.all([
    serverConnection.initialize(),
    dataManagement.initialize(),
    debugCenter.initialize(),
  ]);
});

onUnmounted(() => {
  serverConnection.dispose();
  debugCenter.dispose();
});
</script>
