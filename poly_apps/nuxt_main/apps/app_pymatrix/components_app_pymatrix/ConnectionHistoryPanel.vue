<template>
  <BasePanel
    v-model="isOpen"
    title="Connection History"
    header-icon="📜"
    size="lg"
    variant="info"
    @close="handleClose"
  >
    <div class="pm-panel__body">
      <!-- Statistics Overview -->
      <div class="pm-stats-grid">
        <div class="pm-stat-card">
          <div class="pm-stat-card__icon">📊</div>
          <div class="pm-stat-card__info">
            <div class="pm-stat-card__value">{{ connectionHistoryStore.totalConnections }}</div>
            <div class="pm-stat-card__label">Total Connections</div>
          </div>
        </div>

        <div class="pm-stat-card">
          <div class="pm-stat-card__icon">⏱️</div>
          <div class="pm-stat-card__info">
            <div class="pm-stat-card__value">
              {{ connectionHistoryStore.formatDuration(connectionHistoryStore.totalConnectionTime) }}
            </div>
            <div class="pm-stat-card__label">Total Time</div>
          </div>
        </div>

        <div class="pm-stat-card">
          <div class="pm-stat-card__icon">⏰</div>
          <div class="pm-stat-card__info">
            <div class="pm-stat-card__value">
              {{ connectionHistoryStore.formatDuration(connectionHistoryStore.averageConnectionTime) }}
            </div>
            <div class="pm-stat-card__label">Avg Duration</div>
          </div>
        </div>

        <div class="pm-stat-card">
          <div class="pm-stat-card__icon">📱</div>
          <div class="pm-stat-card__info">
            <div class="pm-stat-card__value">{{ connectionHistoryStore.recentDevices.length }}</div>
            <div class="pm-stat-card__label">Unique Devices</div>
          </div>
        </div>
      </div>

      <!-- Top Devices -->
      <div class="pm-section">
        <div class="pm-section__header">
          <h3 class="pm-section__title">⭐ Top Devices</h3>
          <span class="pm-badge pm-badge--primary">{{ connectionHistoryStore.topDevices.length }}</span>
        </div>

        <div v-if="connectionHistoryStore.topDevices.length === 0" class="pm-empty-state">
          <div class="pm-empty-state__icon">📱</div>
          <p class="pm-empty-state__text">No devices connected yet</p>
        </div>

        <div v-else class="pm-list">
          <div
            v-for="device in connectionHistoryStore.topDevices"
            :key="device.serial"
            class="pm-card"
          >
            <div class="pm-card__header">
              <div class="pm-card__icon">📱</div>
              <div class="pm-card__info">
                <div class="pm-card__title">{{ device.deviceName }}</div>
                <div class="pm-card__subtitle">{{ device.model || device.serial }}</div>
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
            <div class="pm-card__body">
              <div class="pm-stat-inline">
                <span class="pm-stat-inline__icon">🔢</span>
                <span class="pm-stat-inline__text">{{ device.connectionCount }} connections</span>
              </div>
              <div class="pm-stat-inline">
                <span class="pm-stat-inline__icon">⏱️</span>
                <span class="pm-stat-inline__text">
                  {{ connectionHistoryStore.formatDuration(device.totalDuration) }} total
                </span>
              </div>
              <div class="pm-stat-inline">
                <span class="pm-stat-inline__icon">⏰</span>
                <span class="pm-stat-inline__text">
                  {{ connectionHistoryStore.formatDuration(device.averageDuration) }} avg
                </span>
              </div>
              <div class="pm-stat-inline">
                <span class="pm-stat-inline__icon">🕒</span>
                <span class="pm-stat-inline__text">
                  {{ connectionHistoryStore.formatTimestamp(device.lastConnected) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent History -->
      <div class="pm-section">
        <div class="pm-section__header">
          <h3 class="pm-section__title">📋 Recent Connections</h3>
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

        <div v-if="connectionHistoryStore.recentHistory.length === 0" class="pm-empty-state">
          <div class="pm-empty-state__icon">📋</div>
          <p class="pm-empty-state__text">No connection history</p>
          <p class="pm-empty-state__hint">Connect to a device to start tracking history</p>
        </div>

        <div v-else class="pm-list pm-list--compact">
          <div
            v-for="entry in connectionHistoryStore.recentHistory"
            :key="`${entry.serial}-${entry.connectedAt}`"
            class="pm-history-item"
          >
            <div class="pm-history-item__left">
              <div class="pm-history-item__icon">📱</div>
              <div class="pm-history-item__info">
                <div class="pm-history-item__title">{{ entry.deviceName }}</div>
                <div class="pm-history-item__subtitle">
                  {{ connectionHistoryStore.formatTimestamp(entry.connectedAt) }}
                </div>
              </div>
            </div>
            <div class="pm-history-item__right">
              <div
                v-if="entry.duration"
                class="pm-badge"
                :class="`pm-badge--quality-${entry.quality || 'good'}`"
              >
                {{ connectionHistoryStore.formatDuration(entry.duration) }}
              </div>
              <div v-else class="pm-badge pm-badge--success pm-badge--pulse">
                <span class="pm-badge__pulse-dot"></span>
                Active
              </div>
              <div
                v-if="entry.quality"
                class="pm-quality-indicator"
                :class="`pm-quality-indicator--${entry.quality}`"
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
/* ConnectionHistoryPanel Styles with NFTMax Theme */

/* Panel Body */
.pm-panel__body {
  padding: var(--pm-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-xl);
}

/* Stats Grid */
.pm-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--pm-space-md);
  animation: pm-fadeIn 0.5s ease;
}

