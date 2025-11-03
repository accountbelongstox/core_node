<template>
  <div class="device-info-panel" v-if="show && deviceInfo">
    <div class="panel-header">
      <h3 class="panel-title">Device Info</h3>
      <button class="close-btn" @click="emit('close')" title="Close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <!-- Basic Info -->
      <div class="info-section">
        <div class="section-title">Basic</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-key">Serial</span>
            <span class="info-value mono">{{ deviceInfo.serial }}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Model</span>
            <span class="info-value">{{ deviceInfo.model || 'Unknown' }}</span>
          </div>
          <div class="info-row">
            <span class="info-key">State</span>
            <span class="info-value" :class="`state-${deviceInfo.state}`">
              {{ deviceInfo.state }}
            </span>
          </div>
        </div>
      </div>

      <!-- Display Info -->
      <div class="info-section" v-if="deviceInfo.resolution">
        <div class="section-title">Display</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-key">Resolution</span>
            <span class="info-value mono">
              {{ deviceInfo.resolution.width }} × {{ deviceInfo.resolution.height }}
            </span>
          </div>
          <div class="info-row" v-if="deviceInfo.dpi">
            <span class="info-key">DPI</span>
            <span class="info-value">{{ deviceInfo.dpi }}</span>
          </div>
        </div>
      </div>

      <!-- System Info -->
      <div class="info-section" v-if="deviceInfo.androidVersion || deviceInfo.sdkVersion">
        <div class="section-title">System</div>
        <div class="info-grid">
          <div class="info-row" v-if="deviceInfo.androidVersion">
            <span class="info-key">Android</span>
            <span class="info-value">{{ deviceInfo.androidVersion }}</span>
          </div>
          <div class="info-row" v-if="deviceInfo.sdkVersion">
            <span class="info-key">SDK</span>
            <span class="info-value">{{ deviceInfo.sdkVersion }}</span>
          </div>
        </div>
      </div>

      <!-- Streaming Info -->
      <div class="info-section" v-if="deviceInfo.streaming !== undefined">
        <div class="section-title">Status</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-key">Streaming</span>
            <span class="info-value">
              <span class="status-badge" :class="{ active: deviceInfo.streaming }">
                {{ deviceInfo.streaming ? 'Active' : 'Inactive' }}
              </span>
            </span>
          </div>
          <div class="info-row">
            <span class="info-key">Controllable</span>
            <span class="info-value">
              <span class="status-badge" :class="{ active: deviceInfo.controllable }">
                {{ deviceInfo.controllable ? 'Yes' : 'No' }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- Group Info -->
      <div class="info-section" v-if="deviceInfo.isHost">
        <div class="section-title">Group Control</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-key">Role</span>
            <span class="info-value">
              <span class="host-badge-inline">
                <span class="badge-icon">★</span>
                Host Device
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <button class="refresh-btn" @click="emit('refresh')" title="Refresh device info">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
          <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
        </svg>
        Refresh
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Device } from '@/types/pymatrix';

interface Props {
  show?: boolean;
  deviceInfo: Device | null;
}

interface Emits {
  (e: 'close'): void;
  (e: 'refresh'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: true
});

const emit = defineEmits<Emits>();
</script>

<style scoped>
.device-info-panel {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 320px;
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 10;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.close-btn {
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  gap: 12px;
}

.info-key {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.info-value {
  font-size: 13px;
  font-weight: 600;
  color: white;
  text-align: right;
  word-break: break-word;
}

.info-value.mono {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.info-value.state-connected {
  color: #10b981;
}

.info-value.state-disconnected {
  color: #ef4444;
}

.info-value.state-connecting {
  color: #f59e0b;
}

.status-badge {
  display: inline-flex;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.host-badge-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  color: white;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
}

.badge-icon {
  font-size: 12px;
}

.panel-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.refresh-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: rgba(59, 130, 246, 0.8);
  border: 1px solid rgba(59, 130, 246, 1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(59, 130, 246, 1);
  transform: translateY(-1px);
}

.refresh-btn:active {
  transform: translateY(0);
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
