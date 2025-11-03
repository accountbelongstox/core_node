<template>
  <header class="pymatrix-topbar">
    <div class="topbar-left">
      <h1 class="topbar-title">
        <span class="title-icon">📱</span>
        pyMatrix
      </h1>
      <span class="topbar-subtitle">Android Device Control</span>
    </div>

    <div class="topbar-center">
      <div class="status-indicator">
        <span class="status-dot" :class="{ active: deviceCount > 0 }"></span>
        <span class="status-text">{{ deviceCount }} Device{{ deviceCount !== 1 ? 's' : '' }}</span>
      </div>

      <div v-if="groupEnabled" class="group-indicator">
        <span class="group-icon">👥</span>
        <span class="group-text">Group Control Active</span>
      </div>
    </div>

    <div class="topbar-right">
      <button class="topbar-btn primary" @click="$emit('connect-device')">
        <span class="btn-icon">+</span>
        <span>Connect Device</span>
      </button>

      <button
        class="topbar-btn"
        :class="{ active: groupEnabled }"
        @click="$emit('toggle-group')"
        :title="groupEnabled ? 'Disable Group Control' : 'Enable Group Control'"
      >
        <span class="btn-icon">👥</span>
        <span>{{ groupEnabled ? 'Group ON' : 'Group OFF' }}</span>
      </button>

      <button class="topbar-btn" @click="$emit('open-settings')">
        <span class="btn-icon">⚙️</span>
        <span>Settings</span>
      </button>

      <button class="topbar-btn" @click="$emit('show-history')" title="Connection history (Ctrl+H)">
        <span class="btn-icon">📜</span>
        <span>History</span>
      </button>

      <button class="topbar-btn" @click="$emit('show-help')" title="Show keyboard shortcuts (Press /)">
        <span class="btn-icon">⌨️</span>
        <span>Shortcuts</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
interface Props {
  deviceCount: number;
  groupEnabled: boolean;
}

interface Emits {
  (e: 'connect-device'): void;
  (e: 'toggle-group'): void;
  (e: 'open-settings'): void;
  (e: 'show-help'): void;
  (e: 'show-history'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<style scoped>
.pymatrix-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border-bottom: 1px solid #3a3a3a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  min-height: 64px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title-icon {
  font-size: 28px;
}

.topbar-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.topbar-center {
  display: flex;
  align-items: center;
  gap: 24px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  animation: pulse-red 2s infinite;
}

.status-dot.active {
  background: #10b981;
  animation: pulse-green 2s infinite;
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.group-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 20px;
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}

.group-icon {
  font-size: 16px;
}

.group-text {
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.topbar-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.topbar-btn.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #3b82f6;
}

.topbar-btn.primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
}

.topbar-btn.active {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #10b981;
}

.btn-icon {
  font-size: 16px;
}

@keyframes pulse-red {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
  }
}

@keyframes pulse-green {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
  }
}

@media (max-width: 1280px) {
  .topbar-subtitle {
    display: none;
  }

  .topbar-btn span:not(.btn-icon) {
    display: none;
  }
}
</style>
