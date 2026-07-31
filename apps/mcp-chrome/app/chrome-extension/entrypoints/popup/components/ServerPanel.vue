<template>
  <section class="panel-grid panel-grid--server">
    <article class="hero-card">
      <div>
        <p class="ui-eyebrow">{{ getMessage('nativeBridgeLabel') }}</p>
        <h2>{{ isReady ? 'Automation core is ready' : 'Connect the automation core' }}</h2>
        <p>{{ statusText }}</p>
      </div>
      <button class="ui-button" :class="isConnected ? 'ui-button--danger' : 'ui-button--primary'" :disabled="isConnecting" @click="toggleConnection">
        {{ isConnecting ? getMessage('connectingStatus') : isConnected ? getMessage('disconnectButton') : getMessage('connectButton') }}
      </button>
    </article>

    <article class="ui-card">
      <div class="ui-card__heading">
        <div><p class="ui-eyebrow">{{ getMessage('listenerLabel') }}</p><h3>{{ getMessage('connectionStatusLabel') }}</h3></div>
        <span class="status-dot" :class="{ 'status-dot--success': isReady }" />
      </div>
      <p class="ui-helper">
        Native MCP port <strong>{{ nativeServerPort }}</strong> · Configure it in Settings Center.
      </p>
      <button class="ui-button ui-button--secondary ui-button--block" @click="refreshServerStatus">
        {{ getMessage('refreshStatusButton') }}
      </button>
    </article>

    <article class="ui-card ui-card--wide">
      <div class="ui-card__heading">
        <div><p class="ui-eyebrow">{{ getMessage('clientSetupLabel') }}</p><h3>{{ getMessage('mcpServerConfigLabel') }}</h3></div>
        <button class="ui-button ui-button--ghost" @click="copyMcpConfig">{{ copyButtonText }}</button>
      </div>
      <pre class="code-block">{{ mcpConfigJson }}</pre>
    </article>
  </section>
</template>

<script lang="ts" setup>
import { getMessage } from '@/utils/i18n';
import { useServerConnection } from '../composables/useServerConnection';

const {
  nativeServerPort,
  isConnecting,
  isConnected,
  isReady,
  copyButtonText,
  mcpConfigJson,
  statusText,
  refreshServerStatus,
  toggleConnection,
  copyMcpConfig,
} = useServerConnection();
</script>
