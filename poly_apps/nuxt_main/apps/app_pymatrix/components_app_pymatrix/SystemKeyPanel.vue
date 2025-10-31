<template>
  <div class="system-key-panel">
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
        class="system-key-btn"
        :class="key.class"
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

<style scoped>
.system-key-panel {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 16px;
  width: 320px;
  max-width: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.keys-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.system-key-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.system-key-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.system-key-btn:active {
  transform: translateY(0);
}

.system-key-btn.primary {
  border-color: #3b82f6;
  color: #3b82f6;
}

.system-key-btn.primary:hover {
  background: #eff6ff;
  border-color: #2563eb;
}

.system-key-btn.secondary {
  border-color: #6b7280;
  color: #6b7280;
}

.system-key-btn.secondary:hover {
  background: #f3f4f6;
  border-color: #4b5563;
}

.system-key-btn.danger {
  border-color: #ef4444;
  color: #ef4444;
}

.system-key-btn.danger:hover {
  background: #fef2f2;
  border-color: #dc2626;
}

.system-key-btn.info {
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.system-key-btn.info:hover {
  background: #f5f3ff;
  border-color: #7c3aed;
}

.key-icon {
  font-size: 24px;
  line-height: 1;
}

.key-label {
  font-size: 13px;
  font-weight: 500;
}

.panel-footer {
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}

.help-text {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  text-align: center;
}

@media (max-width: 640px) {
  .system-key-panel {
    width: 100%;
  }

  .keys-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .system-key-btn {
    padding: 12px 8px;
  }

  .key-icon {
    font-size: 20px;
  }

  .key-label {
    font-size: 11px;
  }
}
</style>
