/**
 * PcCapabilityContext — keeps the shared capability poll alive for the layout.
 * Consumers should call usePycoreCapability() from core (store hook), not React context.
 */
import React, { useEffect } from 'react';
import { startPycoreCapabilityPoll, stopPycoreCapabilityPoll, usePycoreCapability } from '../../core/api-libs/pycore';

export function PcCapabilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    startPycoreCapabilityPoll();
    return () => stopPycoreCapabilityPoll();
  }, []);

  return <>{children}</>;
}

/** @deprecated Prefer usePycoreCapability from core/api-libs/pycore. */
export const usePcCapability = usePycoreCapability;
