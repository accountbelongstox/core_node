/**
 * PycoreCapabilityStore — shared OCR / TTS / AI gateway / capabilities snapshot
 * for the pycore-manager end.
 *
 * Both PcVoiceSubtitlePage and PcAiStatusPage read the same store so a refresh
 * on either page updates the other. One poll loop, single-flight fetches.
 * Each probe patches the store as it settles — a slow/failing probe does not
 * block the other panels from leaving Loading.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { pycoreApi } from '../../../core/api-libs/pycore/PycoreApi';
import { PYCORE_BROWSER_EVENTS, PYCORE_HTTP_DEFAULTS } from '../../../core/api-libs/pycore/PycoreNetwork';
import type { AiGatewayStatus, CapabilityStatus, OcrStatus, TtsStatus, SttStatus } from '../../../core/api-libs/pycore/pycoreTypes';

export const PYCORE_CAPABILITY_EVENT = PYCORE_BROWSER_EVENTS.capabilityChanged;

export type CapabilityKey = 'ocr' | 'tts' | 'stt' | 'caps' | 'aiGateway';

export interface PycoreCapabilityState {
  ocr: OcrStatus | null;
  tts: TtsStatus | null;
  stt: SttStatus | null;
  caps: CapabilityStatus | null;
  aiGateway: AiGatewayStatus | null;
  /** True until the first fetch cycle finishes. */
  loading: boolean;
  /** True while a manual or periodic refresh is in flight. */
  refreshing: boolean;
  /** At least one fetch cycle has completed. */
  initialized: boolean;
  errors: Partial<Record<CapabilityKey, string>>;
}

let state: PycoreCapabilityState = {
  ocr: null,
  tts: null,
  stt: null,
  caps: null,
  aiGateway: null,
  loading: true,
  refreshing: false,
  initialized: false,
  errors: {},
};

let inFlight: Promise<void> | null = null;
let pollId: ReturnType<typeof setInterval> | null = null;
let pollRefs = 0;

function notify(): void {
  window.dispatchEvent(new CustomEvent(PYCORE_CAPABILITY_EVENT));
}

function patch(partial: Partial<PycoreCapabilityState>): void {
  state = { ...state, ...partial };
  notify();
}

function patchError(key: CapabilityKey, message: string): void {
  state = { ...state, errors: { ...state.errors, [key]: message } };
  notify();
}

function clearError(key: CapabilityKey): void {
  if (!(key in state.errors)) return;
  const next = { ...state.errors };
  delete next[key];
  state = { ...state, errors: next };
  notify();
}

export function getPycoreCapabilityState(): PycoreCapabilityState {
  return state;
}

export function subscribePycoreCapability(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(PYCORE_CAPABILITY_EVENT, handler);
  return () => window.removeEventListener(PYCORE_CAPABILITY_EVENT, handler);
}

async function settleProbe<T extends { success?: boolean; error?: string }>(
  key: CapabilityKey,
  promise: Promise<T>,
  apply: (value: T) => Partial<PycoreCapabilityState>,
): Promise<void> {
  try {
    const value = await promise;
    if (value?.success) {
      clearError(key);
      patch(apply(value));
    } else {
      patchError(key, value?.error || 'probe failed');
    }
  } catch (e: any) {
    patchError(key, e?.message || 'fetch failed');
  }
}

/** Fetch all capability probes. `forceTtsRefresh` bypasses the TTS ~60s cache. */
export async function refreshPycoreCapabilities(forceTtsRefresh = false): Promise<void> {
  if (inFlight) return inFlight;

  const isFirst = !state.initialized;
  patch({ refreshing: !isFirst, loading: isFirst });

  inFlight = (async () => {
    await Promise.allSettled([
      settleProbe('aiGateway', pycoreApi.getAiGateway(), (v) => ({ aiGateway: v as AiGatewayStatus })),
      settleProbe('ocr', pycoreApi.getOcrStatus(), (v) => ({ ocr: v as OcrStatus })),
      settleProbe('tts', pycoreApi.getTtsStatus(forceTtsRefresh), (v) => ({ tts: v as TtsStatus })),
      settleProbe('stt', pycoreApi.getSttStatus(), (v) => ({ stt: v as SttStatus })),
      settleProbe('caps', pycoreApi.getCapabilities(), (v) => ({ caps: v as CapabilityStatus })),
    ]);

    patch({
      loading: false,
      refreshing: false,
      initialized: true,
    });
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Start the shared capability poll loop (ref-counted). */
export function startPycoreCapabilityPoll(): void {
  pollRefs += 1;
  if (pollRefs === 1) {
    void refreshPycoreCapabilities();
    pollId = window.setInterval(() => {
      void refreshPycoreCapabilities();
    }, PYCORE_HTTP_DEFAULTS.capabilityPollMs);
  }
}

/** Stop the poll loop when the last subscriber unmounts. */
export function stopPycoreCapabilityPoll(): void {
  pollRefs = Math.max(0, pollRefs - 1);
  if (pollRefs === 0 && pollId != null) {
    window.clearInterval(pollId);
    pollId = null;
  }
}

export interface PycoreCapabilityHook extends PycoreCapabilityState {
  /** One-click retry — forces a fresh TTS probe too. */
  retry: () => Promise<void>;
}

/**
 * React hook for the module singleton store. Safe from lazy-loaded page chunks
 * (no React context — avoids duplicate context modules across Vite splits).
 */
export function usePycoreCapability(): PycoreCapabilityHook {
  useEffect(() => {
    startPycoreCapabilityPoll();
    return () => stopPycoreCapabilityPoll();
  }, []);

  const snap = useSyncExternalStore(
    subscribePycoreCapability,
    getPycoreCapabilityState,
    getPycoreCapabilityState,
  );

  const retry = useCallback(async () => {
    await refreshPycoreCapabilities(true);
  }, []);

  return useMemo(() => ({ ...snap, retry }), [snap, retry]);
}
