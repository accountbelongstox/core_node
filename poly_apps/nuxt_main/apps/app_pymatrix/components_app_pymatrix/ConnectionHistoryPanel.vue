<template>
  <BasePanel
    v-model="isOpen"
    title="Connection History"
    header-icon="📜"
    size="lg"
    variant="info"
    @close="handleClose"
  >
    <div class="history-content">
      <!-- Statistics Overview -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-info">
            <div class="stat-value">{{ connectionHistoryStore.totalConnections }}</div>
            <div class="stat-label">Total Connections</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⏱️</div>
          <div class="stat-info">
            <div class="stat-value">
              {{ connectionHistoryStore.formatDuration(connectionHistoryStore.totalConnectionTime) }}
            </div>
            <div class="stat-label">Total Time</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⏰</div>
          <div class="stat-info">
            <div class="stat-value">
              {{ connectionHistoryStore.formatDuration(connectionHistoryStore.averageConnectionTime) }}
            </div>
            <div class="stat-label">Avg Duration</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📱</div>
          <div class="stat-info">
            <div class="stat-value">{{ connectionHistoryStore.recentDevices.length }}</div>
            <div class="stat-label">Unique Devices</div>
          </div>
        </div>
      </div>

      <!-- Top Devices -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">⭐ Top Devices</h3>
          <span class="section-badge">{{ connectionHistoryStore.topDevices.length }}</span>
        </div>

        <div v-if="connectionHistoryStore.topDevices.length === 0" class="empty-state">
          <div class="empty-icon">📱</div>
          <p class="empty-text">No devices connected yet</p>
        </div>

        <div v-else class="device-list">
          <div
            v-for="device in connectionHistoryStore.topDevices"
            :key="device.serial"
            class="device-item"
          >
            <div class="device-header">
              <div class="device-icon">📱</div>
              <div class="device-info">
                <div class="device-name">{{ device.deviceName }}</div>
                <div class="device-model">{{ device.model || device.serial }}</div>
              </div>
              <BaseButton
                variant="primary"
                size="sm"
                icon="🔗"
                @click="handleQuickConnect(device)"
              >
                Quick Connect
              </BaseButton>
            </div>
            <div class="device-stats">
              <div class="device-stat">
                <span class="stat-icon-small">🔢</span>
                <span class="stat-text">{{ device.connectionCount }} connections</span>
              </div>
              <div class="device-stat">
                <span class="stat-icon-small">⏱️</span>
                <span class="stat-text">
                  {{ connectionHistoryStore.formatDuration(device.totalDuration) }} total
                </span>
              </div>
              <div class="device-stat">
                <span class="stat-icon-small">⏰</span>
                <span class="stat-text">
                  {{ connectionHistoryStore.formatDuration(device.averageDuration) }} avg
                </span>
              </div>
              <div class="device-stat">
                <span class="stat-icon-small">🕒</span>
                <span class="stat-text">
                  {{ connectionHistoryStore.formatTimestamp(device.lastConnected) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent History -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">📋 Recent Connections</h3>
          <BaseButton
            v-if="connectionHistoryStore.history.length > 0"
            variant="ghost"
            size="sm"
            icon="🗑️"
            @click="handleClearHistory"
          >
            Clear All
          </BaseButton>
        </div>

        <div v-if="connectionHistoryStore.recentHistory.length === 0" class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-text">No connection history</p>
          <p class="empty-hint">Connect to a device to start tracking history</p>
        </div>

        <div v-else class="history-list">
          <div
            v-for="entry in connectionHistoryStore.recentHistory"
            :key="`${entry.serial}-${entry.connectedAt}`"
            class="history-item"
          >
            <div class="history-left">
              <div class="history-icon">📱</div>
              <div class="history-info">
                <div class="history-device">{{ entry.deviceName }}</div>
                <div class="history-time">
                  {{ connectionHistoryStore.formatTimestamp(entry.connectedAt) }}
                </div>
              </div>
            </div>
            <div class="history-right">
              <div
                v-if="entry.duration"
                class="history-duration"
                :class="`quality-${entry.quality || 'good'}`"
              >
                {{ connectionHistoryStore.formatDuration(entry.duration) }}
              </div>
              <div v-else class="history-active">
                <span class="pulse-dot"></span>
                Active
              </div>
              <div
                v-if="entry.quality"
                class="quality-badge"
                :class="`quality-${entry.quality}`"
                :title="`Connection quality: ${entry.quality}`"
              >
                {{ getQualityIcon(entry.quality) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useConnectionHistoryStore } from '../stores_app_pymatrix/connectionHistoryStore';
import { useToast } from '../composables_app_pymatrix/useToast';
import type { RecentDevice } from '../stores_app_pymatrix/connectionHistoryStore';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';

interface Props {
  show?: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'quick-connect', device: RecentDevice): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: true
});

const emit = defineEmits<Emits>();

const connectionHistoryStore = useConnectionHistoryStore();
const toast = useToast();
const isOpen = ref(props.show);

function handleClose() {
  isOpen.value = false;
  emit('close');
}

function handleQuickConnect(device: RecentDevice) {
  emit('quick-connect', device);
  toast.info(`Connecting to ${device.deviceName}...`, 'Quick Connect');
}

function handleClearHistory() {
  if (confirm('Are you sure you want to clear all connection history?')) {
    connectionHistoryStore.clearHistory();
    toast.success('Connection history cleared', 'History');
  }
}

function getQualityIcon(quality: string): string {
  const icons: Record<string, string> = {
    'excellent': '🟢',
    'good': '🟡',
    'fair': '🟠',
    'poor': '🔴'
  };
  return icons[quality] || '⚪';
}
</script>

<style scoped>
.history-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.stat-icon {
  font-size: 32px;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Section */
.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 2px solid #e5e7eb;
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 10px;
  background: #3b82f6;
  border-radius: 14px;
  color: white;
  font-size: 13px;
  font-weight: 700;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-text {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #6b7280;
}

.empty-hint {
  margin: 0;
  font-size: 14px;
  color: #9ca3af;
}

/* Device List */
.device-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.device-item {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.device-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.device-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.device-icon {
  font-size: 24px;
}

.device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.device-model {
  font-size: 13px;
  color: #6b7280;
}

.device-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-left: 36px;
}

.device-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #6b7280;
}

.stat-icon-small {
  font-size: 14px;
}

.stat-text {
  font-weight: 500;
}

/* History List */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.history-item:hover {
  background: #f3f4f6;
  transform: translateX(4px);
}

.history-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.history-icon {
  font-size: 20px;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-device {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.history-time {
  font-size: 12px;
  color: #6b7280;
}

.history-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.history-duration {
  padding: 4px 12px;
  background: #e5e7eb;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.history-duration.quality-excellent {
  background: #d1fae5;
  color: #065f46;
}

.history-duration.quality-good {
  background: #fef3c7;
  color: #92400e;
}

.history-duration.quality-fair {
  background: #fed7aa;
  color: #9a3412;
}

.history-duration.quality-poor {
  background: #fecaca;
  color: #991b1b;
}

.history-active {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #d1fae5;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #065f46;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}

.quality-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 16px;
  border-radius: 50%;
  background: #f3f4f6;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .device-stats {
    padding-left: 0;
  }

  .history-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .history-right {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
