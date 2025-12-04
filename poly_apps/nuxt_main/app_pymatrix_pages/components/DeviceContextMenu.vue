<template>
  <BaseContextMenu
    :show="show"
    :x="x"
    :y="y"
    :title="menuTitle"
    title-icon="📱"
    :items="menuItems"
    @close="handleClose"
    @select="handleSelect"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDeviceStore } from '@/app_pymatrix_pages/stores/deviceStore';
import { useGroupStore } from '@/app_pymatrix_pages/stores/groupStore';
import { useRecordingStore } from '@/app_pymatrix_pages/stores/recordingStore';
import BaseContextMenu, { type ContextMenuItem } from '~/common/components/ui/BaseContextMenu.vue';

interface Props {
  show?: boolean;
  x?: number;
  y?: number;
  deviceSerial: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'action', action: string, serial: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  x: 0,
  y: 0
});

const emit = defineEmits<Emits>();

const deviceStore = useDeviceStore();
const groupStore = useGroupStore();
const recordingStore = useRecordingStore();

const device = computed(() => deviceStore.getDevice(props.deviceSerial));
const isRecording = computed(() => recordingStore.isRecording(props.deviceSerial));
const isHost = computed(() => groupStore.isHost(props.deviceSerial));
const isSlave = computed(() => groupStore.isSlave(props.deviceSerial));
const isFree = computed(() => !isHost.value && !isSlave.value);

const menuTitle = computed(() => {
  const dev = device.value;
  if (!dev) return 'Device Menu';
  return dev.name || dev.serial.substring(0, 12);
});

const menuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];

  // Device Info
  items.push({
    label: 'Device Info',
    icon: 'ℹ️',
    action: () => emit('action', 'show-info', props.deviceSerial)
  });

  items.push({ type: 'divider' });

  // Quick Actions
  items.push({
    label: isRecording.value ? 'Stop Recording' : 'Start Recording',
    icon: isRecording.value ? '⏹️' : '⏺️',
    badge: isRecording.value ? 'REC' : undefined,
    badgeType: isRecording.value ? 'danger' : undefined,
    action: () => emit('action', 'toggle-recording', props.deviceSerial)
  });

  items.push({
    label: 'Take Screenshot',
    icon: '📸',
    shortcut: 'S',
    action: () => emit('action', 'screenshot', props.deviceSerial)
  });

  items.push({ type: 'divider' });

  // Control Actions
  items.push({
    label: 'Screen Control',
    icon: '🖥️',
    action: () => emit('action', 'screen-control', props.deviceSerial)
  });

  items.push({
    label: 'Clipboard Sync',
    icon: '📋',
    action: () => emit('action', 'clipboard-sync', props.deviceSerial)
  });

  items.push({
    label: 'Text Input',
    icon: '⌨️',
    shortcut: 'T',
    action: () => emit('action', 'text-input', props.deviceSerial)
  });

  items.push({ type: 'divider' });

  // File Operations
  items.push({
    label: 'Push File',
    icon: '📤',
    action: () => emit('action', 'push-file', props.deviceSerial)
  });

  items.push({
    label: 'Install APK',
    icon: '📦',
    action: () => emit('action', 'install-apk', props.deviceSerial)
  });

  items.push({
    label: 'View Installed Packages',
    icon: '📋',
    shortcut: 'P',
    action: () => emit('action', 'view-packages', props.deviceSerial)
  });

  items.push({ type: 'divider' });

  // Group Operations (conditional)
  if (groupStore.enabled) {
    if (isFree.value) {
      items.push({
        label: 'Add to Group',
        icon: '➕',
        badge: 'Group',
        badgeType: 'success',
        action: () => emit('action', 'add-to-group', props.deviceSerial)
      });
    } else {
      if (isHost.value) {
        items.push({
          label: 'Remove as Host',
          icon: '👑',
          danger: true,
          action: () => emit('action', 'remove-host', props.deviceSerial)
        });
      } else if (isSlave.value) {
        items.push({
          label: 'Set as Host',
          icon: '👑',
          action: () => emit('action', 'set-host', props.deviceSerial)
        });

        items.push({
          label: 'Remove from Group',
          icon: '➖',
          danger: true,
          action: () => emit('action', 'remove-from-group', props.deviceSerial)
        });
      }
    }

    items.push({ type: 'divider' });
  }

  // System Actions
  items.push({
    label: 'Restart Device',
    icon: '🔄',
    action: () => emit('action', 'restart', props.deviceSerial)
  });

  items.push({
    label: 'Disconnect',
    icon: '🔌',
    danger: true,
    action: () => emit('action', 'disconnect', props.deviceSerial)
  });

  return items;
});

function handleClose() {
  emit('close');
}

function handleSelect(item: ContextMenuItem) {
  // Item action already called by BaseContextMenu
  console.log('[DeviceContextMenu] Selected:', item.label);
}
</script>
