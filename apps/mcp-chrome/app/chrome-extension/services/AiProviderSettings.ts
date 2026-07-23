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
  const stored = await localStorage.get<unknown>(STORAGE_KEYS.AI_VALIDITY_PROVIDER, 'gemini');
  return isProvider(stored, VALIDITY_PROVIDERS) ? stored : 'gemini';
}
