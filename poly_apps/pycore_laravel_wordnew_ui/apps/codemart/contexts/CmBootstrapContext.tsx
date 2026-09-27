import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '../../../core/auth/useAuthSession';
import { subscribeAuthLoginSuccess } from '../../../core/auth/AuthRequestCenter';
import { cmApi } from '../api/CmApi';
import type { CmBootstrap } from '../api/CmApiTypes';

const UNREAD_REFRESH_INTERVAL_MS = 60_000;
const BOOTSTRAP_UNAVAILABLE_ERROR = 'bootstrap_unavailable';

function loginUserId(user: unknown): number | null {
  const source = user && typeof user === 'object' ? user as { id?: unknown; user_id?: unknown } : null;
  const raw = source ? source.id ?? source.user_id : null;
  const id = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : Number.NaN;
  return Number.isFinite(id) ? id : null;
}

export interface CmBootstrapState {
  bootstrap: CmBootstrap | null;
  loading: boolean;
  error: string | null;
  unreadCount: number;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  hasCapability: (capability: string | null) => boolean;
  hasRole: (roleType: string, status?: string) => boolean;
}

const CmBootstrapContext = createContext<CmBootstrapState | null>(null);

export const CmBootstrapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authenticated = useAuthSession();
  const [bootstrap, setBootstrap] = useState<CmBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const requestRef = useRef(0);
  const bootstrapUserIdRef = useRef<number | null>(null);
  bootstrapUserIdRef.current = bootstrap?.user.id ?? null;

  const load = useCallback(async (): Promise<void> => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError(null);
    const response = await cmApi.getBootstrap();
    if (requestId !== requestRef.current) return;
    if (response.success && response.data) {
      setBootstrap(response.data);
      setUnreadCount(response.data.counters?.unread_notifications ?? 0);
    } else {
      setError(response.error ?? BOOTSTRAP_UNAVAILABLE_ERROR);
    }
    setLoading(false);
  }, []);

  const refreshUnread = useCallback(async (): Promise<void> => {
    const response = await cmApi.getUnreadCount();
    if (response.success && response.data) {
      setUnreadCount(response.data.unread);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) {
      requestRef.current += 1;
      setBootstrap(null);
      setError(null);
      setLoading(false);
      setUnreadCount(0);
      return;
    }
    void load();
  }, [authenticated, load]);

  useEffect(() => subscribeAuthLoginSuccess((detail) => {
    const userId = loginUserId(detail.user);
    if (userId !== null && bootstrapUserIdRef.current !== null && userId !== bootstrapUserIdRef.current) {
      setBootstrap(null);
      setUnreadCount(0);
    }
    void load();
  }), [load]);

  useEffect(() => {
    if (!authenticated || !bootstrap) return undefined;
    const timer = window.setInterval(() => {
      void refreshUnread();
    }, UNREAD_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [authenticated, bootstrap, refreshUnread]);

  const value = useMemo<CmBootstrapState>(() => ({
    bootstrap,
    loading,
    error,
    unreadCount,
    refresh: load,
    refreshUnread,
    hasCapability: (capability) => {
      if (capability === null) return true;
      if (!bootstrap) return false;
      return bootstrap.capabilities.includes(capability);
    },
    hasRole: (roleType, status) => {
      const current = bootstrap?.roles?.[roleType];
      return current !== undefined && (status === undefined || current === status);
    },
  }), [bootstrap, loading, error, unreadCount, load, refreshUnread]);

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
