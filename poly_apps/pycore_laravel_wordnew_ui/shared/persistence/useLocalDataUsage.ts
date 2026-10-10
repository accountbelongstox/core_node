import { useCallback, useEffect, useRef, useState } from 'react';
import { clearLocalDataGroup, measureLocalData } from './LocalDataUsage';
import type { LocalDataReport } from './LocalDataUsage';

export interface LocalDataUsageState {
  report: LocalDataReport | null;
  loading: boolean;
  clearingId: string | null;
  refresh: () => Promise<void>;
  clearGroup: (id: string) => Promise<boolean>;
}

export function useLocalDataUsage(): LocalDataUsageState {
  const [report, setReport] = useState<LocalDataReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await measureLocalData();
      if (mounted.current) setReport(next);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const clearGroup = useCallback(async (id: string) => {
    setClearingId(id);
    try {
      const cleared = await clearLocalDataGroup(id);
      await refresh();
      return cleared;
    } finally {
      if (mounted.current) setClearingId(null);
    }
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { report, loading, clearingId, refresh, clearGroup };
}
