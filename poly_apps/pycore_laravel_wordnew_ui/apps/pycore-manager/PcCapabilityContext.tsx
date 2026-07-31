/**
 * PcCapabilityContext — keeps the shared capability poll alive for the layout.
 * Consumers should call usePycoreCapability() from core (store hook), not React context.
 */
import React, { useEffect } from 'react';
import { startPycoreCapabilityPoll, stopPycoreCapabilityPoll, usePycoreCapability } from '@/apps/pycore-manager/api';

export function PcCapabilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    startPycoreCapabilityPoll();
    return () => stopPycoreCapabilityPoll();
  }, []);

  return <>{children}</>;
}

/** @deprecated Prefer usePycoreCapability from the Pycore Manager API boundary. */
export const usePcCapability = usePycoreCapability;
