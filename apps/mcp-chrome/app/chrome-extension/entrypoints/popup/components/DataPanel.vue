<template>
  <section class="panel-stack">
    <div class="metric-grid">
      <article class="metric-card"><span>Indexed pages</span><strong>{{ storageStats.indexedPages }}</strong></article>
      <article class="metric-card"><span>Index size</span><strong>{{ formattedIndexSize }}</strong></article>
      <article class="metric-card"><span>Active tabs</span><strong>{{ storageStats.totalTabs }}</strong></article>
    </div>
    <div class="panel-grid">
      <article class="ui-card">
        <div class="ui-card__heading"><div><p class="ui-eyebrow">Vector store</p><h3>Index data</h3></div></div>
        <ProgressIndicator v-if="isClearingData && clearDataProgress" :visible="true" :text="clearDataProgress" :show-spinner="true" />
        <button class="ui-button ui-button--danger ui-button--block" :disabled="isClearingData" @click="showClearConfirmation = true">
          {{ isClearingData ? getMessage('clearingStatus') : getMessage('clearAllDataButton') }}
        </button>
      </article>
      <article class="ui-card">
        <ModelCacheManagement :cache-stats="cacheStats" :is-managing-cache="isManagingCache" @cleanup-cache="cleanupCache" @clear-all-cache="clearAllCache" />
      </article>
    </div>
  </section>

  <ConfirmDialog
    :visible="showClearConfirmation"
    :title="getMessage('confirmClearDataTitle')"
    :message="getMessage('clearDataWarningMessage')"
    :items="[getMessage('clearDataList1'), getMessage('clearDataList2'), getMessage('clearDataList3')]"
    :warning="getMessage('clearDataIrreversibleWarning')"
    icon="[!]"
    :confirm-text="getMessage('confirmClearButton')"
    :cancel-text="getMessage('cancelButton')"
    :confirming-text="getMessage('clearingStatus')"
    :is-confirming="isClearingData"
    @confirm="clearAllData"
    @cancel="hideClearDataConfirmation"
  />
</template>

<script lang="ts" setup>
import { getMessage } from '@/utils/i18n';
import { useDataManagement } from '../composables/useDataManagement';
import ConfirmDialog from './ConfirmDialog.vue';
import ModelCacheManagement from './ModelCacheManagement.vue';
import ProgressIndicator from './ProgressIndicator.vue';

const {
  storageStats,
  cacheStats,
  isManagingCache,
  isClearingData,
  showClearConfirmation,
  clearDataProgress,
  formattedIndexSize,
  cleanupCache,
  clearAllCache,
  clearAllData,
  hideClearDataConfirmation,
} = useDataManagement();
</script>
