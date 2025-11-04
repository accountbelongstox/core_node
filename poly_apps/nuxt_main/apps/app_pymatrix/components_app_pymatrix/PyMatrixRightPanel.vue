<template>
  <div class="pm-right-sidebar">
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
/* RightPanel Styles with NFTMax Theme */
.pm-right-sidebar {
  width: 320px;
  min-width: 320px;
  background: var(--pm-bg-card);
  border-left: 1px solid var(--pm-border);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.pm-right-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pm-space-lg);
  border-bottom: 1px solid var(--pm-border);
  background: var(--pm-bg-card);
}

.pm-right-sidebar__title {
  font-size: var(--pm-font-size-lg);
  font-weight: 700;
  margin: 0;
  background: var(--pm-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pm-right-sidebar__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--pm-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-md);
}

/* Section Styles */
.pm-sidebar-section {
  background: var(--pm-bg-main);
  border-radius: var(--pm-radius-lg);
  padding: var(--pm-space-md);
  box-shadow: var(--pm-shadow-sm);
  transition: var(--pm-transition-fast);
  animation: pm-fadeUp 0.3s ease;
}

.pm-sidebar-section:hover {
  box-shadow: var(--pm-shadow-md);
  transform: translateY(-2px);
}

.pm-sidebar-section__header {
  margin-bottom: var(--pm-space-md);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--pm-border);
}

.pm-sidebar-section__title {
  font-size: var(--pm-font-size-base);
  font-weight: 600;
  color: var(--pm-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pm-sidebar-section__title::before {
  content: '';
  width: 4px;
  height: 16px;
  background: var(--pm-gradient-primary);
  border-radius: 2px;
}

.pm-sidebar-section__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Button Grid */
.button-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

/* Control Button */
.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 12px;
  background: #ffffff;
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-md);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  font-size: var(--pm-font-size-sm);
  font-weight: 500;
  color: var(--pm-text-primary);
  min-height: 80px;
  position: relative;
  overflow: hidden;
}

.control-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--pm-gradient-primary);
  opacity: 0;
  transition: var(--pm-transition-fast);
  z-index: 0;
}

.control-btn:hover {
  border-color: var(--pm-primary);
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(83, 86, 251, 0.25);
}

.control-btn:hover::before {
  opacity: 1;
}

.control-btn:hover .btn-icon,
.control-btn:hover span {
  color: #ffffff;
  position: relative;
  z-index: 1;
}

.control-btn:active {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(83, 86, 251, 0.2);
}

.btn-icon {
  font-size: 28px;
  transition: var(--pm-transition-fast);
}

.control-btn:hover .btn-icon {
  transform: scale(1.15);
}

/* Primary Button Variant */
.control-btn.primary {
  background: var(--pm-gradient-primary);
  color: #ffffff;
  border-color: transparent;
  font-weight: 600;
}

.control-btn.primary::before {
  background: var(--pm-gradient-primary-reverse);
}

.control-btn.primary:hover {
  box-shadow: 0 6px 20px rgba(243, 57, 248, 0.4);
}

/* Danger Button Variant */
.control-btn.danger {
  background: var(--pm-danger);
  color: #ffffff;
  border-color: transparent;
  font-weight: 600;
}

.control-btn.danger::before {
  background: linear-gradient(135deg, #EB5757 0%, #E74C3C 100%);
}

.control-btn.danger:hover {
  box-shadow: 0 6px 16px rgba(235, 87, 87, 0.4);
}

/* Full Width Button */
.control-btn.full-width {
  grid-column: 1 / -1;
  min-height: 56px;
}

/* Text Input Group */
.text-input-group {
  display: flex;
  gap: 10px;
}

.text-input {
  flex: 1;
  height: 48px;
  padding: 12px 20px;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-primary);
  background: #ffffff;
  border: 1.5px solid var(--pm-border);
  border-radius: var(--pm-radius-xl);
  outline: none;
  transition: var(--pm-transition-fast);
}

.text-input:hover {
  border-color: var(--pm-primary);
}

.text-input:focus {
  border-color: var(--pm-primary);
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.1);
  background: #ffffff;
}

.text-input::placeholder {
  color: var(--pm-text-muted);
}

/* Group Info */
.group-info {
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.05) 0%, rgba(243, 57, 248, 0.05) 100%);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-md);
  padding: 16px;
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(83, 86, 251, 0.1);
}

.info-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-row:first-child {
  padding-top: 0;
}

.info-label {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-secondary);
  font-weight: 500;
}

.info-value {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-primary);
  font-weight: 600;
}

.info-value.active {
  background: var(--pm-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 700;
}

/* Animations */
@keyframes pm-fadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar Styling */
.pm-right-sidebar__body::-webkit-scrollbar {
  width: 6px;
}

.pm-right-sidebar__body::-webkit-scrollbar-track {
  background: var(--pm-bg-main);
  border-radius: 10px;
}

.pm-right-sidebar__body::-webkit-scrollbar-thumb {
  background: var(--pm-border);
  border-radius: 10px;
  transition: var(--pm-transition-fast);
}

.pm-right-sidebar__body::-webkit-scrollbar-thumb:hover {
  background: var(--pm-primary);
}

/* Responsive */
@media (max-width: 1278px) {
  .pm-right-sidebar {
    width: 280px;
    min-width: 280px;
  }

  .pm-right-sidebar__header {
    padding: var(--pm-space-md);
  }

  .pm-sidebar-section {
    padding: 12px;
  }

  .control-btn {
    min-height: 70px;
    padding: 12px 8px;
  }

  .btn-icon {
    font-size: 24px;
  }
}

@media (max-width: 767px) {
  .pm-right-sidebar {
    width: 100%;
    min-width: unset;
    border-left: none;
    border-top: 1px solid var(--pm-border);
  }

  .button-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .text-input-group {
    flex-direction: column;
  }
}
</style>
