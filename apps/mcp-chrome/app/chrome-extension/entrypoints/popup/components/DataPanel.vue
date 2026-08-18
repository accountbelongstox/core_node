<template>
  <!-- Single root: v-show on this component must map to ONE element — a
       fragment root silently disables v-show and leaks the Data tab's content
       onto every other tab. -->
  <section class="panel-stack">
    <div class="metric-grid">
      <article class="metric-card"><span>{{ getMessage('indexedPagesLabel') }}</span><strong>{{ storageStats.indexedPages }}</strong></article>
      <article class="metric-card"><span>{{ getMessage('indexSizeLabel') }}</span><strong>{{ formattedIndexSize }}</strong></article>
      <article class="metric-card"><span>{{ getMessage('activeTabsLabel') }}</span><strong>{{ storageStats.totalTabs }}</strong></article>
    </div>
    <div class="panel-grid">
      <article class="ui-card">
        <div class="ui-card__heading"><div><p class="ui-eyebrow">{{ getMessage('vectorStoreLabel') }}</p><h3>{{ getMessage('indexDataLabel') }}</h3></div></div>
        <ProgressIndicator v-if="isClearingData && clearDataProgress" :visible="true" :text="clearDataProgress" :show-spinner="true" />
        <button class="ui-button ui-button--danger ui-button--block" :disabled="isClearingData" @click="showClearConfirmation = true">
          {{ isClearingData ? getMessage('clearingStatus') : getMessage('clearAllDataButton') }}
        </button>
      </article>
      <article class="ui-card">
        <ModelCacheManagement :cache-stats="cacheStats" :is-managing-cache="isManagingCache" @cleanup-cache="cleanupCache" @clear-all-cache="clearAllCache" />
      </article>
    </div>

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
  </section>
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
