// MUST stay the first import: aliases chrome -> browser on Firefox before any
// other module top-level code touches chrome.* (no-op, tree-shaken on Chrome).
import '@/utils/browser-shim';
import { DEFAULT_SERVER_PORT, NativeMessageType } from 'chrome-mcp-shared';
import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { loadUserLocale } from '../../utils/i18n';

const startupParams = new URLSearchParams(window.location.search);
const shouldReconnectNative = startupParams.get('reconnectNative') === '1';

async function reconnectNativeAfterBuild(): Promise<void> {
  if (!shouldReconnectNative) return;

  try {
    await chrome.runtime.sendMessage({
      type: NativeMessageType.CONNECT_NATIVE,
      port: DEFAULT_SERVER_PORT,
      forceReconnect: true,
    });
  } catch (error) {
    console.warn('[Popup] Native host rebuild recovery will retry through the watchdog.', error);
  } finally {
    window.close();
  }
}

// Preload the user-selected locale BEFORE mounting so synchronous getMessage()
// calls in templates render in the chosen language (chrome.i18n alone ignores
// the in-app choice). Mount regardless of outcome — falls back to English.
loadUserLocale().finally(() => {
  createApp(App).mount('#app');
  void reconnectNativeAfterBuild();
});
