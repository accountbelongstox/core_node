<template>
  <BasePanel
    :model-value="modelValue"
    title="System Health Monitor"
    icon="💊"
    size="lg"
    variant="info"
    @close="handleClose"
  >
    <template #body>
      <div class="pm-panel__body" style="gap: 20px; min-width: 600px; max-height: 70vh; overflow-y: auto;">
        <!-- Loading State -->
        <div v-if="loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 16px;">
          <div style="width: 40px; height: 40px; border: 4px solid rgba(59, 130, 246, 0.2); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <div class="pm-text-sm" style="color: rgba(255, 255, 255, 0.7);">Loading system health...</div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; gap: 16px;">
          <div style="font-size: 48px;">⚠️</div>
          <div class="pm-text-sm pm-badge pm-badge--danger">{{ error }}</div>
          <BaseButton variant="primary" @click="refreshHealth" size="sm">
            Retry
          </BaseButton>
        </div>

        <!-- Health Data -->
        <div v-else-if="healthData" style="display: flex; flex-direction: column; gap: 20px;">
          <!-- Service Status -->
          <div class="pm-panel pm-panel--blue">
            <div class="pm-panel__header">
              <span style="font-size: 20px;">🏥</span>
              <span class="pm-panel__title">Service Status</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
              <div class="pm-form-group">
                <div class="pm-form-label">Status</div>
                <div class="pm-text-base pm-font-semibold" :class="getStatusBadgeClass(healthData.status)" style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; animation: pulse 2s infinite;" :style="{ background: healthData.status === 'healthy' ? '#22c55e' : '#ef4444' }"></span>
                  {{ healthData.status }}
                </div>
              </div>
              <div class="pm-form-group">
                <div class="pm-form-label">Service</div>
                <div class="pm-text-base pm-font-semibold">{{ healthData.service.name }}</div>
              </div>
              <div class="pm-form-group">
                <div class="pm-form-label">Version</div>
                <div class="pm-text-base pm-font-semibold">{{ healthData.service.version }}</div>
              </div>
              <div class="pm-form-group">
                <div class="pm-form-label">Uptime</div>
                <div class="pm-text-base pm-font-semibold">{{ formattedUptime }}</div>
              </div>
            </div>
          </div>

          <!-- System Information -->
          <div class="pm-panel pm-panel--default">
            <div class="pm-panel__header">
              <span style="font-size: 20px;">💻</span>
              <span class="pm-panel__title">System Information</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
              <div class="pm-form-group">
                <div class="pm-form-label">Platform</div>
                <div class="pm-text-base" style="font-family: monospace;">{{ healthData.system.platform }}</div>
              </div>
              <div class="pm-form-group">
                <div class="pm-form-label">Architecture</div>
                <div class="pm-text-base" style="font-family: monospace;">{{ healthData.system.architecture }}</div>
              </div>
              <div class="pm-form-group">
                <div class="pm-form-label">Python Version</div>
                <div class="pm-text-base" style="font-family: monospace;">{{ healthData.system.python_version }}</div>
              </div>
            </div>
          </div>

          <!-- Resource Usage -->
          <div class="pm-panel pm-panel--default">
            <div class="pm-panel__header">
              <span style="font-size: 20px;">📊</span>
              <span class="pm-panel__title">Resource Usage</span>
            </div>

            <!-- CPU Usage -->
            <div class="pm-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span class="pm-form-label">CPU</span>
                <span class="pm-text-base pm-font-semibold" style="font-family: monospace;">{{ healthData.resources.cpu.usage_percent.toFixed(1) }}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                <div
                  style="height: 100%; border-radius: 4px; transition: width 0.3s ease;"
                  :class="getResourceGradientClass('cpu')"
                  :style="{ width: `${healthData.resources.cpu.usage_percent}%` }"
                ></div>
              </div>
              <div class="pm-text-xs" style="color: rgba(255, 255, 255, 0.6);">
                {{ healthData.resources.cpu.cores }} cores
              </div>
            </div>

            <!-- Memory Usage -->
            <div class="pm-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span class="pm-form-label">Memory</span>
                <span class="pm-text-base pm-font-semibold" style="font-family: monospace;">{{ healthData.resources.memory.used_percent.toFixed(1) }}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                <div
                  style="height: 100%; border-radius: 4px; transition: width 0.3s ease;"
                  :class="getResourceGradientClass('memory')"
                  :style="{ width: `${healthData.resources.memory.used_percent}%` }"
                ></div>
              </div>
              <div class="pm-text-xs" style="color: rgba(255, 255, 255, 0.6);">
                {{ healthData.resources.memory.available_mb.toFixed(0) }} MB / {{ healthData.resources.memory.total_mb.toFixed(0) }} MB available
              </div>
            </div>

            <!-- Disk Usage -->
            <div class="pm-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span class="pm-form-label">Disk</span>
                <span class="pm-text-base pm-font-semibold" style="font-family: monospace;">{{ healthData.resources.disk.used_percent.toFixed(1) }}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                <div
                  style="height: 100%; border-radius: 4px; transition: width 0.3s ease;"
                  :class="getResourceGradientClass('disk')"
                  :style="{ width: `${healthData.resources.disk.used_percent}%` }"
                ></div>
              </div>
              <div class="pm-text-xs" style="color: rgba(255, 255, 255, 0.6);">
                {{ healthData.resources.disk.free_gb.toFixed(2) }} GB / {{ healthData.resources.disk.total_gb.toFixed(2) }} GB free
              </div>
            </div>
          </div>

          <!-- Performance Metrics -->
          <div v-if="hasPerformanceMetrics" class="pm-panel pm-panel--default">
            <div class="pm-panel__header">
              <span style="font-size: 20px;">⚡</span>
              <span class="pm-panel__title">Performance Metrics</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
              <div
                v-for="(metric, key) in performanceMetrics"
                :key="key"
                class="pm-form-group"
              >
                <div class="pm-form-label">{{ formatMetricName(key) }}</div>
                <div class="pm-text-base" style="font-family: monospace;">{{ formatMetricValue(metric) }}</div>
              </div>
            </div>
          </div>

          <!-- Last Updated -->
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <span class="pm-text-xs" style="color: rgba(255, 255, 255, 0.6);">Last updated:</span>
            <span class="pm-text-xs" style="color: rgba(255, 255, 255, 0.9); font-family: monospace;">{{ formattedTimestamp }}</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div style="display: flex; gap: 12px; justify-content: space-between; align-items: center;">
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
import { FALLBACK_HEALTH_RESPONSE } from '@/app_pymatrix_pages/constants/initial-state';

