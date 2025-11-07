<template>
  <div class="pm-right-sidebar pm-aurora-panel">
    <div class="pm-right-sidebar__header">
      <h3 class="pm-right-sidebar__title">Device Control</h3>
    </div>

    <div class="pm-right-sidebar__body">
      <div class="pm-sidebar-section">
        <div class="pm-sidebar-section__header">
          <h4 class="pm-sidebar-section__title">System Keys</h4>
        </div>
        <div class="pm-sidebar-section__body">
          <div class="button-grid">
            <button class="pm-sidebar-item control-btn" @click="emit('systemKey', 'home')">
              <span class="btn-icon">🏠</span>
              <span>Home</span>
            </button>
            <button class="pm-sidebar-item control-btn" @click="emit('systemKey', 'back')">
              <span class="btn-icon">◀</span>
              <span>Back</span>
            </button>
            <button class="pm-sidebar-item control-btn" @click="emit('systemKey', 'recent')">
              <span class="btn-icon">☰</span>
              <span>Recent</span>
            </button>
            <button class="pm-sidebar-item control-btn" @click="emit('systemKey', 'power')">
              <span class="btn-icon">⏻</span>
              <span>Power</span>
            </button>
          </div>
        </div>
      </div>

      <div class="pm-sidebar-section">
        <div class="pm-sidebar-section__header">
          <h4 class="pm-sidebar-section__title">Volume</h4>
        </div>
        <div class="pm-sidebar-section__body">
          <div class="button-grid">
            <button class="pm-sidebar-item control-btn" @click="emit('systemKey', 'volume_up')">
              <span class="btn-icon">🔊</span>
              <span>Volume Up</span>
            </button>
            <button class="pm-sidebar-item control-btn" @click="emit('systemKey', 'volume_down')">
              <span class="btn-icon">🔉</span>
              <span>Volume Down</span>
            </button>
          </div>
        </div>
      </div>

      <div class="pm-sidebar-section">
        <div class="pm-sidebar-section__header">
          <h4 class="pm-sidebar-section__title">Text Input</h4>
        </div>
        <div class="pm-sidebar-section__body">
          <div class="text-input-group">
            <input
              v-model="textInput"
              type="text"
              class="text-input"
              placeholder="Enter text to send..."
              @keyup.enter="sendText"
            />
            <button class="pm-sidebar-item control-btn primary" @click="sendText">
              Send
            </button>
          </div>
        </div>
      </div>

      <div class="pm-sidebar-section" v-if="groupEnabled">
        <div class="pm-sidebar-section__header">
          <h4 class="pm-sidebar-section__title">Group Control</h4>
        </div>
        <div class="pm-sidebar-section__body">
          <div class="group-info">
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value" :class="{ active: groupEnabled }">
                {{ groupEnabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            <div class="info-row" v-if="hostDevice">
              <span class="info-label">Host:</span>
              <span class="info-value">{{ hostDevice.name || hostDevice.serial }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Devices:</span>
              <span class="info-value">{{ deviceCount }}</span>
            </div>
          </div>
          <button
            class="pm-sidebar-item control-btn danger full-width"
            @click="emit('disableGroup')"
          >
            Disable Group Control
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Device } from '@/types/pymatrix';

interface Props {
  groupEnabled?: boolean;
  hostDevice?: Device | null;
  deviceCount?: number;
}

interface Emits {
  (e: 'systemKey', key: string): void;
  (e: 'sendText', text: string): void;
  (e: 'disableGroup'): void;
}

const props = withDefaults(defineProps<Props>(), {
  groupEnabled: false,
  deviceCount: 0
});

const emit = defineEmits<Emits>();

const textInput = ref('');

function sendText() {
  if (textInput.value.trim()) {
    emit('sendText', textInput.value);
    textInput.value = '';
  }
}
</script>

<style scoped>
.pm-right-sidebar {
  width: 320px;
  min-width: 300px;
  background: var(--pm-color-surface-raised);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-xl);
  box-shadow: var(--pm-shadow-sm);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.pm-right-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pm-space-lg);
  border-bottom: 1px solid var(--pm-color-border-soft);
  background: rgba(12, 18, 38, 0.75);
  backdrop-filter: var(--pm-backdrop);
}

.pm-right-sidebar__title {
  font-size: var(--pm-font-size-lg);
  font-weight: 700;
  margin: 0;
  background: var(--pm-gradient-main);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pm-right-sidebar__body {
  flex: 1;
  min-height: 0;
  padding: var(--pm-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-md);
  overflow-y: auto;
}

.pm-sidebar-section {
  background: var(--pm-color-surface);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-lg);
  padding: var(--pm-space-md);
  box-shadow: var(--pm-shadow-xs);
  transition: var(--pm-transition-fast);
}

