<template>
  <nav class="app-navigation" :aria-label="getMessage('primaryNavigationLabel')">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="app-navigation__item"
      :class="{ 'app-navigation__item--active': modelValue === tab.id }"
      @click="$emit('update:modelValue', tab.id)"
    >
      <component :is="tab.icon" />
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script lang="ts" setup>
import {
  AudioIcon,
  DataIcon,
  DebugIcon,
  ExtensionIcon,
  ImportIcon,
  ServerIcon,
  SettingsIcon,
  TaskCenterIcon,
} from '../icons';
import type { PopupTabId } from '../../types';
import { getMessage } from '@/utils/i18n';

defineProps<{ modelValue: PopupTabId }>();
defineEmits<{ 'update:modelValue': [value: PopupTabId] }>();

const tabs = [
  { id: 'server', label: getMessage('navServer'), icon: ServerIcon },
  { id: 'data', label: getMessage('navData'), icon: DataIcon },
  { id: 'tasks', label: getMessage('navTasks'), icon: TaskCenterIcon },
  { id: 'import', label: getMessage('navImport'), icon: ImportIcon },
  { id: 'extensions', label: getMessage('navExtensions'), icon: ExtensionIcon },
  { id: 'aiweb', label: getMessage('navWebAi'), icon: ExtensionIcon },
  { id: 'audio', label: getMessage('navAudio'), icon: AudioIcon },
  { id: 'settings', label: getMessage('settingsTitle'), icon: SettingsIcon },
  { id: 'debug', label: getMessage('navDebug'), icon: DebugIcon },
] as const;
</script>
