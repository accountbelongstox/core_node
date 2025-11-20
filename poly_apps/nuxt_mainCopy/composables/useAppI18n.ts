import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouteNamespace } from './useRouteNamespace';
import type { RegisteredNamespace } from '@/utils/namespace-registry';

export interface AppI18nMessages {
  [key: string]: string;
}

export function useAppI18n() {
  const { t: i18nT, locale, messages, mergeLocaleMessage } = useI18n();
  const { currentNamespace } = useRouteNamespace();

  const loadedNamespaces = ref<Set<string>>(new Set());
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  const currentAppNamespace = computed(() => currentNamespace.value);

  async function loadAppMessages(namespace: RegisteredNamespace, targetLocale: string): Promise<AppI18nMessages> {
    const cacheKey = `${namespace}_${targetLocale}`;

    if (loadedNamespaces.value.has(cacheKey)) {
      return messages.value[targetLocale] || {};
    }

    isLoading.value = true;
    loadError.value = null;

    const globalMessages: AppI18nMessages = {};
    const appMessages: AppI18nMessages = {};

    try {
      const globalModule = await import(`@/i18n/locales/${targetLocale}.json`);
      Object.assign(globalMessages, globalModule.default || globalModule);
    } catch (error) {
      console.warn(`Global i18n file not found for locale: ${targetLocale}`, error);
      loadError.value = `Global locale ${targetLocale} not found`;
    }

    try {
      const appModule = await import(`@/apps/app_${namespace}/i18n_app_${namespace}/locales/${targetLocale}.json`);
      Object.assign(appMessages, appModule.default || appModule);
    } catch (error) {
      console.warn(`App-specific i18n file not found for ${namespace}/${targetLocale}`, error);
    }

    const mergedMessages = {
      ...globalMessages,
      ...appMessages,
    };

    mergeLocaleMessage(targetLocale, mergedMessages);

    loadedNamespaces.value.add(cacheKey);
    isLoading.value = false;

    return mergedMessages;
  }

  async function loadCurrentAppMessages(): Promise<void> {
    if (!currentAppNamespace.value) {
      console.warn('No current namespace detected');
      return;
    }

    await loadAppMessages(currentAppNamespace.value as RegisteredNamespace, locale.value);
  }

  async function switchLocale(newLocale: string): Promise<void> {
    locale.value = newLocale;

    if (currentAppNamespace.value) {
      await loadAppMessages(currentAppNamespace.value as RegisteredNamespace, newLocale);
    }
  }

  function clearCache(): void {
    loadedNamespaces.value.clear();
  }

  watch(currentAppNamespace, async (newNamespace) => {
    if (newNamespace) {
      await loadAppMessages(newNamespace as RegisteredNamespace, locale.value);
    }
  });

  watch(locale, async (newLocale) => {
    if (currentAppNamespace.value) {
      await loadAppMessages(currentAppNamespace.value as RegisteredNamespace, newLocale);
    }
  });

  function t(key: string, defaultValue?: string): string {
    const translation = i18nT(key);

    if (translation === key && defaultValue) {
      return defaultValue;
    }

    return translation as string;
  }

  return {
    t,
    locale,
    messages,
    currentAppNamespace,
    isLoading,
    loadError,
    loadAppMessages,
    loadCurrentAppMessages,
    switchLocale,
    clearCache,
  };
}
