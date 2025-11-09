import { defineNuxtPlugin } from '#app';
import { useAppConfigStore } from '@/common/stores/app-config-store';
import { useI18n } from 'vue-i18n';

export default defineNuxtPlugin((nuxtApp) => {
  const configStore = useAppConfigStore(nuxtApp.$pinia);
  const { locale } = useI18n();

  configStore.initialize();

  if (configStore.currentLocale) {
    locale.value = configStore.currentLocale;
  }

  nuxtApp.provide('appConfig', configStore);
});
