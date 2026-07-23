<template>
  <footer class="app-footer">
    <span><span class="status-dot" :class="{ 'status-dot--success': isReady }" /> {{ statusText }}</span>
    <span class="app-footer__port">Port {{ serverStatus.port || nativeServerPort }}</span>
    <span>Chrome MCP v0.0.6</span>
  </footer>
</template>

<script lang="ts" setup>
import { useServerConnection } from '../../composables/useServerConnection';

const { isReady, statusText, serverStatus, nativeServerPort } = useServerConnection();
</script>
