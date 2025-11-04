<template>
  <div class="pm-panel pm-panel--purple">
    <div class="panel-header">
      <h3 class="panel-title">System Keys</h3>
      <button
        class="close-btn"
        @click="emit('close')"
        title="Close"
      >
        ×
      </button>
    </div>

    <div class="keys-grid">
      <button
        v-for="key in systemKeys"
        :key="key.action"
        class="pm-button pm-button--violet"
        @click="handleKeyPress(key.action)"
        :title="key.description"
      >
        <span class="key-icon">{{ key.icon }}</span>
        <span class="key-label">{{ key.label }}</span>
      </button>
    </div>

    <div class="panel-footer">
      <p class="help-text">
        Click any button to send system key to device
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface SystemKey {
  action: 'home' | 'back' | 'recent' | 'power' | 'volume_up' | 'volume_down';
  label: string;
  icon: string;
  description: string;
  class?: string;
}

interface Props {
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: true
});

const emit = defineEmits<{
  close: [];
  keyPress: [action: string];
}>();

const systemKeys = ref<SystemKey[]>([
  {
    action: 'home',
    label: 'Home',
    icon: '🏠',
    description: 'Go to home screen',
    class: 'primary'
  },
  {
    action: 'back',
    label: 'Back',
    icon: '⬅️',
    description: 'Navigate back',
    class: 'secondary'
  },
  {
    action: 'recent',
    label: 'Recent',
    icon: '📱',
    description: 'Show recent apps',
    class: 'secondary'
  },
  {
    action: 'power',
    label: 'Power',
    icon: '⚡',
    description: 'Power button (lock/wake)',
    class: 'danger'
  },
  {
    action: 'volume_up',
    label: 'Vol +',
    icon: '🔊',
    description: 'Volume up',
    class: 'info'
  },
  {
    action: 'volume_down',
    label: 'Vol -',
    icon: '🔉',
    description: 'Volume down',
    class: 'info'
  }
]);

function handleKeyPress(action: string) {
  emit('keyPress', action);
}
</script>
