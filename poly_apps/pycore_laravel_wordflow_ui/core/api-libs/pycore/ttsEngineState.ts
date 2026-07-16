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
