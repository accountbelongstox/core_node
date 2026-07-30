/**
 * Shared React context providers for the pycore-manager end.
 * Mounted in PcApp for app-wide state.
 */
import React from 'react';
import { PcLiveProvider } from './PcLiveContext';
import { PcCapabilityProvider } from './PcCapabilityContext';
import { PcVideoExtractProvider } from './PcVideoExtractContext';
import { QueueCenterHubProvider } from './hooks/useQueueCenterHub';
import { PcOperationProvider } from './PcOperationContext';

export function PcProviders({ children }: { children: React.ReactNode }) {
  return (
    <PcLiveProvider>
      <PcCapabilityProvider>
        <PcVideoExtractProvider>
          <PcOperationProvider>
            <QueueCenterHubProvider>
              {children}
            </QueueCenterHubProvider>
          </PcOperationProvider>
        </PcVideoExtractProvider>
      </PcCapabilityProvider>
    </PcLiveProvider>
  );
}

export default PcProviders;