/* Stat Card */
.pm-stat-card {
  display: flex;
  align-items: center;
  gap: var(--pm-space-md);
  background: var(--pm-color-surface);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-lg);
  padding: var(--pm-space-lg);
  transition: var(--pm-transition-fast);
  animation: pm-scaleUp 0.4s ease;
}

.pm-stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--pm-shadow-md);
  border-color: var(--pm-color-primary);
}

.pm-stat-card:nth-child(1) { animation-delay: 0s; }
.pm-stat-card:nth-child(2) { animation-delay: 0.1s; }
.pm-stat-card:nth-child(3) { animation-delay: 0.2s; }
.pm-stat-card:nth-child(4) { animation-delay: 0.3s; }

.pm-stat-card__icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.1) 0%, rgba(243, 57, 248, 0.1) 100%);
  border-radius: var(--pm-radius-lg);
  transition: var(--pm-transition-fast);
}

.pm-stat-card:hover .pm-stat-card__icon {
  transform: scale(1.1) rotate(5deg);
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.2) 0%, rgba(243, 57, 248, 0.2) 100%);
}

.pm-stat-card__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pm-stat-card__value {
  font-size: var(--pm-font-size-xl);
  font-weight: 700;
  background: var(--pm-gradient-main);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1;
}

.pm-stat-card__label {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-muted);
  font-weight: 500;
}

/* Section */
.pm-section {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-md);
  animation: pm-fadeUp 0.5s ease;
}

.pm-section:nth-of-type(2) { animation-delay: 0.4s; }
.pm-section:nth-of-type(3) { animation-delay: 0.6s; }

.pm-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 2px solid transparent;
  border-image: var(--pm-gradient-main) 1;
  border-image-slice: 1;
}

.pm-section__title {
  margin: 0;
  font-size: var(--pm-font-size-lg);
  font-weight: 600;
  color: var(--pm-text-default);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Badge */
.pm-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 28px;
  height: 28px;
  padding: 0 12px;
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
  border-radius: var(--pm-radius-pill);
  white-space: nowrap;
  transition: var(--pm-transition-fast);
}

.pm-badge--primary {
  background: var(--pm-gradient-main);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(243, 57, 248, 0.3);
}

.pm-badge--success {
  background: var(--pm-color-success);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
}

.pm-badge--pulse {
  position: relative;
  animation: pm-pulse 2s ease-in-out infinite;
}

.pm-badge__pulse-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #ffffff;
  border-radius: 50%;
  animation: pm-pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pm-pulse-dot {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.pm-badge--quality-excellent {
  background: var(--pm-color-success);
  color: #ffffff;
}

.pm-badge--quality-good {
  background: var(--pm-color-warning);
  color: #ffffff;
}

.pm-badge--quality-fair {
  background: #F2994A;
  color: #ffffff;
}

.pm-badge--quality-poor {
  background: var(--pm-color-danger);
  color: #ffffff;
}

/* List */
.pm-list {
  display: flex;
  flex-direction: column;
  gap: var(--pm-space-md);
}

.pm-list--compact {
  gap: 8px;
}

/* Card */
.pm-card {
  background: var(--pm-color-surface);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-lg);
  padding: var(--pm-space-lg);
  transition: var(--pm-transition-fast);
  animation: pm-fadeRight 0.4s ease;
}

