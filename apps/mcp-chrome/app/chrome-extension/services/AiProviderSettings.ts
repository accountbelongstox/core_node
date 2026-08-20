import { localStorage } from './ExtensionStorage';
import { STORAGE_KEYS, type StorageKey } from '@/utils/storage-keys';

export type AiWebProvider = 'chatgpt' | 'gemini' | 'deepseek';

interface ProviderSetting {
  storageKey: StorageKey;
  providers: readonly AiWebProvider[];
  defaultValue: AiWebProvider;
  errorLabel: string;
}

const WEB_PROVIDERS: readonly AiWebProvider[] = ['chatgpt', 'gemini'];
const VALIDITY_PROVIDERS: readonly AiWebProvider[] = ['chatgpt', 'gemini', 'deepseek'];
const WEB_PROVIDER_SETTING: ProviderSetting = {
  storageKey: STORAGE_KEYS.AI_WEB_PROVIDER,
  providers: WEB_PROVIDERS,
  defaultValue: 'chatgpt',
  errorLabel: 'web',
};
const VALIDITY_PROVIDER_SETTING: ProviderSetting = {
  storageKey: STORAGE_KEYS.AI_VALIDITY_PROVIDER,
  providers: VALIDITY_PROVIDERS,
  defaultValue: 'deepseek',
  errorLabel: 'validity',
};
const LANG_PATTERN = /^[a-z]{2,3}(-[a-z]{2,})?$/;

function isProvider(value: unknown, providers: readonly AiWebProvider[]): value is AiWebProvider {
  return typeof value === 'string' && providers.includes(value as AiWebProvider);
}

async function getProvider(setting: ProviderSetting): Promise<AiWebProvider> {
  const stored = await localStorage.get<unknown>(setting.storageKey, setting.defaultValue);
  return isProvider(stored, setting.providers) ? stored : setting.defaultValue;
}

async function setProvider(setting: ProviderSetting, provider: AiWebProvider): Promise<void> {
  if (!isProvider(provider, setting.providers)) {
    throw new Error(`Unsupported ${setting.errorLabel} AI provider: ${provider}`);
  }
  await localStorage.set(setting.storageKey, provider);
}

export async function getPreferredProvider(): Promise<AiWebProvider> {
  return getProvider(WEB_PROVIDER_SETTING);
}

export async function setPreferredProvider(provider: AiWebProvider): Promise<void> {
  await setProvider(WEB_PROVIDER_SETTING, provider);
}

export async function getValidityProvider(): Promise<AiWebProvider> {
  // Default: DeepSeek web (per the task-center spec); older installs stored
  // 'gemini' — an explicit choice is honored as-is.
  return getProvider(VALIDITY_PROVIDER_SETTING);
}

export async function setValidityProvider(provider: AiWebProvider): Promise<void> {
  await setProvider(VALIDITY_PROVIDER_SETTING, provider);
}

function normalizeValidityLanguages(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const out: string[] = [];
  for (const item of raw) {
    const code = String(item || '').trim().toLowerCase();
    if (LANG_PATTERN.test(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

/**
 * Languages whose unchecked words the validity runner drains. MULTI-select
 * (default ['en'] — EN-only per spec; other codes opt-in via Settings).
 * Migrates the legacy single-language VALIDITY_LANGUAGE value when present.
 */
export async function getValidityLanguages(): Promise<string[]> {
  const stored = await localStorage.get<unknown>(STORAGE_KEYS.VALIDITY_LANGUAGES, null);
  const list = normalizeValidityLanguages(stored);
  if (list.length > 0) return list;
  const legacy = await localStorage.get<unknown>(STORAGE_KEYS.VALIDITY_LANGUAGE, 'en');
  const migrated = normalizeValidityLanguages(legacy);
  return migrated.length > 0 ? migrated : ['en'];
}

export async function setValidityLanguages(languages: string[]): Promise<void> {
  const list = normalizeValidityLanguages(languages);
  if (list.length === 0) throw new Error('Select at least one validity language');
  await localStorage.set(STORAGE_KEYS.VALIDITY_LANGUAGES, list);
}
