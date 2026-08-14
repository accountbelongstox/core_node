import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useApiResource — one place for the loading/error/data triad that ~30 panels
 * hand-roll. Normalizes the app's APIResponse {success,data,error} shape, guards
 * setState after unmount, exposes refresh() for the ubiquitous Refresh button, and
 * folds in optional polling. Stronger than the inline copies (most of which set
 * state after unmount and re-check the response shape by hand).
 */
export interface ApiResponseLike<T> { success?: boolean; data?: T; error?: string }

export interface UseApiResourceOptions<T> {
  /** Run the fetcher on mount. Default true. */
  immediate?: boolean;
  /** Re-run when any of these change (like useEffect deps). */
  deps?: any[];
  /** Poll every N ms while mounted. */
  pollMs?: number;
  initialData?: T | null;
  onSuccess?: (data: T) => void;
  onError?: (err: string) => void;
}

export interface UseApiResourceReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<T | null>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
  reset: () => void;
}

export function useApiResource<T = any>(
  fetcher: () => Promise<ApiResponseLike<T> | T>,
  options: UseApiResourceOptions<T> = {}
): UseApiResourceReturn<T> {
  const { immediate = true, deps = [], pollMs, initialData = null, onSuccess, onError } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const cbRef = useRef({ onSuccess, onError });
  cbRef.current = { onSuccess, onError };

  const refresh = useCallback(async (): Promise<T | null> => {
    if (mounted.current) { setLoading(true); setError(null); }
    try {
      const res: any = await fetcherRef.current();
      const ok = res && typeof res === 'object' && 'success' in res ? res.success : true;
      const payload = res && typeof res === 'object' && 'data' in res ? res.data : res;
      if (!mounted.current) return null;
      if (ok === false) {
        const msg = (res && res.error) || 'Request failed';
        setError(msg); cbRef.current.onError?.(msg); return null;
      }
      setData(payload); cbRef.current.onSuccess?.(payload); return payload;
    } catch (e: any) {
      const msg = e?.message || 'Network error';
      if (mounted.current) { setError(msg); cbRef.current.onError?.(msg); }
      return null;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (immediate) refresh();
    let id: any;
    if (pollMs && pollMs > 0) id = setInterval(() => { refresh(); }, pollMs);
    return () => { mounted.current = false; if (id) clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reset = useCallback(() => { setData(initialData); setError(null); setLoading(false); }, []);
  return { data, loading, error, refresh, setData, reset };
}

export default useApiResource;
