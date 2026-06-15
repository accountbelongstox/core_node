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
