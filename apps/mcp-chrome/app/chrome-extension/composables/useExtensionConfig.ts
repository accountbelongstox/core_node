import { computed, ref, type Ref } from 'vue';
import {
  FEATURE_DEFINITIONS,
  type FeatureConfig,
  type FeatureId,
  type FeatureState,
} from '@/common/feature-registry';
import { localStorage } from '@/services/ExtensionStorage';
import { STORAGE_KEYS } from '@/utils/storage-keys';

const extensions: Ref<FeatureConfig[]> = ref([]);
let initialization: Promise<void> | null = null;
let persistedSnapshot = '';
let storageSyncReady = false;

function createDefaults(): FeatureConfig[] {
  return FEATURE_DEFINITIONS.map((definition) => ({
    ...definition,
    enabled: definition.defaultEnabled,
    config: {},
  }));
}

function mergeStoredState(stored: FeatureState[]): FeatureConfig[] {
  return createDefaults().map((feature) => {
    const saved = stored.find((item) => item.id === feature.id);
    return saved
      ? { ...feature, enabled: saved.enabled, config: saved.config ?? {} }
      : feature;
  });
}

async function persist(): Promise<void> {
  const state: FeatureState[] = extensions.value.map(({ id, enabled, config }) => ({
    id,
    enabled,
    config,
  }));
  const snapshot = JSON.stringify(state);
  if (snapshot === persistedSnapshot) return;
  persistedSnapshot = snapshot;
  await localStorage.set(STORAGE_KEYS.EXTENSION_CONFIGS, state);
}

function setupStorageSync(): void {
  if (storageSyncReady) return;
  storageSyncReady = true;
  localStorage.subscribe<FeatureState[]>(STORAGE_KEYS.EXTENSION_CONFIGS, (stored) => {
    if (!Array.isArray(stored)) return;
    const snapshot = JSON.stringify(stored);
    if (snapshot === persistedSnapshot) return;
    persistedSnapshot = snapshot;
    extensions.value = mergeStoredState(stored);
  });
}

async function initializeState(): Promise<void> {
  const stored = await localStorage.get<FeatureState[]>(STORAGE_KEYS.EXTENSION_CONFIGS, []);
  persistedSnapshot = JSON.stringify(stored);
  extensions.value = mergeStoredState(Array.isArray(stored) ? stored : []);
  setupStorageSync();
}

export function useExtensionConfig() {
  const initialize = async () => {
    initialization ??= initializeState().catch((error) => {
      extensions.value = createDefaults();
      console.error('[ExtensionConfig] Initialization failed:', error);
    });
    await initialization;
  };

  const getExtension = (id: FeatureId) => extensions.value.find((feature) => feature.id === id);

  const toggleExtension = async (id: FeatureId) => {
    const feature = getExtension(id);
    if (!feature) return;
    feature.enabled = !feature.enabled;
    await persist();
  };

  const updateExtensionConfig = async (id: FeatureId, config: Record<string, unknown>) => {
    const feature = getExtension(id);
    if (!feature) return;
    feature.config = { ...feature.config, ...config };
    await persist();
  };

  const resetToDefaults = async () => {
    extensions.value = createDefaults();
    await persist();
  };

  const enabledExtensions = computed(() => extensions.value.filter((feature) => feature.enabled));
  const enabledExtensionsCount = computed(() => enabledExtensions.value.length);

  return {
    extensions,
    enabledExtensions,
    enabledExtensionsCount,
    initialize,
    getExtension,
    toggleExtension,
    updateExtensionConfig,
    resetToDefaults,
  };
}
