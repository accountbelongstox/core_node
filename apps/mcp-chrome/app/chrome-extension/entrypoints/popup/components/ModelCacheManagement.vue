<template>
  <div>
    <h4 class="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1.5">{{ getMessage('modelCacheManagementLabel') }}</h4>

    <!-- Cache Statistics -->
    <div class="grid grid-cols-2 gap-1.5 mb-2">
      <div class="flex items-center gap-1.5 p-1.5 bg-slate-900/50 rounded">
        <DatabaseIcon class="w-3 h-3 text-amber-400 shrink-0" />
        <div>
          <p class="text-[8px] text-slate-500">{{ getMessage('cacheSizeLabel') }}</p>
          <p class="text-[10px] font-bold text-slate-200">{{ cacheStats?.totalSizeMB || 0 }} MB</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 p-1.5 bg-slate-900/50 rounded">
        <VectorIcon class="w-3 h-3 text-purple-400 shrink-0" />
        <div>
          <p class="text-[8px] text-slate-500">{{ getMessage('cacheEntriesLabel') }}</p>
          <p class="text-[10px] font-bold text-slate-200">{{ cacheStats?.entryCount || 0 }}</p>
        </div>
      </div>
    </div>

    <!-- Cache Entries Details -->
    <div v-if="cacheStats && cacheStats.entries.length > 0" class="mb-2">
      <h5 class="text-[8px] text-slate-500 uppercase mb-1">{{ getMessage('cacheDetailsLabel') }}</h5>
      <div class="space-y-0.5">
        <div v-for="entry in cacheStats.entries" :key="entry.url" class="flex items-center justify-between px-1.5 py-1 bg-slate-900/30 rounded text-[9px]">
          <span class="text-slate-300 truncate mr-2">{{ getModelNameFromUrl(entry.url) }}</span>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-slate-400">{{ entry.sizeMB }} MB</span>
            <span class="text-slate-500">{{ entry.age }}</span>
            <span v-if="entry.expired" class="text-rose-400 text-[8px]">{{ getMessage('expiredLabel') }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="cacheStats && cacheStats.entries.length === 0" class="text-[9px] text-slate-500 mb-2">
      {{ getMessage('noCacheDataMessage') }}
    </div>

    <div v-else-if="!cacheStats" class="text-[9px] text-slate-500 mb-2">
      {{ getMessage('loadingCacheInfoStatus') }}
    </div>

    <ProgressIndicator v-if="isManagingCache" :visible="isManagingCache" :text="getMessage('processingCacheStatus')" :showSpinner="true" />

    <!-- Action Buttons -->
    <div class="flex gap-1.5">
      <button :disabled="isManagingCache" @click="$emit('cleanup-cache')"
        class="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[9px] rounded transition-colors disabled:opacity-50">
        <DatabaseIcon class="w-2.5 h-2.5" />
        {{ isManagingCache ? getMessage('cleaningStatus') : getMessage('cleanExpiredCacheButton') }}
      </button>
      <button :disabled="isManagingCache" @click="$emit('clear-all-cache')"
        class="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 bg-rose-900/20 border border-rose-900/40 text-rose-400 text-[9px] rounded transition-colors hover:bg-rose-900/30 disabled:opacity-50">
        <TrashIcon class="w-2.5 h-2.5" />
        {{ isManagingCache ? getMessage('clearingStatus') : getMessage('clearAllCacheButton') }}
      </button>
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
  const match = url.match(/huggingface\.co\/([^/]+\/[^/]+)/);
  if (match) {
    return match[1];
  }
  return url.split('/').pop() || url;
};
</script>
