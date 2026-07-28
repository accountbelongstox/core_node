import { localStorage } from './ExtensionStorage';
import { STORAGE_KEYS } from '@/utils/storage-keys';

export type AiWebProvider = 'chatgpt' | 'gemini' | 'deepseek' | 'zai';

const WEB_PROVIDERS: readonly AiWebProvider[] = ['chatgpt', 'gemini'];
const VALIDITY_PROVIDERS: readonly AiWebProvider[] = ['chatgpt', 'gemini', 'deepseek', 'zai'];

function isProvider(value: unknown, providers: readonly AiWebProvider[]): value is AiWebProvider {
  return typeof value === 'string' && providers.includes(value as AiWebProvider);
}

export async function getPreferredProvider(): Promise<AiWebProvider> {
  const stored = await localStorage.get<unknown>(STORAGE_KEYS.AI_WEB_PROVIDER, 'chatgpt');
  return isProvider(stored, WEB_PROVIDERS) ? stored : 'chatgpt';
}

export async function setPreferredProvider(provider: AiWebProvider): Promise<void> {
  if (!isProvider(provider, WEB_PROVIDERS)) throw new Error(`Unsupported web AI provider: ${provider}`);
  await localStorage.set(STORAGE_KEYS.AI_WEB_PROVIDER, provider);
}

export async function getValidityProvider(): Promise<AiWebProvider> {
  // Default: DeepSeek web (per the task-center spec); older installs stored
  // 'gemini' — an explicit choice is honored as-is.
  const stored = await localStorage.get<unknown>(STORAGE_KEYS.AI_VALIDITY_PROVIDER, 'deepseek');
  return isProvider(stored, VALIDITY_PROVIDERS) ? stored : 'deepseek';
}

export async function setValidityProvider(provider: AiWebProvider): Promise<void> {
  if (!isProvider(provider, VALIDITY_PROVIDERS)) throw new Error(`Unsupported validity AI provider: ${provider}`);
  await localStorage.set(STORAGE_KEYS.AI_VALIDITY_PROVIDER, provider);
}

/**
 * Language whose unchecked words the validity runner drains. Default 'en'
 * (EN-only per spec); other language codes are opt-in via Settings.
 */
export async function getValidityLanguage(): Promise<string> {
  const stored = await localStorage.get<unknown>(STORAGE_KEYS.VALIDITY_LANGUAGE, 'en');
  return typeof stored === 'string' && /^[a-z]{2}(-[a-zA-Z]{2,})?$/i.test(stored.trim())
    ? stored.trim().toLowerCase()
    : 'en';
}

export async function setValidityLanguage(language: string): Promise<void> {
  const normalized = String(language || '').trim().toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2,})?$/.test(normalized)) {
    throw new Error(`Unsupported validity language: ${language}`);
  }
  await localStorage.set(STORAGE_KEYS.VALIDITY_LANGUAGE, normalized);
}
