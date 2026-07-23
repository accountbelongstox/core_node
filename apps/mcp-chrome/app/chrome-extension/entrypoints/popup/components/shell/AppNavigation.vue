<template>
  <nav class="app-navigation" aria-label="Primary">
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

defineProps<{ modelValue: PopupTabId }>();
defineEmits<{ 'update:modelValue': [value: PopupTabId] }>();

const tabs = [
  { id: 'server', label: 'Server', icon: ServerIcon },
  { id: 'data', label: 'Data', icon: DataIcon },
  { id: 'tasks', label: 'Tasks', icon: TaskCenterIcon },
  { id: 'import', label: 'Import', icon: ImportIcon },
  { id: 'extensions', label: 'Extensions', icon: ExtensionIcon },
  { id: 'aiweb', label: 'Web AI', icon: ExtensionIcon },
  { id: 'audio', label: 'Audio', icon: AudioIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'debug', label: 'Debug', icon: DebugIcon },
] as const;
</script>
