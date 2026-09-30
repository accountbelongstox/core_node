/**
 * Localized text of AI hub coded reasons (boot verdict / runtime state).
 * Lookup order: hub reasons, TTS reasons (legacy codes), then pycore's English rendering.
 */
import type { AiHubReason } from '@/apps/pycore-manager/api';
import { pcCodeText, type PcCodeParams } from './pcErrorCodes';

const REASON_PREFIXES = ['aiHub.reasons', 'ttsReasons'] as const;

export function aiHubReasonText(code: string | null | undefined, params: PcCodeParams, fallback?: string | null): string {
  for (const prefix of REASON_PREFIXES) {
    const text = pcCodeText(prefix, code, params);
    if (text) return text;
  }
  return fallback || '';
}

export function aiHubReasonOf(source: AiHubReason | null | undefined): string {
  return aiHubReasonText(source?.reason_code, source?.reason_params, source?.reason);
}
