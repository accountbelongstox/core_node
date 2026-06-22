import { useState, useCallback } from 'react';
import { APIResponse } from '../types';

export interface UseApiRequestOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  immediate?: boolean;
}

export interface UseApiRequestReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<APIResponse<T> | undefined>;
  reset: () => void;
  setData: (data: T | null) => void;
}

/**
 * Generic API request Hook - centrally manages loading, error, and data state
 *
 * @example
 * const { data, loading, error, execute } = useApiRequest(
 *   () => api.appQyV1.getVocabularyStatistics()
 * );
 *
 * // Manual execution
 * useEffect(() => { execute(); }, []);
 *
 * @example
 * // Request with parameters
 * const { data, loading, error, execute } = useApiRequest(
 *   (id: string) => api.appQyV1.getLibrary(id)
 * );
 * execute('library-id');
 */
export function useApiRequest<T = any>(
  apiCall: (...args: any[]) => Promise<APIResponse<T>>,
  options?: UseApiRequestOptions
): UseApiRequestReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (...args: any[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(...args);

      if (response.success && response.data) {
        setData(response.data);
        options?.onSuccess?.(response.data);
        return response;
      } else {
        const errorMsg = response.error || 'Request failed';
        setError(errorMsg);
        options?.onError?.(errorMsg);
        return response;
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error occurred';
      setError(errorMsg);
      options?.onError?.(errorMsg);
      console.error('[useApiRequest] Error:', err);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [apiCall, options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    setData
  };
}

/**
 * Simplified loading and error state Hook
 *
 * @example
 * const { loading, error, setLoading, setError, clearError } = useLoadingError();
 */
export function useLoadingError() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    setLoading,
    setError,
    clearError
  };
}
