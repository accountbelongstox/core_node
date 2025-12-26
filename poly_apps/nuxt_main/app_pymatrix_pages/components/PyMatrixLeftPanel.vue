<template>
  <aside class="pm-left-sidebar pm-aurora-panel">
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
            <div class="device-model">{{ device.model }}</div>
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
.pm-left-sidebar {
  width: 100%;
  max-width: 300px;
  background: var(--pm-color-surface-raised);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-xl);
  box-shadow: var(--pm-shadow-sm);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.pm-left-sidebar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  border: 1px solid rgba(124, 92, 255, 0.18);
}

.pm-left-sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-md);
  padding: var(--pm-space-lg);
  background: rgba(12, 18, 38, 0.75);
  border-bottom: 1px solid var(--pm-color-border-soft);
}

.pm-left-sidebar__title {
  margin: 0;
  font-size: var(--pm-font-size-lg);
  font-weight: 700;
  color: var(--pm-text-strong);
  letter-spacing: 0.3px;
}

.pm-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 var(--pm-space-sm);
  border-radius: var(--pm-radius-pill);
  background: var(--pm-gradient-main);
  color: var(--pm-text-strong);
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
  box-shadow: 0 8px 18px rgba(124, 92, 255, 0.28);
}

.pm-left-sidebar__body {
  flex: 1;
  padding: var(--pm-space-md);
  overflow: hidden;
}

.pm-left-sidebar__body > .device-list,
.pm-left-sidebar__body > .empty-message {
  height: 100%;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(124, 92, 255, 0.35) transparent;
}

.pm-left-sidebar__body > .device-list::-webkit-scrollbar,
.pm-left-sidebar__body > .empty-message::-webkit-scrollbar {
  width: 6px;
}

.pm-left-sidebar__body > .device-list::-webkit-scrollbar-thumb,
.pm-left-sidebar__body > .empty-message::-webkit-scrollbar-thumb {
  background: rgba(124, 92, 255, 0.35);
  border-radius: var(--pm-radius-pill);
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--pm-space-sm);
  padding: var(--pm-space-2xl) var(--pm-space-lg);
  text-align: center;
  color: var(--pm-text-muted);
}

.empty-icon {
  font-size: 42px;
  width: 56px;
  height: 56px;
  border-radius: var(--pm-radius-pill);
  display: grid;
  place-items: center;
  background: rgba(124, 92, 255, 0.16);
  color: var(--pm-text-default);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-md);
  padding-bottom: var(--pm-space-sm);
}

.pm-sidebar-item {
  position: relative;
  border-radius: var(--pm-radius-lg);
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(14, 20, 40, 0.85);
  padding: var(--pm-space-md) var(--pm-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-sm);
  transition: var(--pm-transition-fast);
  cursor: pointer;
  box-shadow: var(--pm-shadow-xs);
}

.pm-sidebar-item::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid transparent;
  transition: var(--pm-transition-fast);
}

.pm-sidebar-item::after {
  content: '';
  position: absolute;
  inset: 20% 10% auto 10%;
  height: 1px;
  border-radius: var(--pm-radius-pill);
  background: linear-gradient(90deg, rgba(124, 92, 255, 0.4), transparent);
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.pm-sidebar-item:hover {
  transform: translateX(4px);
  border-color: var(--pm-color-border);
  box-shadow: var(--pm-shadow-sm);
}

.pm-sidebar-item:hover::after {
  opacity: 1;
}

.pm-sidebar-item--active {
  border-color: var(--pm-color-border);
  background: rgba(124, 92, 255, 0.14);
}

.pm-sidebar-item--active::before {
  border-color: rgba(124, 92, 255, 0.6);
  box-shadow: inset 0 0 0 1px rgba(124, 92, 255, 0.45);
}

.pm-sidebar-item.is-host {
  background: rgba(124, 92, 255, 0.18);
  border-color: rgba(124, 92, 255, 0.5);
}

.pm-sidebar-item__badge {
  position: absolute;
  top: var(--pm-space-sm);
  right: var(--pm-space-sm);
  padding: var(--pm-space-xs) var(--pm-space-md);
  border-radius: var(--pm-radius-pill);
  background: rgba(124, 92, 255, 0.3);
  color: var(--pm-text-strong);
  font-size: var(--pm-font-size-2xs);
  font-weight: 700;
  letter-spacing: 0.4px;
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-xs);
  color: var(--pm-text-muted);
}

.device-name {
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  color: var(--pm-text-default);
}

.device-model {
  font-size: var(--pm-font-size-2xs);
  color: var(--pm-text-soft);
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.device-serial {
  font-size: var(--pm-font-size-2xs);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.device-resolution {
  font-size: var(--pm-font-size-2xs);
  color: var(--pm-text-low);
}

.device-actions {
  display: flex;
  align-items: center;
  gap: var(--pm-space-xs);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--pm-space-xs);
  padding: var(--pm-space-xs) var(--pm-space-sm);
  border-radius: var(--pm-radius-pill);
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(16, 20, 40, 0.65);
  color: var(--pm-text-muted);
  font-size: var(--pm-font-size-2xs);
  font-weight: 600;
  cursor: pointer;
  transition: var(--pm-transition-fast);
}

.action-btn:hover {
  color: var(--pm-text-default);
  border-color: var(--pm-color-border);
}

.action-btn.active {
  background: var(--pm-gradient-main);
  border-color: transparent;
  color: var(--pm-text-strong);
}

.action-btn.small {
  padding: var(--pm-space-2xs) var(--pm-space-sm);
}

@media (max-width: 1280px) {
  .pm-left-sidebar {
    max-width: none;
    flex-direction: row;
    align-items: stretch;
    border-radius: var(--pm-radius-lg);
  }

  .pm-left-sidebar__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--pm-space-xs);
  }

  .pm-left-sidebar__body {
    flex: 1;
  }
}

@media (max-width: 1100px) {
  .pm-left-sidebar {
    max-width: none;
  }
}

@media (max-width: 768px) {
  .pm-left-sidebar {
    border-radius: var(--pm-radius-md);
  }

  .pm-left-sidebar__body {
    padding: var(--pm-space-sm);
  }
}
</style>
