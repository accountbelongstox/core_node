<template>
  <section class="debug-panel">
    <header class="debug-panel__toolbar">
      <div class="segmented-control">
        <button :class="{ active: !showDebugInfo }" @click="showDebugInfo = false">{{ getMessage('logsLabel') }}</button>
        <button :class="{ active: showDebugInfo }" @click="showDebugInfo = true">{{ getMessage('stateLabel') }}</button>
      </div>
      <button class="ui-button ui-button--ghost" @click="clearDebugLogs">{{ getMessage('clearLogsButton') }}</button>
    </header>
    <div class="debug-panel__console no-scrollbar">
      <pre v-if="showDebugInfo">{{ JSON.stringify({ connection: { nativeConnectionStatus, port: nativeServerPort }, server: serverStatus }, null, 2) }}</pre>
      <div v-else class="debug-log-list">
        <div v-for="(log, index) in debugLogs" :key="`${log.time}-${index}`" class="debug-log">
          <span>{{ log.time }}</span><strong :data-level="log.level">{{ log.level }}</strong><p>{{ log.message }}</p>
        </div>
        <div v-if="debugLogs.length === 0" class="ui-empty-state">{{ getMessage('noEventsRecorded') }}</div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { useDebugCenter } from '../composables/useDebugCenter';
import { useServerConnection } from '../composables/useServerConnection';
import { getMessage } from '@/utils/i18n';

const { debugLogs, showDebugInfo, clearDebugLogs } = useDebugCenter();
const { nativeConnectionStatus, nativeServerPort, serverStatus } = useServerConnection();
</script>
