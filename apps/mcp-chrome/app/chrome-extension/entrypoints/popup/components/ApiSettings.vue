<template>
  <div class="api-settings-container">
    <div class="settings-header">
      <h3 class="settings-title">API Settings</h3>
      <button class="refresh-button" @click="refreshEndpoints" :disabled="isRefreshing">
        {{ isRefreshing ? '[CHECKING...]' : '[REFRESH]' }}
      </button>
    </div>

    <div class="current-endpoint-card">
      <div class="endpoint-info">
        <span class="endpoint-label">Current Endpoint:</span>
        <span class="endpoint-value">{{ currentEndpoint?.description || 'None' }}</span>
      </div>
      <div v-if="currentEndpoint" class="endpoint-details">
        <span class="detail-item">{{ currentEndpoint.protocol }}://{{ currentEndpoint.url }}</span>
        <span v-if="currentEndpoint.port" class="detail-item">:{{ currentEndpoint.port }}</span>
        <span :class="['status-indicator', currentEndpoint.isLocal ? 'local' : 'remote']">
          {{ currentEndpoint.isLocal ? 'LOCAL' : 'REMOTE' }}
        </span>
      </div>
    </div>

    <div class="endpoints-section">
      <div class="section-header">
        <h4 class="section-title">Available Endpoints</h4>
        <button class="auto-detect-button" @click="autoDetect" :disabled="isAutoDetecting">
          {{ isAutoDetecting ? '[AUTO-DETECTING...]' : '[AUTO DETECT]' }}
        </button>
      </div>

      <div class="endpoints-list">
        <div
          v-for="endpoint in sortedEndpoints"
          :key="endpoint.id"
          :class="['endpoint-item', {
            active: isCurrentEndpoint(endpoint.id),
            available: getEndpointStatus(endpoint.id)?.isAvailable
          }]"
          @click="selectEndpoint(endpoint.id)"
        >
          <div class="endpoint-item-header">
            <div class="endpoint-item-info">
              <span class="endpoint-item-name">{{ endpoint.description }}</span>
              <span class="endpoint-item-url">
                {{ endpoint.protocol }}://{{ endpoint.url }}{{ endpoint.port ? ':' + endpoint.port : '' }}
              </span>
            </div>
            <div class="endpoint-item-status">
              <span v-if="getEndpointStatus(endpoint.id)" class="response-time">
                {{ formatResponseTime(getEndpointStatus(endpoint.id)!.responseTime) }}
              </span>
              <span :class="['status-dot', getStatusClass(endpoint.id)]"></span>
            </div>
          </div>
          <div class="endpoint-item-tags">
            <span class="tag priority">P{{ endpoint.priority }}</span>
            <span :class="['tag', endpoint.isLocal ? 'local' : 'remote']">
              {{ endpoint.isLocal ? 'LOCAL' : 'REMOTE' }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="custom-endpoint-section">
      <h4 class="section-title">Add Custom Endpoint</h4>
      <div class="custom-endpoint-form">
        <input
          v-model="customUrl"
          type="text"
          placeholder="Enter URL (e.g., api.example.com)"
          class="custom-input"
        />
        <div class="custom-options">
          <select v-model="customProtocol" class="custom-select">
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
          <input
            v-model.number="customPort"
            type="number"
            placeholder="Port (optional)"
            class="custom-input-small"
          />
        </div>
        <button class="add-button" @click="addCustomEndpoint" :disabled="!customUrl">
          [ADD ENDPOINT]
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { apiManager } from '@/services/ApiManager';
import type { ApiEndpoint, EndpointStatus } from '@/services/ApiManager';

const currentEndpoint = ref<ApiEndpoint | null>(null);
const endpointStatuses = ref<EndpointStatus[]>([]);
const isRefreshing = ref(false);
const isAutoDetecting = ref(false);

const customUrl = ref('');
const customProtocol = ref<'http' | 'https'>('http');
const customPort = ref<number | undefined>(undefined);

const sortedEndpoints = computed(() => {
  return apiManager.getAllEndpoints().sort((a, b) => a.priority - b.priority);
});

const isCurrentEndpoint = (endpointId: string) => {
  return currentEndpoint.value?.id === endpointId;
};

const getEndpointStatus = (endpointId: string): EndpointStatus | undefined => {
  return endpointStatuses.value.find(s => s.endpoint.id === endpointId);
};

const getStatusClass = (endpointId: string): string => {
  const status = getEndpointStatus(endpointId);
  if (!status) return 'unknown';
  return status.isAvailable ? 'available' : 'unavailable';
};

const formatResponseTime = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

const refreshEndpoints = async () => {
  if (isRefreshing.value) return;

  isRefreshing.value = true;
  try {
    const endpoints = apiManager.getAllEndpoints();
    const statusPromises = endpoints.map(endpoint =>
      apiManager.checkEndpoint(endpoint, 2000)
    );

    const statuses = await Promise.all(statusPromises);
    endpointStatuses.value = statuses;

    console.log('[API Settings] Refreshed endpoint statuses:', statuses);
  } catch (error) {
    console.error('[API Settings] Failed to refresh endpoints:', error);
  } finally {
    isRefreshing.value = false;
  }
};

const autoDetect = async () => {
  if (isAutoDetecting.value) return;

  isAutoDetecting.value = true;
  try {
    const detected = await apiManager.autoDetectEndpoint(1000);
    if (detected) {
      currentEndpoint.value = detected;
      await refreshEndpoints();
      console.log('[API Settings] Auto-detected endpoint:', detected.id);
    } else {
      console.warn('[API Settings] No available endpoint found');
    }
  } catch (error) {
    console.error('[API Settings] Auto-detection failed:', error);
  } finally {
    isAutoDetecting.value = false;
  }
};

const selectEndpoint = async (endpointId: string) => {
  const success = await apiManager.setEndpoint(endpointId);
  if (success) {
    currentEndpoint.value = apiManager.getCurrentEndpoint();
    console.log('[API Settings] Selected endpoint:', endpointId);
  }
};

const addCustomEndpoint = async () => {
  if (!customUrl.value) return;

  try {
    const id = await apiManager.addCustomEndpoint({
      url: customUrl.value,
      protocol: customProtocol.value,
      port: customPort.value,
      priority: 99,
      isLocal: false,
      description: `Custom: ${customUrl.value}`,
    });

    console.log('[API Settings] Added custom endpoint:', id);

    customUrl.value = '';
    customPort.value = undefined;

    await refreshEndpoints();
  } catch (error) {
    console.error('[API Settings] Failed to add custom endpoint:', error);
  }
};

onMounted(async () => {
  await apiManager.initialize({ autoDetect: false });
  currentEndpoint.value = apiManager.getCurrentEndpoint();
  await refreshEndpoints();
});
</script>

