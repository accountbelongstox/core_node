<template>
  <div class="dialog-overlay" @click="$emit('close')">
    <div class="dialog" @click.stop>
      <div class="dialog-header">
        <h3 class="dialog-title">Settings</h3>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="dialog-body">
        <p class="settings-placeholder">Settings panel - Coming soon!</p>
      </div>

      <div class="dialog-footer">
        <button class="dialog-btn" @click="$emit('close')">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Emits {
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();
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
  padding: 48px 24px;
}

.settings-placeholder {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
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
</style>
