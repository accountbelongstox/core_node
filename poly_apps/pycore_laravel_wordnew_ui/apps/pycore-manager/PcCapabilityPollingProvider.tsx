/**
 * Initializes the cached Pycore capability snapshot while the app is mounted.
 */
import React, { useEffect } from 'react';
import { startPycoreCapabilityPoll, stopPycoreCapabilityPoll } from '@/apps/pycore-manager/api';

export function PcCapabilityPollingProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    startPycoreCapabilityPoll();
    return () => stopPycoreCapabilityPoll();
  }, []);

  return <>{children}</>;
}
