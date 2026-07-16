/**
 * PycoreCapabilityStore — shared OCR / TTS / AI gateway / capabilities snapshot
 * for the pycore-manager end.
 *
 * Both PcVoiceSubtitlePage and PcAiStatusPage read the same store so a refresh
 * on either page updates the other. One poll loop, single-flight fetches.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { pycoreApi } from './PycoreApi';
import type { AiGatewayStatus, CapabilityStatus, OcrStatus, TtsStatus, SttStatus } from './pycoreTypes';

export const PYCORE_CAPABILITY_EVENT = 'pycore-capability-changed';

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

const POLL_MS = 20_000;

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

export function getPycoreCapabilityState(): PycoreCapabilityState {
  return state;
}

export function subscribePycoreCapability(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(PYCORE_CAPABILITY_EVENT, handler);
  return () => window.removeEventListener(PYCORE_CAPABILITY_EVENT, handler);
}

/** Fetch all capability probes. `forceTtsRefresh` bypasses the TTS ~60s cache. */
export async function refreshPycoreCapabilities(forceTtsRefresh = false): Promise<void> {
  if (inFlight) return inFlight;

  const isFirst = !state.initialized;
  patch({ refreshing: !isFirst, loading: isFirst });

  inFlight = (async () => {
    const errors: Partial<Record<CapabilityKey, string>> = {};
    const [gw, oc, tt, st, cp] = await Promise.allSettled([
      pycoreApi.getAiGateway(),
      pycoreApi.getOcrStatus(),
      pycoreApi.getTtsStatus(forceTtsRefresh),
      pycoreApi.getSttStatus(),
      pycoreApi.getCapabilities(),
    ]);

    const next: Partial<PycoreCapabilityState> = { errors };

    if (gw.status === 'fulfilled' && gw.value?.success) {
      next.aiGateway = gw.value;
    } else if (gw.status === 'fulfilled' || gw.status === 'rejected') {
      errors.aiGateway = gw.status === 'rejected'
        ? (gw.reason?.message || 'fetch failed')
        : (gw.value?.error || 'probe failed');
    }

    if (oc.status === 'fulfilled' && oc.value?.success) {
      next.ocr = oc.value;
    } else if (oc.status === 'fulfilled' || oc.status === 'rejected') {
      errors.ocr = oc.status === 'rejected'
        ? (oc.reason?.message || 'fetch failed')
        : (oc.value?.error || 'probe failed');
    }

    if (tt.status === 'fulfilled' && tt.value?.success) {
      next.tts = tt.value;
    } else if (tt.status === 'fulfilled' || tt.status === 'rejected') {
      errors.tts = tt.status === 'rejected'
        ? (tt.reason?.message || 'fetch failed')
        : (tt.value?.error || 'probe failed');
    }

    if (st.status === 'fulfilled' && st.value?.success) {
      next.stt = st.value;
    } else if (st.status === 'fulfilled' || st.status === 'rejected') {
      errors.stt = st.status === 'rejected'
        ? (st.reason?.message || 'fetch failed')
        : (st.value?.error || 'probe failed');
    }

    if (cp.status === 'fulfilled' && cp.value?.success) {
      next.caps = cp.value;
    } else if (cp.status === 'fulfilled' || cp.status === 'rejected') {
      errors.caps = cp.status === 'rejected'
        ? (cp.reason?.message || 'fetch failed')
        : (cp.value?.error || 'probe failed');
    }

    patch({
      ...next,
      loading: false,
      refreshing: false,
      initialized: true,
      errors,
    });
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Start the shared 20s poll loop (ref-counted). */
export function startPycoreCapabilityPoll(): void {
  pollRefs += 1;
  if (pollRefs === 1) {
    void refreshPycoreCapabilities();
    pollId = window.setInterval(() => { void refreshPycoreCapabilities(); }, POLL_MS);
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
