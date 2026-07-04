// MUST stay the first import: aliases chrome -> browser on Firefox before any
// other module top-level code touches chrome.* (no-op, tree-shaken on Chrome).
import '@/utils/browser-shim';
import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { loadUserLocale } from '../../utils/i18n';

// Preload the user-selected locale BEFORE mounting so synchronous getMessage()
// calls in templates render in the chosen language (chrome.i18n alone ignores
// the in-app choice). Mount regardless of outcome — falls back to English.
loadUserLocale().finally(() => {
  createApp(App).mount('#app');
});
