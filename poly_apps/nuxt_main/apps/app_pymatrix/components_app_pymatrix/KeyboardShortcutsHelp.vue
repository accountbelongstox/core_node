<template>
  <div class="shortcuts-help-overlay" v-if="show" @click="emit('close')">
    <div class="shortcuts-help-panel" @click.stop>
      <div class="panel-header">
        <h2 class="panel-title">Keyboard Shortcuts</h2>
        <button class="close-btn" @click="emit('close')" title="Close (Esc)">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
      </div>

      <div class="panel-content">
        <div class="shortcuts-grid">
          <div
            v-for="(shortcut, index) in shortcuts"
            :key="index"
            class="shortcut-item"
          >
            <div class="shortcut-keys">
              <kbd v-if="shortcut.ctrl" class="key">Ctrl</kbd>
              <kbd v-if="shortcut.shift" class="key">Shift</kbd>
              <kbd v-if="shortcut.alt" class="key">Alt</kbd>
              <kbd class="key primary">{{ formatKey(shortcut.key) }}</kbd>
            </div>
            <div class="shortcut-description">
              {{ shortcut.description }}
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <p class="footer-hint">
          Press <kbd class="key-inline">?</kbd> to toggle this help panel
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { KeyboardShortcut } from '../composables_app_pymatrix/useKeyboardShortcuts';

interface Props {
  show?: boolean;
  shortcuts: KeyboardShortcut[];
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: false
});

const emit = defineEmits<Emits>();

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '⏎',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Tab': '⇥'
  };

  return keyMap[key] || key.toUpperCase();
}
</script>

<style scoped>
.shortcuts-help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.shortcuts-help-panel {
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.5px;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: white;
  transform: scale(1.05);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.shortcut-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateX(4px);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 180px;
  flex-shrink: 0;
}

.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.key.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #60a5fa;
  color: white;
}

.shortcut-description {
  flex: 1;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  line-height: 1.5;
}

.panel-footer {
  padding: 20px 28px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

.footer-hint {
  margin: 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  text-align: center;
}

.key-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Responsive design */
@media (max-width: 768px) {
  .shortcuts-help-panel {
    width: 95%;
    max-height: 90vh;
  }

  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .shortcut-keys {
    min-width: auto;
  }
}
</style>
