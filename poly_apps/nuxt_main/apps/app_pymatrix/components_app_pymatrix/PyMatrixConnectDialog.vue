<template>
  <div class="dialog-overlay" @click="$emit('close')">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3 class="dialog-title">Connect Device</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="dialog-body">
        <div class="form-group">
          <label class="form-label">Device Serial</label>
          <input
            v-model="formData.serial"
            type="text"
            class="form-input"
            placeholder="Enter device serial (e.g., ABC123DEF456)"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Max Resolution</label>
          <select v-model="formData.maxSize" class="form-input">
            <option :value="1080">1080p</option>
            <option :value="720">720p (Recommended)</option>
            <option :value="540">540p</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Bit Rate (Mbps)</label>
          <input
            v-model.number="formData.bitRate"
            type="number"
            class="form-input"
            min="1"
            max="20"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Max FPS</label>
          <input
            v-model.number="formData.maxFps"
            type="number"
            class="form-input"
            min="15"
            max="60"
          />
        </div>
      </div>

      <div class="dialog-footer">
        <button class="dialog-btn" @click="$emit('close')">
          Cancel
        </button>
        <button
          class="dialog-btn primary"
          @click="handleConnect"
          :disabled="!formData.serial"
        >
          Connect
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Emits {
  (e: 'close'): void;
  (e: 'connect', data: any): void;
}

const emit = defineEmits<Emits>();

const formData = ref({
  serial: '',
  maxSize: 720,
  bitRate: 8,
  maxFps: 60
});

function handleConnect() {
  if (formData.value.serial) {
    emit('connect', formData.value);
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.dialog {
  width: 90%;
  max-width: 500px;
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #2a2a2a;
}

.dialog-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: rgba(255, 255, 255, 0.6);
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: white;
  background: #2a2a2a;
}

.dialog-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: white;
  background: #2a2a2a;
  border: 1px solid #3a3a3a;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  border-color: #3b82f6;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #2a2a2a;
}

.dialog-btn {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.dialog-btn.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #3b82f6;
}

.dialog-btn.primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

.dialog-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
