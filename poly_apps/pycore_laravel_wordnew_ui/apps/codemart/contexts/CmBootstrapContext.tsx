import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { subscribeAuthLoginSuccess } from '../../../core/auth/AuthRequestCenter';
import { cmApi } from '../api/CmApi';
import type { CmBootstrap } from '../api/CmApiTypes';

export interface CmBootstrapState {
  bootstrap: CmBootstrap | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasCapability: (capability: string | null) => boolean;
}

const CmBootstrapContext = createContext<CmBootstrapState | null>(null);

export const CmBootstrapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authenticated = useAuthSession();
  const [bootstrap, setBootstrap] = useState<CmBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const response = await cmApi.getBootstrap();
    if (response.success && response.data) {
      setBootstrap(response.data);
    } else {
      setBootstrap(null);
      setError(response.error ?? 'bootstrap_unavailable');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setBootstrap(null);
      return;
    }
    void load();
  }, [authenticated, load]);

  useEffect(() => subscribeAuthLoginSuccess(() => {
    void load();
  }), [load]);

  const value = useMemo<CmBootstrapState>(() => ({
    bootstrap,
    loading,
    error,
    refresh: load,
    hasCapability: (capability) => {
      if (capability === null) return true;
      if (!bootstrap) return false;
      return bootstrap.capabilities.includes(capability);
    },
  }), [bootstrap, loading, error, load]);

  return <CmBootstrapContext.Provider value={value}>{children}</CmBootstrapContext.Provider>;
};

export function useCmBootstrap(): CmBootstrapState {
  const context = useContext(CmBootstrapContext);
  if (!context) {
    throw new Error('useCmBootstrap must be used inside CmBootstrapProvider');
  }
  return context;
}

export default CmBootstrapContext;