const props = defineProps<{
  modelValue: boolean;
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

function getStatusBadgeClass(status: string): string {
  return status === 'healthy' ? 'pm-badge pm-badge--success' : 'pm-badge pm-badge--danger';
}

function getResourceGradientClass(resource: 'cpu' | 'memory' | 'disk'): string {
  if (!healthData.value) return 'pm-gradient-green';

  const usagePercent = resource === 'cpu'
    ? healthData.value.resources.cpu.usage_percent
    : resource === 'memory'
    ? healthData.value.resources.memory.used_percent
    : healthData.value.resources.disk.used_percent;

  const status = pyMatrixHealthAPI.getResourceStatus(usagePercent);

  if (status === 'ok') return 'pm-gradient-green';
  if (status === 'warning') return 'pm-gradient-orange';
  return 'pm-gradient-red';
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

function refreshHealth() {
  loading.value = true;
  error.value = '';

  pyMatrixHealthAPI.getDetailedHealth().then(
    (data) => {
      healthData.value = data;
      loading.value = false;
    },
    (err) => {
      error.value = err instanceof Error ? err.message : 'Failed to fetch health data';
      console.warn('[SystemHealthMonitor] Using fallback telemetry');
      if (!healthData.value) {
        healthData.value = {
          ...FALLBACK_HEALTH_RESPONSE,
          timestamp: new Date().toISOString()
        };
      }
      loading.value = false;
    }
  );
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
@keyframes spin {
  to { transform: rotate(360deg); }
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
