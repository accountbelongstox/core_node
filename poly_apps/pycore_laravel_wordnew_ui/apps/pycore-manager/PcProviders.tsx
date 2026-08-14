/**
 * Shared React context providers for the pycore-manager end.
 * Mounted in PcApp for app-wide state.
 */
import React from 'react';
import { PcLiveProvider } from './PcLiveContext';
import { PcCapabilityPollingProvider } from './PcCapabilityPollingProvider';
import { PcVideoExtractProvider } from './PcVideoExtractContext';
import { PcOperationProvider } from './PcOperationContext';

export function PcProviders({ children }: { children: React.ReactNode }) {
  return (
    <PcLiveProvider>
      <PcCapabilityPollingProvider>
        <PcVideoExtractProvider>
          <PcOperationProvider>
            {children}
          </PcOperationProvider>
        </PcVideoExtractProvider>
      </PcCapabilityPollingProvider>
    </PcLiveProvider>
  );
}

export default PcProviders;
