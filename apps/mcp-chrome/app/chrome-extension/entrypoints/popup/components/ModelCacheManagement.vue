<template>
  <div class="model-cache-section">
    <h2 class="section-title">{{ getMessage('modelCacheManagementLabel') }}</h2>

    <!-- Cache Statistics Grid -->
    <div class="stats-grid">
      <div class="stats-card">
        <div class="stats-header">
          <p class="stats-label">{{ getMessage('cacheSizeLabel') }}</p>
          <span class="stats-icon orange">
            <DatabaseIcon />
          </span>
        </div>
        <p class="stats-value">{{ cacheStats?.totalSizeMB || 0 }} MB</p>
      </div>

      <div class="stats-card">
        <div class="stats-header">
          <p class="stats-label">{{ getMessage('cacheEntriesLabel') }}</p>
          <span class="stats-icon purple">
            <VectorIcon />
          </span>
        </div>
        <p class="stats-value">{{ cacheStats?.entryCount || 0 }}</p>
      </div>
    </div>

    <!-- Cache Entries Details -->
    <div v-if="cacheStats && cacheStats.entries.length > 0" class="cache-details">
      <h3 class="cache-details-title">{{ getMessage('cacheDetailsLabel') }}</h3>
      <div class="cache-entries">
        <div v-for="entry in cacheStats.entries" :key="entry.url" class="cache-entry">
          <div class="entry-info">
            <div class="entry-url">{{ getModelNameFromUrl(entry.url) }}</div>
            <div class="entry-details">
              <span class="entry-size">{{ entry.sizeMB }} MB</span>
              <span class="entry-age">{{ entry.age }}</span>
              <span v-if="entry.expired" class="entry-expired">{{ getMessage('expiredLabel') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Cache Message -->
    <div v-else-if="cacheStats && cacheStats.entries.length === 0" class="no-cache">
      <p>{{ getMessage('noCacheDataMessage') }}</p>
    </div>

    <!-- Loading State -->
    <div v-else-if="!cacheStats" class="loading-cache">
      <p>{{ getMessage('loadingCacheInfoStatus') }}</p>
    </div>

    <!-- Progress Indicator -->
    <ProgressIndicator
      v-if="isManagingCache"
      :visible="isManagingCache"
      :text="isManagingCache ? getMessage('processingCacheStatus') : ''"
      :showSpinner="true"
    />

    <!-- Action Buttons -->
    <div class="cache-actions">
      <div class="secondary-button" :disabled="isManagingCache" @click="$emit('cleanup-cache')">
        <span class="stats-icon"><DatabaseIcon /></span>
        <span>{{
          isManagingCache ? getMessage('cleaningStatus') : getMessage('cleanExpiredCacheButton')
        }}</span>
      </div>

      <div class="danger-button" :disabled="isManagingCache" @click="$emit('clear-all-cache')">
        <span class="stats-icon"><TrashIcon /></span>
        <span>{{ isManagingCache ? getMessage('clearingStatus') : getMessage('clearAllCacheButton') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import ProgressIndicator from './ProgressIndicator.vue';
import { DatabaseIcon, VectorIcon, TrashIcon } from './icons';
import { getMessage } from '@/utils/i18n';

interface CacheEntry {
  url: string;
  size: number;
  sizeMB: number;
  timestamp: number;
  age: string;
  expired: boolean;
}

interface CacheStats {
  totalSize: number;
  totalSizeMB: number;
  entryCount: number;
  entries: CacheEntry[];
}

interface Props {
  cacheStats: CacheStats | null;
  isManagingCache: boolean;
}

interface Emits {
  (e: 'cleanup-cache'): void;
  (e: 'clear-all-cache'): void;
}

defineProps<Props>();
defineEmits<Emits>();

const getModelNameFromUrl = (url: string) => {
  // Extract model name from HuggingFace URL
  const match = url.match(/huggingface\.co\/([^/]+\/[^/]+)/);
  if (match) {
    return match[1];
  }
  return url.split('/').pop() || url;
};
</script>

