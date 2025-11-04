<template>
  <aside class="pm-left-sidebar">
    <div class="pm-left-sidebar__header">
      <h3 class="pm-left-sidebar__title">Device List</h3>
      <span class="pm-count-badge">{{ devices.length }}</span>
    </div>

    <div class="pm-left-sidebar__body">
      <div v-if="devices.length === 0" class="empty-message">
        <span class="empty-icon">📱</span>
        <p>No devices connected</p>
      </div>

      <div v-else class="device-list">
        <div
          v-for="device in devices"
          :key="device.serial"
          class="pm-sidebar-item"
          :class="{
            'pm-sidebar-item--active': device.serial === selectedSerial,
            'is-host': device.serial === hostSerial
          }"
          @click="$emit('select-device', device.serial)"
        >
          <div class="device-info">
            <div class="device-name">{{ device.name }}</div>
            <div class="device-serial">{{ device.serial.substring(0, 12) }}</div>
            <div class="device-resolution">{{ device.resolution.width }}×{{ device.resolution.height }}</div>
          </div>

          <div v-if="groupEnabled" class="device-actions">
            <button
              v-if="device.serial !== hostSerial"
              class="action-btn small"
              @click.stop="$emit('set-host', device.serial)"
              title="Set as Host"
            >
              👑 Host
            </button>
            <button
              v-else
              class="action-btn small active"
              @click.stop="$emit('remove-from-group', device.serial)"
              title="Remove Host"
            >
              👑 HOST
            </button>
          </div>

          <div v-if="device.serial === hostSerial" class="pm-sidebar-item__badge">
            <span>★ HOST</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Device } from '@/types/pymatrix';

interface Props {
  devices: Device[];
  selectedSerial: string | null;
  groupEnabled: boolean;
  hostSerial: string | null;
}

interface Emits {
  (e: 'select-device', serial: string): void;
  (e: 'set-host', serial: string): void;
  (e: 'remove-from-group', serial: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<style scoped>
/* LeftPanel Styles with NFTMax Theme */
.pm-left-sidebar {
  width: 320px;
  min-width: 320px;
  background: var(--pm-bg-card);
  border-right: 1px solid var(--pm-border);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.pm-left-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pm-space-lg);
  border-bottom: 1px solid var(--pm-border);
  background: var(--pm-bg-card);
}

.pm-left-sidebar__title {
  font-size: var(--pm-font-size-lg);
  font-weight: 700;
  margin: 0;
  background: var(--pm-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pm-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 12px;
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  background: var(--pm-gradient-primary);
  color: #ffffff;
  border-radius: var(--pm-radius-full);
  box-shadow: var(--pm-shadow-sm);
  animation: pm-fadeIn 0.3s ease;
}

.pm-left-sidebar__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--pm-space-md);
}

/* Empty State */
.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--pm-space-xl) var(--pm-space-lg);
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
  animation: pm-pulse 2s ease-in-out infinite;
}

.empty-message p {
  margin: 0;
  color: var(--pm-text-muted);
  font-size: var(--pm-font-size-base);
}

/* Device List */
.device-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Device Item */
.pm-sidebar-item {
  position: relative;
  background: var(--pm-bg-main);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-lg);
  padding: 16px;
  cursor: pointer;
  transition: var(--pm-transition-fast);
  overflow: hidden;
}

.pm-sidebar-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: transparent;
  transition: var(--pm-transition-fast);
}

.pm-sidebar-item:hover {
  border-color: var(--pm-primary);
  transform: translateX(4px);
  box-shadow: var(--pm-shadow-md);
}

.pm-sidebar-item:hover::before {
  background: var(--pm-gradient-primary);
}

/* Active State */
.pm-sidebar-item--active {
  background: var(--pm-bg-light);
  border-color: var(--pm-primary);
  box-shadow: var(--pm-shadow-sm);
}

.pm-sidebar-item--active::before {
  background: var(--pm-gradient-primary);
}

.pm-sidebar-item--active:hover {
  transform: translateX(4px);
  box-shadow: var(--pm-shadow-md);
}

/* Host Device */
.pm-sidebar-item.is-host {
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.05) 0%, rgba(243, 57, 248, 0.05) 100%);
  border: 2px solid transparent;
  background-clip: padding-box;
  position: relative;
}

.pm-sidebar-item.is-host::after {
  content: '';
  position: absolute;
  inset: -2px;
  background: var(--pm-gradient-primary);
  border-radius: var(--pm-radius-lg);
  z-index: -1;
}

/* Device Info */
.device-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.device-name {
  font-size: var(--pm-font-size-md);
  font-weight: 600;
  color: var(--pm-text-primary);
  transition: var(--pm-transition-fast);
}

.pm-sidebar-item:hover .device-name {
  color: var(--pm-primary);
}

.pm-sidebar-item--active .device-name {
  background: var(--pm-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.device-serial {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-secondary);
  font-family: 'Courier New', monospace;
}

.device-resolution {
  font-size: var(--pm-font-size-xs);
  color: var(--pm-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.device-resolution::before {
  content: '📐';
  font-size: 12px;
}

/* Device Actions */
.device-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: var(--pm-font-size-sm);
  font-weight: 500;
  background: #ffffff;
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-full);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  color: var(--pm-text-primary);
}

.action-btn.small {
  padding: 6px 12px;
  font-size: var(--pm-font-size-xs);
}

.action-btn:hover {
  background: var(--pm-primary);
  color: #ffffff;
  border-color: var(--pm-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.3);
}

.action-btn.active {
  background: var(--pm-gradient-primary);
  color: #ffffff;
  border-color: transparent;
  font-weight: 600;
}

.action-btn.active:hover {
  background: var(--pm-gradient-primary-reverse);
  transform: translateY(-2px) scale(1.05);
}

/* Host Badge */
.pm-sidebar-item__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  background: var(--pm-gradient-primary);
  color: #ffffff;
  font-size: var(--pm-font-size-xs);
  font-weight: 700;
  border-radius: var(--pm-radius-full);
  box-shadow: 0 2px 8px rgba(243, 57, 248, 0.4);
  animation: pm-pulse 2s ease-in-out infinite;
  letter-spacing: 0.5px;
}

/* Animations */
@keyframes pm-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.05);
  }
}

/* Scrollbar Styling */
.pm-left-sidebar__body::-webkit-scrollbar {
  width: 6px;
}

.pm-left-sidebar__body::-webkit-scrollbar-track {
  background: var(--pm-bg-main);
  border-radius: 10px;
}

.pm-left-sidebar__body::-webkit-scrollbar-thumb {
  background: var(--pm-border);
  border-radius: 10px;
  transition: var(--pm-transition-fast);
}

.pm-left-sidebar__body::-webkit-scrollbar-thumb:hover {
  background: var(--pm-primary);
}

/* Responsive */
@media (max-width: 1278px) {
  .pm-left-sidebar {
    width: 280px;
    min-width: 280px;
  }

  .pm-left-sidebar__header {
    padding: var(--pm-space-md);
  }

  .pm-sidebar-item {
    padding: 12px;
  }

  .device-name {
    font-size: var(--pm-font-size-base);
  }
}

@media (max-width: 767px) {
  .pm-left-sidebar {
    width: 100%;
    min-width: unset;
    border-right: none;
    border-bottom: 1px solid var(--pm-border);
  }

  .device-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
}
</style>
