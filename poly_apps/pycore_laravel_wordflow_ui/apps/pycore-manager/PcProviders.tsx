/**
 * Shared React context providers for the pycore-manager end.
 * Mounted in PcApp (wraps all layout routes) so every consumer — top bar, pages,
 * floating log — shares one provider tree co-located with the layout element.
 */
import React from 'react';
import { PcLiveProvider } from './PcLiveContext';
import { PcLaravelEndpointProvider } from './PcLaravelEndpointContext';
import { PcCapabilityProvider } from './PcCapabilityContext';
import { PcVideoExtractProvider } from './PcVideoExtractContext';

export function PcProviders({ children }: { children: React.ReactNode }) {
  return (
    <PcLiveProvider>
      <PcLaravelEndpointProvider>
        <PcCapabilityProvider>
          <PcVideoExtractProvider>
            {children}
          </PcVideoExtractProvider>
        </PcCapabilityProvider>
      </PcLaravelEndpointProvider>
    </PcLiveProvider>
  );
}

export default PcProviders;
