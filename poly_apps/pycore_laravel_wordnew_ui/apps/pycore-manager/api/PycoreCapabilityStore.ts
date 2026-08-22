/**
 * PycoreCapabilityStore — shared OCR / TTS / AI gateway / capabilities snapshot
 * for the pycore-manager end.
 *
 * All pycore-manager capability panels read the same store. Pycore returns
 * every cached capability
 * slice through one exchange, and this store keeps one browser-side flight.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { pycoreApi } from '../../../core/integrations/pycore/PycoreApi';
import { PYCORE_BROWSER_EVENTS } from '../../../core/integrations/pycore/PycoreNetwork';
import type {
  AiGatewayStatus,
} from '../../../core/integrations/pycore/PycoreAiTypes';
import type {
  CapabilityStatus,
} from '../../../core/integrations/pycore/PycoreServiceTypes';
import type {
  OcrStatus,
  TtsStatus,
  SttStatus,
} from '../../../core/integrations/pycore/PycoreSpeechTypes';

export const PYCORE_CAPABILITY_EVENT = PYCORE_BROWSER_EVENTS.capabilityChanged;
const CAPABILITY_CLIENT_TTL_MS = 30_000;

export type CapabilityKey = 'ocr' | 'tts' | 'stt' | 'caps' | 'aiGateway';

export interface PycoreCapabilityState {
  ocr: OcrStatus | null;
  tts: TtsStatus | null;
  stt: SttStatus | null;
  caps: CapabilityStatus | null;
  aiGateway: AiGatewayStatus | null;
  /** True until the first fetch cycle finishes. */
  loading: boolean;
  /** True while a manual refresh is in flight. */
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
let pollRefs = 0;
let loadedAt = 0;

function notify(): void {
  window.dispatchEvent(new CustomEvent(PYCORE_CAPABILITY_EVENT));
}

function patch(partial: Partial<PycoreCapabilityState>): void {
  state = { ...state, ...partial };
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

async function settleCapabilitySnapshot(refresh: boolean): Promise<void> {
  const keys: CapabilityKey[] = ['ocr', 'tts', 'stt', 'caps', 'aiGateway'];
  try {
    const value = await pycoreApi.getCapabilities(refresh) as CapabilityStatus;
    if (value?.success) {
      loadedAt = Date.now();
      patch({
        caps: value,
        ocr: value.ocr ?? state.ocr,
        tts: value.tts ?? state.tts,
        stt: value.stt ?? state.stt,
        aiGateway: value.ai_gateway ?? state.aiGateway,
        errors: {},
      });
    } else {
      const message = value?.error || 'CAPABILITY_STATUS_UNAVAILABLE';
      patch({
        errors: Object.fromEntries(keys.map((key) => [key, message])),
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error
      ? error.message
      : 'CAPABILITY_STATUS_UNAVAILABLE';
    patch({
      errors: Object.fromEntries(keys.map((key) => [key, message])),
    });
  }
}

/** Refresh the unified exchange; provider tests use the dedicated AI probe API. */
export async function refreshPycoreCapabilities(refresh = false): Promise<void> {
  if (inFlight) return inFlight;

  const isFirst = !state.initialized;
  patch({ refreshing: !isFirst, loading: isFirst });

  inFlight = (async () => {
    await settleCapabilitySnapshot(refresh);

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

/** Reuse the browser snapshot while it is inside the backend cache window. */
export async function ensurePycoreCapabilities(): Promise<void> {
  if (state.initialized && Date.now() - loadedAt < CAPABILITY_CLIENT_TTL_MS) return;
  await refreshPycoreCapabilities(false);
}

/** Load the shared capability snapshot once for all mounted consumers. */
export function startPycoreCapabilityPoll(): void {
  pollRefs += 1;
  if (pollRefs === 1 && !state.initialized) {
    void ensurePycoreCapabilities();
  }
}

/** Release one consumer; the cached snapshot remains available. */
export function stopPycoreCapabilityPoll(): void {
  pollRefs = Math.max(0, pollRefs - 1);
}

export interface PycoreCapabilityHook extends PycoreCapabilityState {
  /** Refresh the shared cached exchange without live probes. */
  refresh: () => Promise<void>;
  /** One-click retry that bypasses the local snapshot TTL. */
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

  const refresh = useCallback(async () => {
    await refreshPycoreCapabilities(false);
  }, []);

  return useMemo(() => ({ ...snap, refresh, retry }), [snap, refresh, retry]);
}
