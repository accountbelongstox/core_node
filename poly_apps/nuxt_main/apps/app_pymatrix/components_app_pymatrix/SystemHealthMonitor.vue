<template>
  <BasePanel
    :show="show"
    title="System Health Monitor"
    icon="💊"
    size="lg"
    variant="info"
    @close="handleClose"
  >
    <template #body>
      <div class="health-monitor">
        <!-- Loading State -->
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <div class="loading-text">Loading system health...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="error-state">
          <div class="error-icon">⚠️</div>
          <div class="error-text">{{ error }}</div>
          <BaseButton variant="primary" @click="refreshHealth" size="sm">
            Retry
          </BaseButton>
        </div>

        <!-- Health Data -->
        <div v-else-if="healthData" class="health-content">
          <!-- Service Status -->
          <div class="status-section">
            <div class="section-header">
              <span class="section-icon">🏥</span>
              <span class="section-title">Service Status</span>
            </div>
            <div class="status-grid">
              <div class="status-item">
                <div class="status-label">Status</div>
                <div class="status-value" :class="getStatusClass(healthData.status)">
                  <span class="status-dot"></span>
                  {{ healthData.status }}
                </div>
              </div>
              <div class="status-item">
                <div class="status-label">Service</div>
                <div class="status-value">{{ healthData.service.name }}</div>
              </div>
              <div class="status-item">
                <div class="status-label">Version</div>
                <div class="status-value">{{ healthData.service.version }}</div>
              </div>
              <div class="status-item">
                <div class="status-label">Uptime</div>
                <div class="status-value">{{ formattedUptime }}</div>
              </div>
            </div>
          </div>

          <!-- System Information -->
          <div class="info-section">
            <div class="section-header">
              <span class="section-icon">💻</span>
              <span class="section-title">System Information</span>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Platform</div>
                <div class="info-value">{{ healthData.system.platform }}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Architecture</div>
                <div class="info-value">{{ healthData.system.architecture }}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Python Version</div>
                <div class="info-value">{{ healthData.system.python_version }}</div>
              </div>
            </div>
          </div>

          <!-- Resource Usage -->
          <div class="resources-section">
            <div class="section-header">
              <span class="section-icon">📊</span>
              <span class="section-title">Resource Usage</span>
            </div>

            <!-- CPU Usage -->
            <div class="resource-item">
              <div class="resource-header">
                <span class="resource-name">CPU</span>
                <span class="resource-value">{{ healthData.resources.cpu.usage_percent.toFixed(1) }}%</span>
              </div>
              <div class="resource-bar">
                <div
                  class="resource-fill"
                  :class="getResourceClass('cpu')"
                  :style="{ width: `${healthData.resources.cpu.usage_percent}%` }"
                ></div>
              </div>
              <div class="resource-info">
                {{ healthData.resources.cpu.cores }} cores
              </div>
            </div>

            <!-- Memory Usage -->
            <div class="resource-item">
              <div class="resource-header">
                <span class="resource-name">Memory</span>
                <span class="resource-value">{{ healthData.resources.memory.used_percent.toFixed(1) }}%</span>
              </div>
              <div class="resource-bar">
                <div
                  class="resource-fill"
                  :class="getResourceClass('memory')"
                  :style="{ width: `${healthData.resources.memory.used_percent}%` }"
                ></div>
              </div>
              <div class="resource-info">
                {{ healthData.resources.memory.available_mb.toFixed(0) }} MB / {{ healthData.resources.memory.total_mb.toFixed(0) }} MB available
              </div>
            </div>

            <!-- Disk Usage -->
            <div class="resource-item">
              <div class="resource-header">
                <span class="resource-name">Disk</span>
                <span class="resource-value">{{ healthData.resources.disk.used_percent.toFixed(1) }}%</span>
              </div>
              <div class="resource-bar">
                <div
                  class="resource-fill"
                  :class="getResourceClass('disk')"
                  :style="{ width: `${healthData.resources.disk.used_percent}%` }"
                ></div>
              </div>
              <div class="resource-info">
                {{ healthData.resources.disk.free_gb.toFixed(2) }} GB / {{ healthData.resources.disk.total_gb.toFixed(2) }} GB free
              </div>
            </div>
          </div>

          <!-- Performance Metrics -->
          <div v-if="hasPerformanceMetrics" class="metrics-section">
            <div class="section-header">
              <span class="section-icon">⚡</span>
              <span class="section-title">Performance Metrics</span>
            </div>
            <div class="metrics-grid">
              <div
                v-for="(metric, key) in performanceMetrics"
                :key="key"
                class="metric-item"
              >
                <div class="metric-label">{{ formatMetricName(key) }}</div>
                <div class="metric-value">{{ formatMetricValue(metric) }}</div>
              </div>
            </div>
          </div>

          <!-- Last Updated -->
          <div class="updated-info">
            <span class="updated-label">Last updated:</span>
            <span class="updated-time">{{ formattedTimestamp }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="panel-actions">
        <BaseToggle
          v-model="autoRefresh"
          label="Auto-refresh"
          description="Refresh every 5 seconds"
          size="sm"
          icon="🔄"
        />
        <BaseButton variant="default" @click="handleClose">
          Close
        </BaseButton>
        <BaseButton
          variant="primary"
          :loading="loading"
          @click="refreshHealth"
        >
          Refresh
        </BaseButton>
      </div>
    </template>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';
import { pyMatrixHealthAPI, type DetailedHealthResponse } from '~/services/api/pymatrix/pymatrix-health-api';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const loading = ref(false);
const error = ref('');
const healthData = ref<DetailedHealthResponse | null>(null);
const autoRefresh = ref(false);
let refreshInterval: NodeJS.Timeout | null = null;

const formattedUptime = computed(() => {
  if (!healthData.value) return '';
  const now = Date.now() / 1000;
  const uptime = now - healthData.value.uptime_seconds;
  return pyMatrixHealthAPI.formatUptime(uptime);
});

const formattedTimestamp = computed(() => {
  if (!healthData.value) return '';
  return new Date(healthData.value.timestamp).toLocaleString();
});

const hasPerformanceMetrics = computed(() => {
  if (!healthData.value) return false;
  const metrics = healthData.value.performance_metrics;
  return metrics && Object.keys(metrics).length > 0 && !metrics.message;
});

const performanceMetrics = computed(() => {
  if (!hasPerformanceMetrics.value) return {};
  return healthData.value!.performance_metrics;
});

function getStatusClass(status: string): string {
  return status === 'healthy' ? 'status-healthy' : 'status-unhealthy';
}

function getResourceClass(resource: 'cpu' | 'memory' | 'disk'): string {
  if (!healthData.value) return 'resource-ok';

  const usagePercent = resource === 'cpu'
    ? healthData.value.resources.cpu.usage_percent
    : resource === 'memory'
    ? healthData.value.resources.memory.used_percent
    : healthData.value.resources.disk.used_percent;

  const status = pyMatrixHealthAPI.getResourceStatus(usagePercent);

  return `resource-${status}`;
}

function formatMetricName(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatMetricValue(value: any): string {
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

async function refreshHealth() {
  loading.value = true;
  error.value = '';

  try {
    healthData.value = await pyMatrixHealthAPI.getDetailedHealth();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to fetch health data';
    console.error('[SystemHealthMonitor] Error:', err);
  } finally {
    loading.value = false;
  }
}

function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  refreshInterval = setInterval(() => {
    refreshHealth();
  }, 5000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

function handleClose() {
  stopAutoRefresh();
  emit('close');
}

watch(() => autoRefresh.value, (enabled) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

watch(() => props.show, (isShown) => {
  if (isShown && !healthData.value) {
    refreshHealth();
  }
  if (!isShown) {
    stopAutoRefresh();
    autoRefresh.value = false;
  }
});

onMounted(() => {
  if (props.show) {
    refreshHealth();
  }
});

onBeforeUnmount(() => {
  stopAutoRefresh();
});
</script>

<style scoped>
.health-monitor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 600px;
  max-height: 70vh;
  overflow-y: auto;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 16px;
}

.error-icon {
  font-size: 48px;
}

.error-text {
  font-size: 14px;
  color: #ef4444;
  text-align: center;
}

/* Section Styles */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-icon {
  font-size: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Status Section */
.status-section {
  background: rgba(59, 130, 246, 0.1);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.status-value {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-healthy .status-dot {
  background: #22c55e;
}

.status-unhealthy .status-dot {
  background: #ef4444;
}

/* Info Section */
.info-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 16px;
  border-radius: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.info-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-family: monospace;
}

/* Resources Section */
.resources-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 16px;
  border-radius: 8px;
}

.resource-item {
  margin-bottom: 16px;
}

.resource-item:last-child {
  margin-bottom: 0;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.resource-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.resource-value {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
}

.resource-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.resource-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.resource-ok {
  background: linear-gradient(90deg, #22c55e, #4ade80);
}

.resource-warning {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.resource-critical {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.resource-info {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

/* Metrics Section */
.metrics-section {
  background: rgba(255, 255, 255, 0.05);
  padding: 16px;
  border-radius: 8px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.metric-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-family: monospace;
}

/* Updated Info */
.updated-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
}

.updated-label {
  color: rgba(255, 255, 255, 0.6);
}

.updated-time {
  color: rgba(255, 255, 255, 0.9);
  font-family: monospace;
}

/* Panel Actions */
.panel-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: center;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
