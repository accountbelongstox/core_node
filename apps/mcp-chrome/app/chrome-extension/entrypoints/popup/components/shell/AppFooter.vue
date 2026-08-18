<template>
  <footer class="app-footer">
    <span><span class="status-dot" :class="{ 'status-dot--success': isReady }" /> {{ statusText }}</span>
    <span class="app-footer__port">{{ getMessage('footerPort', [String(serverStatus.port || nativeServerPort)]) }}</span>
    <span>Chrome MCP v0.0.6</span>
  </footer>
</template>

<script lang="ts" setup>
import { useServerConnection } from '../../composables/useServerConnection';
import { getMessage } from '@/utils/i18n';

const { isReady, statusText, serverStatus, nativeServerPort } = useServerConnection();
</script>
