<template>
  <div class="client-mode-section">
    <div class="client-config-card">
      <div class="config-header">
        <span class="config-label">Auto-Translate Service</span>
        <div class="config-controls">
          <span :class="['status-indicator', clientService.isRunning ? 'running' : 'stopped']">
            {{ clientService.isRunning ? 'RUNNING' : 'STOPPED' }}
          </span>
          <button
            class="service-button"
            @click="onToggleService"
            :disabled="!clientConfig.apiUrl"
          >
            {{ clientService.isRunning ? '[STOP]' : '[START]' }}
          </button>
        </div>
      </div>

      <div class="config-form">
        <div class="form-group">
          <label class="form-label">Server API URL:</label>
          <input
            :value="clientConfig.apiUrl"
            @input="onConfigChange('apiUrl', $event)"
            type="text"
            placeholder="https://api.example.com"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Fetch Interval (seconds):</label>
          <input
            :value="clientConfig.fetchInterval"
            @input="onConfigChange('fetchInterval', $event)"
            type="number"
            min="10"
            max="3600"
            class="form-input-small"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Batch Size:</label>
          <input
            :value="clientConfig.batchSize"
            @input="onConfigChange('batchSize', $event)"
            type="number"
            min="1"
            max="50"
            class="form-input-small"
          />
        </div>
      </div>

      <div v-if="clientService.stats" class="service-stats">
        <!-- Bento Layout: Main Stats -->
        <div class="stats-bento-grid">
          <div class="bento-card bento-primary">
            <div class="bento-label">Queue Total</div>
            <div class="bento-value">{{ clientService.stats.queueTotal || 0 }}</div>
          </div>
          <div class="bento-card bento-success">
            <div class="bento-label">New Tasks</div>
            <div class="bento-value bento-highlight">{{ clientService.stats.newTasks || 0 }}</div>
          </div>
          <div class="bento-card bento-warning">
            <div class="bento-label">Duplicates</div>
            <div class="bento-value">{{ clientService.stats.duplicateTasks || 0 }}</div>
          </div>
        </div>

        <!-- Traditional Stats -->
        <div class="stats-traditional">
          <div class="stat-item">
            <span class="stat-label">Pending:</span>
            <span class="stat-value">{{ clientService.stats.pending }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Translated:</span>
            <span class="stat-value">{{ clientService.stats.translated }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Failed:</span>
            <span class="stat-value">{{ clientService.stats.failed }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Last Run:</span>
            <span class="stat-value">{{ formatTimestamp(clientService.stats.lastRun) }}</span>
          </div>
          <div v-if="clientService.stats.workerId" class="stat-item">
            <span class="stat-label">Worker ID:</span>
            <span class="stat-value stat-worker-id">{{ clientService.stats.workerId }}</span>
          </div>
          <div v-if="clientService.stats.isOnline !== undefined" class="stat-item">
            <span class="stat-label">Status:</span>
            <span :class="['stat-value', 'stat-online', clientService.stats.isOnline ? 'online' : 'offline']">
              {{ clientService.stats.isOnline ? '● Online' : '○ Offline' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { ClientConfig, ClientServiceState } from '@/composables/useBingDictionaryClient';

interface Props {
  clientConfig: ClientConfig;
  clientService: ClientServiceState;
  formatTimestamp: (timestamp: number | null) => string;
}

interface Emits {
  (e: 'toggle-service'): void;
  (e: 'update-config', field: string, value: any): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const onToggleService = () => {
  emit('toggle-service');
};

const onConfigChange = (field: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = field === 'apiUrl' ? target.value : Number(target.value);
  emit('update-config', field, value);
};
</script>
