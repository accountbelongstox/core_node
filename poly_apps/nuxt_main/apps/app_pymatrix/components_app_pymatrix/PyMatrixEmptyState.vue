<template>
  <div class="empty-state">
    <div class="empty-content">
      <div class="empty-icon">📱</div>
      <h2 class="empty-title">No Devices Connected</h2>
      <p class="empty-description">
        Connect an Android device via ADB to start mirroring and control
      </p>
      <button class="connect-btn" @click="$emit('connect-device')">
        <span class="btn-icon">+</span>
        <span>Connect Device</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Emits {
  (e: 'connect-device'): void;
}

const emit = defineEmits<Emits>();
</script>

<style scoped>
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 48px;
}

.empty-content {
  text-align: center;
  max-width: 400px;
}

.empty-icon {
  font-size: 96px;
  margin-bottom: 24px;
  opacity: 0.3;
  animation: float 3s ease-in-out infinite;
}

.empty-title {
  margin: 0 0 16px 0;
  font-size: 28px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.empty-description {
  margin: 0 0 32px 0;
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
}

.connect-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 14px 32px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.connect-btn:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
}

.btn-icon {
  font-size: 20px;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
</style>
