/**
 * PcCapabilityContext — React bridge for the shared capability status store.
 *
 * Wrap pycore routes with <PcCapabilityProvider> so Voice & Subtitle and
 * Capability Status pages share one OCR/TTS/AI-gateway/caps snapshot.
 */
import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from 'react';
import {
  getPycoreCapabilityState,
  subscribePycoreCapability,
  refreshPycoreCapabilities,
  startPycoreCapabilityPoll,
  stopPycoreCapabilityPoll,
  type PycoreCapabilityState,
} from '../../core/api-libs/pycore';

interface PcCapabilityContextValue extends PycoreCapabilityState {
  /** One-click retry — forces a fresh TTS probe too. */
  retry: () => Promise<void>;
}

const PcCapabilityContext = createContext<PcCapabilityContextValue | null>(null);

export function PcCapabilityProvider({ children }: { children: React.ReactNode }) {
  const [snap, setSnap] = useState<PycoreCapabilityState>(() => getPycoreCapabilityState());

  useEffect(() => {
    const sync = () => setSnap(getPycoreCapabilityState());
    const off = subscribePycoreCapability(sync);
    startPycoreCapabilityPoll();
    return () => {
      off();
      stopPycoreCapabilityPoll();
    };
  }, []);

  const retry = useCallback(async () => {
    await refreshPycoreCapabilities(true);
  }, []);

  const value = useMemo<PcCapabilityContextValue>(
    () => ({ ...snap, retry }),
    [snap, retry],
  );

  return (
    <PcCapabilityContext.Provider value={value}>{children}</PcCapabilityContext.Provider>
  );
}

export function usePcCapability(): PcCapabilityContextValue {
  const ctx = useContext(PcCapabilityContext);
  if (!ctx) throw new Error('usePcCapability must be used within <PcCapabilityProvider>');
  return ctx;
}
