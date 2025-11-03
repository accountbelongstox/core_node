<template>
  <div class="control-panel">
    <div class="panel-header">
      <h3 class="panel-title">Device Control</h3>
    </div>

    <div class="panel-body">
      <div class="control-section">
        <h4 class="section-title">System Keys</h4>
        <div class="button-grid">
          <button class="control-btn" @click="emit('systemKey', 'home')">
            <span class="btn-icon">🏠</span>
            <span>Home</span>
          </button>
          <button class="control-btn" @click="emit('systemKey', 'back')">
            <span class="btn-icon">◀</span>
            <span>Back</span>
          </button>
          <button class="control-btn" @click="emit('systemKey', 'recent')">
            <span class="btn-icon">☰</span>
            <span>Recent</span>
          </button>
          <button class="control-btn" @click="emit('systemKey', 'power')">
            <span class="btn-icon">⏻</span>
            <span>Power</span>
          </button>
        </div>
      </div>

      <div class="control-section">
        <h4 class="section-title">Volume</h4>
        <div class="button-grid">
          <button class="control-btn" @click="emit('systemKey', 'volume_up')">
            <span class="btn-icon">🔊</span>
            <span>Volume Up</span>
          </button>
          <button class="control-btn" @click="emit('systemKey', 'volume_down')">
            <span class="btn-icon">🔉</span>
            <span>Volume Down</span>
          </button>
        </div>
      </div>

      <div class="control-section">
        <h4 class="section-title">Text Input</h4>
        <div class="text-input-group">
          <input
            v-model="textInput"
            type="text"
            class="text-input"
            placeholder="Enter text to send..."
            @keyup.enter="sendText"
          />
          <button class="control-btn primary" @click="sendText">
            Send
          </button>
        </div>
      </div>

      <div class="control-section" v-if="groupEnabled">
        <h4 class="section-title">Group Control</h4>
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
          class="control-btn danger full-width"
          @click="emit('disableGroup')"
        >
          Disable Group Control
        </button>
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
.control-panel {
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  padding: 16px;
  background: #2a2a2a;
  border-bottom: 1px solid #3a3a3a;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.panel-body {
  padding: 16px;
}

.control-section {
  margin-bottom: 24px;
}

.control-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.control-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:hover {
  background: #3a3a3a;
  border-color: #4a4a4a;
  transform: translateY(-1px);
}

.control-btn:active {
  transform: translateY(0);
}

.control-btn.primary {
  background: #3b82f6;
  border-color: #3b82f6;
}

.control-btn.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.control-btn.danger {
  background: #ef4444;
  border-color: #ef4444;
}

.control-btn.danger:hover {
  background: #dc2626;
  border-color: #dc2626;
}

.control-btn.full-width {
  grid-column: 1 / -1;
}

.btn-icon {
  font-size: 20px;
}

.text-input-group {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 14px;
  color: white;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s ease;
}

.text-input:focus {
  border-color: #3b82f6;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.group-info {
  margin-bottom: 12px;
  padding: 12px;
  background: #2a2a2a;
  border-radius: 6px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.info-value {
  color: white;
  font-weight: 600;
}

.info-value.active {
  color: #10b981;
}
</style>