.pm-card:hover {
  transform: translateX(4px);
  box-shadow: var(--pm-shadow-md);
  border-color: var(--pm-color-primary);
}

.pm-card__header {
  display: flex;
  align-items: center;
  gap: var(--pm-space-md);
  margin-bottom: var(--pm-space-md);
}

.pm-card__icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.1) 0%, rgba(243, 57, 248, 0.1) 100%);
  border-radius: var(--pm-radius-md);
  transition: var(--pm-transition-fast);
}

.pm-card:hover .pm-card__icon {
  transform: scale(1.1);
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.2) 0%, rgba(243, 57, 248, 0.2) 100%);
}

.pm-card__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pm-card__title {
  font-size: var(--pm-font-size-md);
  font-weight: 600;
  color: var(--pm-text-default);
}

.pm-card__subtitle {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-muted);
  font-family: 'Courier New', monospace;
}

.pm-card__body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  padding-top: var(--pm-space-md);
  border-top: 1px solid var(--pm-color-border-soft);
}

/* Stat Inline */
.pm-stat-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--pm-color-surface);
  border-radius: var(--pm-radius-md);
  transition: var(--pm-transition-fast);
}

.pm-stat-inline:hover {
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.05) 0%, rgba(243, 57, 248, 0.05) 100%);
}

.pm-stat-inline__icon {
  font-size: 16px;
}

.pm-stat-inline__text {
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-muted);
}

/* History Item */
.pm-history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pm-space-md);
  background: var(--pm-color-surface);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-md);
  transition: var(--pm-transition-fast);
  animation: pm-fadeIn 0.3s ease;
}

.pm-history-item:hover {
  transform: translateX(4px);
  border-color: var(--pm-color-primary);
  box-shadow: var(--pm-shadow-sm);
}

.pm-history-item__left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.pm-history-item__icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.1) 0%, rgba(243, 57, 248, 0.1) 100%);
  border-radius: var(--pm-radius-md);
  transition: var(--pm-transition-fast);
}

.pm-history-item:hover .pm-history-item__icon {
  transform: rotate(10deg) scale(1.1);
}

.pm-history-item__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pm-history-item__title {
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  color: var(--pm-text-default);
}

.pm-history-item__subtitle {
  font-size: var(--pm-font-size-xs);
  color: var(--pm-text-muted);
}

.pm-history-item__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Quality Indicator */
.pm-quality-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 16px;
  border-radius: 50%;
  transition: var(--pm-transition-fast);
}

.pm-quality-indicator:hover {
  transform: scale(1.2);
}

.pm-quality-indicator--excellent {
  background: rgba(39, 174, 96, 0.1);
}

.pm-quality-indicator--good {
  background: rgba(242, 153, 74, 0.1);
}

.pm-quality-indicator--fair {
  background: rgba(242, 153, 74, 0.15);
}

.pm-quality-indicator--poor {
  background: rgba(235, 87, 87, 0.1);
}

/* Empty State */
.pm-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
}

.pm-empty-state__icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.3;
  animation: pm-pulse 2s ease-in-out infinite;
}

.pm-empty-state__text {
  margin: 0 0 8px 0;
  font-size: var(--pm-font-size-base);
  font-weight: 600;
  color: var(--pm-text-muted);
}

.pm-empty-state__hint {
  margin: 0;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-muted);
}

/* Animations */
@keyframes pm-fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pm-scaleUp {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

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

@keyframes pm-fadeRight {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

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

/* Responsive */
@media (max-width: 1278px) {
  .pm-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .pm-card__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .pm-panel__body {
    padding: var(--pm-space-md);
    gap: var(--pm-space-lg);
  }

  .pm-stats-grid {
    grid-template-columns: 1fr;
  }

  .pm-stat-card {
    padding: var(--pm-space-md);
  }

  .pm-stat-card__icon {
    width: 48px;
    height: 48px;
    font-size: 28px;
  }

  .pm-section__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .pm-card__header {
    flex-wrap: wrap;
  }

  .pm-history-item {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .pm-history-item__right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