.pm-sidebar-section:hover {
  transform: translateY(-2px);
  box-shadow: var(--pm-shadow-sm);
  border-color: var(--pm-color-border);
}

.pm-sidebar-section__header {
  margin-bottom: var(--pm-space-md);
  padding-bottom: var(--pm-space-sm);
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.pm-sidebar-section__title {
  font-size: var(--pm-font-size-base);
  font-weight: 600;
  color: var(--pm-text-default);
  display: inline-flex;
  gap: var(--pm-space-sm);
  align-items: center;
  margin: 0;
}

.pm-sidebar-section__title::before {
  content: '';
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: var(--pm-gradient-main);
}

.pm-sidebar-section__body {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-sm);
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--pm-space-sm);
}

.control-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--pm-space-xs);
  min-height: 82px;
  padding: var(--pm-space-md) var(--pm-space-sm);
  border-radius: var(--pm-radius-md);
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(16, 21, 44, 0.75);
  color: var(--pm-text-default);
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  transition: var(--pm-transition-fast);
}

.control-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--pm-gradient-main);
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.control-btn span,
.control-btn .btn-icon {
  position: relative;
  z-index: 1;
}

.control-btn:hover {
  border-color: var(--pm-color-border);
  box-shadow: var(--pm-shadow-sm);
  transform: translateY(-3px);
}

.control-btn:hover span {
  color: var(--pm-text-strong);
}

.control-btn:hover::before {
  opacity: 0.15;
}

.control-btn:active {
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 28px;
  transition: var(--pm-transition-fast);
}

.control-btn:hover .btn-icon {
  transform: scale(1.1);
}

.control-btn.primary {
  background: var(--pm-gradient-main);
  border-color: transparent;
  color: var(--pm-text-strong);
}

.control-btn.primary::before {
  opacity: 0;
}

.control-btn.primary:hover {
  box-shadow: 0 8px 22px rgba(124, 92, 255, 0.35);
}

.control-btn.danger {
  background: rgba(248, 113, 113, 0.18);
  border-color: rgba(248, 113, 113, 0.35);
  color: #ffc2c2;
}

.control-btn.danger:hover {
  background: var(--pm-color-danger);
  color: var(--pm-text-strong);
  border-color: transparent;
  box-shadow: 0 8px 22px rgba(248, 113, 113, 0.45);
}

.control-btn.full-width {
  grid-column: 1 / -1;
}

.text-input-group {
  display: flex;
  gap: var(--pm-space-sm);
}

.text-input {
  flex: 1;
  height: 48px;
  padding: 0 var(--pm-space-lg);
  border-radius: var(--pm-radius-pill);
  border: 1px solid var(--pm-color-border-soft);
  background: rgba(12, 18, 40, 0.75);
  color: var(--pm-text-default);
  font-size: var(--pm-font-size-sm);
  transition: var(--pm-transition-fast);
}

.text-input::placeholder {
  color: var(--pm-text-muted);
}

.text-input:hover {
  border-color: var(--pm-color-border);
}

.text-input:focus {
  border-color: var(--pm-color-primary);
  box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.2);
}

.group-info {
  background: rgba(124, 92, 255, 0.08);
  border: 1px solid rgba(124, 92, 255, 0.25);
  border-radius: var(--pm-radius-lg);
  padding: var(--pm-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-xs);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--pm-space-xs) 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.info-row:first-child {
  padding-top: 0;
}

.info-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-label {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-default);
  font-weight: 600;
}

.info-value.active {
  background: var(--pm-gradient-main);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pm-right-sidebar__body::-webkit-scrollbar {
  width: 6px;
}

.pm-right-sidebar__body::-webkit-scrollbar-track {
  background: rgba(12, 18, 40, 0.4);
  border-radius: var(--pm-radius-pill);
}

.pm-right-sidebar__body::-webkit-scrollbar-thumb {
  background: rgba(124, 92, 255, 0.35);
  border-radius: var(--pm-radius-pill);
}

.pm-right-sidebar__body::-webkit-scrollbar-thumb:hover {
  background: var(--pm-color-primary);
}

@media (max-width: 1278px) {
  .pm-right-sidebar {
    width: 280px;
  }

  .pm-sidebar-section {
    padding: var(--pm-space-sm);
  }

  .control-btn {
    min-height: 70px;
  }
}

@media (max-width: 767px) {
  .pm-right-sidebar {
    width: 100%;
    min-width: unset;
    border-radius: var(--pm-radius-lg);
  }

  .button-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .text-input-group {
    flex-direction: column;
  }
}
</style>
