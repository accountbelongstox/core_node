<template>
  <div class="system-info-panel">
    <div class="panel-header">
      <h2 class="module-title">{{ t('systemInfo.title') }}</h2>
      <button @click="refreshAll" :disabled="isRefreshing" class="refresh-btn">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': isRefreshing }"></i>
        {{ t('systemInfo.refresh') }}
      </button>
    </div>

    <div class="info-grid">
      <!-- PHP Information Card -->
      <div class="info-card glass-panel">
        <div class="card-header">
          <i class="fas fa-code icon-php"></i>
          <h3>{{ t('systemInfo.phpInfo') }}</h3>
        </div>
        <div v-if="phpInfo" class="card-content">
          <div class="info-row">
            <span class="label">{{ t('systemInfo.version') }}</span>
            <span class="value">{{ phpInfo.version }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.memory') }}</span>
            <span class="value">{{ phpInfo.memoryLimit }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.timezone') }}</span>
            <span class="value">{{ phpInfo.timezone }}</span>
          </div>
        </div>
        <div v-else class="card-loading">
          <i class="fas fa-spinner fa-spin"></i>
          {{ t('common.loading') }}
        </div>
      </div>

      <!-- Laravel Information Card -->
      <div class="info-card glass-panel">
        <div class="card-header">
          <i class="fab fa-laravel icon-laravel"></i>
          <h3>{{ t('systemInfo.laravelInfo') }}</h3>
        </div>
        <div v-if="laravelInfo" class="card-content">
          <div class="info-row">
            <span class="label">{{ t('systemInfo.version') }}</span>
            <span class="value">{{ laravelInfo.version }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.environment') }}</span>
            <span class="value">
              <span class="env-badge" :class="`env-${laravelInfo.environment}`">
                {{ laravelInfo.environment }}
              </span>
            </span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.debug') }}</span>
            <span class="value">
              <span class="bool-badge" :class="{ active: laravelInfo.debug }">
                {{ laravelInfo.debug ? 'ON' : 'OFF' }}
              </span>
            </span>
          </div>
        </div>
        <div v-else class="card-loading">
          <i class="fas fa-spinner fa-spin"></i>
          {{ t('common.loading') }}
        </div>
      </div>

      <!-- Server Information Card -->
      <div class="info-card glass-panel">
        <div class="card-header">
          <i class="fas fa-server icon-server"></i>
          <h3>{{ t('systemInfo.serverInfo') }}</h3>
        </div>
        <div v-if="serverInfo" class="card-content">
          <div class="info-row">
            <span class="label">{{ t('systemInfo.uptime') }}</span>
            <span class="value">{{ formatUptime(serverInfo.uptime) }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.loadAverage') }}</span>
            <span class="value">{{ serverInfo.loadAverage }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.diskSpace') }}</span>
            <span class="value">{{ serverInfo.diskUsage }}%</span>
          </div>
        </div>
        <div v-else class="card-loading">
          <i class="fas fa-spinner fa-spin"></i>
          {{ t('common.loading') }}
        </div>
      </div>

      <!-- Database Information Card -->
      <div class="info-card glass-panel">
        <div class="card-header">
          <i class="fas fa-database icon-database"></i>
          <h3>{{ t('systemInfo.databaseInfo') }}</h3>
        </div>
        <div v-if="databaseInfo" class="card-content">
          <div class="info-row">
            <span class="label">{{ t('systemInfo.version') }}</span>
            <span class="value">{{ databaseInfo.version }}</span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.connection') }}</span>
            <span class="value">
              <span class="status-badge" :class="{ active: databaseInfo.connected }">
                {{ databaseInfo.connected ? t('common.connected') : t('common.disconnected') }}
              </span>
            </span>
          </div>
          <div class="info-row">
            <span class="label">{{ t('systemInfo.driver') }}</span>
            <span class="value">{{ databaseInfo.driver }}</span>
          </div>
        </div>
        <div v-else class="card-loading">
          <i class="fas fa-spinner fa-spin"></i>
          {{ t('common.loading') }}
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-message glass-panel">
      <i class="fas fa-exclamation-triangle"></i>
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// System Information Panel - displays real backend system data
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/api/get_system_status

import { useI18n } from '~/app_ittools_pages/composables/useI18n'
import { useSystemInfo } from '~/app_ittools_pages/composables/useSystemInfo'

interface PhpInfo {
  version: string
  memoryLimit: string
  timezone: string
}

interface LaravelInfo {
  version: string
  environment: string
  debug: boolean
}

interface ServerInfo {
  uptime: number
  loadAverage: string
  diskUsage: number
}

interface DatabaseInfo {
  version: string
  connected: boolean
  driver: string
}

// Use unified composables
const { t } = useI18n()
const {
  systemInfo,
  isLoading,
  error,
  cpuUsage,
  memoryUsage,
  diskUsage,
  loadAverage,
  fetchSystemInfo
} = useSystemInfo()

// Computed values for display
const phpInfo = computed(() => {
  if (!systemInfo.value) return null
  return {
    version: systemInfo.value.core_information.php_version,
    memoryLimit: systemInfo.value.php_configuration.memory_limit,
    timezone: systemInfo.value.core_information.timezone
  }
})

const laravelInfo = computed(() => {
  if (!systemInfo.value) return null
  return {
    version: systemInfo.value.core_information.laravel_version,
    environment: systemInfo.value.core_information.environment,
    debug: systemInfo.value.core_information.debug_mode === 'Enabled'
  }
})

const serverInfo = computed(() => {
  if (!systemInfo.value) return null
  return {
    uptime: 0, // Not provided in API
    loadAverage: loadAverage.value ?
      `${loadAverage.value.oneMin.toFixed(2)}, ${loadAverage.value.fiveMin.toFixed(2)}, ${loadAverage.value.fifteenMin.toFixed(2)}` :
      'N/A',
    diskUsage: diskUsage.value ? diskUsage.value.percentage : 0
  }
})

const databaseInfo = computed(() => {
  if (!systemInfo.value) return null
  return {
    version: systemInfo.value.database_information.database_version,
    connected: systemInfo.value.database_information.status === 'Connected',
    driver: systemInfo.value.database_information.connection_driver
  }
})

// Refresh all information
const refreshAll = async () => {
  await fetchSystemInfo()
}

const isRefreshing = computed(() => isLoading.value)

// Format uptime
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

// Load data on mount
onMounted(() => {
  fetchSystemInfo()
})
</script>

<style scoped>
.system-info-panel {
  padding: 1.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.module-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.refresh-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.info-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}

.info-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f3f4f6;
}

.card-header i {
  font-size: 1.5rem;
}

.icon-php {
  color: #777bb4;
}

.icon-laravel {
  color: #ff2d20;
}

.icon-server {
  color: #10b981;
}

.icon-database {
  color: #3b82f6;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.value {
  font-size: 0.95rem;
  color: #1f2937;
  font-weight: 600;
}

.env-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.env-local {
  background: #dbeafe;
  color: #1e40af;
}

.env-development {
  background: #fef3c7;
  color: #92400e;
}

.env-staging {
  background: #fce7f3;
  color: #831843;
}

.env-production {
  background: #dcfce7;
  color: #14532d;
}

.bool-badge,
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #fee2e2;
  color: #991b1b;
}

.bool-badge.active,
.status-badge.active {
  background: #d1fae5;
  color: #065f46;
}

.card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: #6b7280;
}

.error-message {
  margin-top: 1.5rem;
  background: #fef2f2;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  padding: 1rem;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
