import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { requestPycoreHttp } from '@/apps/pycore-manager/api';
import { PYCORE_HTTP_ROUTES } from '@/apps/pycore-manager/api';

export type OperationSnapshot = Record<string, unknown> | null;

type PcOperationContextValue = {
  snapshots: Record<string, OperationSnapshot>;
  loadSnapshot: (scope: string, operationId?: string) => Promise<OperationSnapshot>;
  subscribeTopic: (topic: string, handler: (payload: unknown) => void) => () => void;
};

const PcOperationContext = createContext<PcOperationContextValue | null>(null);

export function PcOperationProvider({ children }: { children: React.ReactNode }) {
  const [snapshots, setSnapshots] = useState<Record<string, OperationSnapshot>>({});

  const loadSnapshot = useCallback(async (scope: string, operationId?: string) => {
    const resp = await requestPycoreHttp(PYCORE_HTTP_ROUTES.operationSnapshot, {
      scope,
      operation_id: operationId,
    });
    const data = (resp as { data?: OperationSnapshot })?.data ?? (resp as OperationSnapshot);
    setSnapshots((prev) => ({ ...prev, [scope]: data }));
    return data;
  }, []);

  const subscribeTopic = useCallback((topic: string, handler: (payload: unknown) => void) => {
    return pycoreEventBus.subscribe(topic, handler);
  }, []);

  const value = useMemo(
    () => ({ snapshots, loadSnapshot, subscribeTopic }),
    [snapshots, loadSnapshot, subscribeTopic],
  );

  return <PcOperationContext.Provider value={value}>{children}</PcOperationContext.Provider>;
}

export function usePcOperation(scope?: string) {
  const ctx = useContext(PcOperationContext);
  if (!ctx) {
    throw new Error('usePcOperation must be used within PcOperationProvider');
  }
  return {
    ...ctx,
    snapshot: scope ? ctx.snapshots[scope] ?? null : null,
  };
}

export default PcOperationProvider;
