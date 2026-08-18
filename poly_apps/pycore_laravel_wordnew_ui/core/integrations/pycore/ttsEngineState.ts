/** TTS engine UI state derived from installed + available flags. */
export type TtsEngineUiState = 'ready' | 'setup' | 'missing';

export function ttsEngineUiState(
  installed?: boolean,
  available?: boolean,
): TtsEngineUiState {
  if (available) return 'ready';
  if (installed) return 'setup';
  return 'missing';
}

export function ttsEngineBadgeLabel(
  state: TtsEngineUiState,
  labels: { ready: string; setup: string; missing: string },
): string {
  if (state === 'ready') return labels.ready;
  if (state === 'setup') return labels.setup;
  return labels.missing;
}

/** Parallel-safety annotation per engine `concurrency` flag (tts_status). */
export const TTS_CONCURRENCY_ANNOTATION: Record<string, string> = {
  serial: 'serial (no parallel)',
  cloud: 'parallel ok (cloud rate limits)',
  in_process: 'parallel ok (in-process)',
  server: 'concurrent ok (single-active server)',
};

/** Annotation for one engine; edge falls back to 'serial' when the backend omits the flag. */
export function ttsConcurrencyAnnotation(concurrency?: string, engineName?: string): string | null {
  const c = concurrency ?? (engineName === 'edge' ? 'serial' : undefined);
  return (c && TTS_CONCURRENCY_ANNOTATION[c]) || null;
}
