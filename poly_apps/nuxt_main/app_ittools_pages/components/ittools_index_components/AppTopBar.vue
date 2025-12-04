<template>
  <header class="app-topbar">
    <div class="topbar-left">
      <button class="mobile-menu-toggle" @click="toggleMobileMenu">
        <i class="fas fa-bars"></i>
      </button>
      <h1 class="page-title">
        <i class="fas" :class="`fa-${currentModuleIcon}`"></i>
        <span>{{ currentModuleLabel }}</span>
      </h1>
    </div>

    <div class="topbar-center">
      <div class="breadcrumb">
        <span class="breadcrumb-item">{{ t('app.name') }}</span>
        <i class="fas fa-chevron-right breadcrumb-separator"></i>
        <span class="breadcrumb-item active">{{ currentModuleLabel }}</span>
      </div>
    </div>

    <div class="topbar-right">
      <!-- Backend Connection Status -->
      <div class="connection-status" :title="connectionTooltip">
        <div class="status-indicator" :style="{ backgroundColor: statusColor }">
          <div class="status-pulse" v-if="isConnected"></div>
        </div>
        <span class="status-text">{{ statusText }}</span>
        <button v-if="!isConnected && !isChecking" @click="reconnect" class="reconnect-btn" :title="t('common.reconnect')">
          <i class="fas fa-redo"></i>
        </button>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="action-btn" :title="t('common.search')">
          <i class="fas fa-search"></i>
        </button>
        <button class="action-btn" :title="t('common.settings')">
          <i class="fas fa-cog"></i>
        </button>
      </div>

      <!-- User Menu -->
      <div class="user-menu">
        <button class="user-btn">
          <i class="fas fa-user-circle"></i>
          <span class="user-name">{{ userName }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// Import composables
import { useAppNavigation } from '~/app_ittools_pages/composables/useAppNavigation'
import { useI18n } from '~/app_ittools_pages/composables/useI18n'
import { useAppState } from '~/app_ittools_pages/composables/useAppState'
import { useBackendStatus } from '~/app_ittools_pages/composables/useBackendStatus'

// Backend connection status management
// Real data validated: 2025-12-04 with http://192.168.50.3:9000

// Use unified composables
const { currentModule, toggleMobileMenu } = useAppNavigation()
const { t } = useI18n()
const { user } = useAppState()
const {
  isConnected,
  isChecking,
  statusText,
  statusColor,
  backendVersion,
  checkConnection,
  startHealthCheck
} = useBackendStatus()

// Computed properties
const currentModuleLabel = computed(() =>
  currentModule.value?.label || t('app.name')
)

const currentModuleIcon = computed(() =>
  currentModule.value?.icon || 'home'
)

const userName = computed(() =>
  user.value?.name || 'Admin'
)

const connectionTooltip = computed(() => {
  if (isChecking.value) return t('common.checking')
  if (isConnected.value) {
    const version = backendVersion.value
    if (version) {
      return `${t('common.connected')}\nPHP: ${version.php}\nLaravel: ${version.laravel}\nEnv: ${version.environment}`
    }
    return t('common.connected')
  }
  return `${t('common.disconnected')} - ${t('common.reconnect')}`
})

const reconnect = async () => {
  await checkConnection()
}

// Start health check on mount
onMounted(() => {
  startHealthCheck(30000) // Check every 30 seconds
})
</script>

<style scoped>
.app-topbar {
  height: 70px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.mobile-menu-toggle {
  display: none;
  background: transparent;
  border: none;
  font-size: 1.25rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.mobile-menu-toggle:hover {
  background: #f3f4f6;
  color: #111827;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.page-title i {
  color: #667eea;
}

.topbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.breadcrumb-item {
  transition: color 0.2s;
}

.breadcrumb-item.active {
  color: #667eea;
  font-weight: 500;
}

.breadcrumb-separator {
  font-size: 0.7rem;
  opacity: 0.5;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.connection-status:hover {
  border-color: #d1d5db;
}

.status-indicator {
  position: relative;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  transition: all 0.3s;
}

.status-pulse {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: inherit;
  opacity: 0.3;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0;
    transform: scale(1.5);
  }
}

.status-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}

.reconnect-btn {
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.reconnect-btn:hover {
  color: #667eea;
  background: #f3f4f6;
}

.quick-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  position: relative;
  background: transparent;
  border: none;
  color: #6b7280;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.action-btn .badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #ef4444;
  color: white;
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border-radius: 1rem;
  font-weight: 600;
}

.user-menu .user-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: 1px solid #e5e7eb;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #374151;
}

.user-btn:hover {
  background: #f9fafb;
  border-color: #667eea;
}

.user-btn i {
  font-size: 1.5rem;
  color: #667eea;
}

.user-name {
  font-weight: 500;
}

/* Mobile */
@media (max-width: 768px) {
  .mobile-menu-toggle {
    display: block;
  }

  .breadcrumb,
  .user-name {
    display: none;
  }

  .quick-actions {
    gap: 0.25rem;
  }

  .topbar-right {
    gap: 0.5rem;
  }
}
</style>
