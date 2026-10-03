/** Tool execution model: local functions and backend calls share one run/record/error path. */
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/apps/laravel-manager/api';
import type { APIResponse } from '@/apps/laravel-manager/types';
import { toolUsageStore } from './toolUsageStore';

export class ToolRunError extends Error {
  constructor(public readonly code: string, public readonly params: Record<string, unknown> = {}) {
    super(code);
  }
}

type ApiModules = Record<string, Record<string, (payload?: unknown) => Promise<APIResponse>>>;

/** Calls `<module>.<method>` of the Laravel Manager API with an explicit payload; throws ToolRunError on failure. */
export async function callToolApi<T = unknown>(apiMethod: string, payload?: unknown): Promise<T> {
  const [moduleName, methodName] = apiMethod.split('.');
  const fn = (api as unknown as ApiModules)[moduleName]?.[methodName];
  if (typeof fn !== 'function') throw new ToolRunError('api_method_not_found', { method: apiMethod });
  const response = await fn.call((api as unknown as ApiModules)[moduleName], payload);
  if (!response?.success) throw new ToolRunError('remote_failed', { message: response?.error ?? response?.message ?? '' });
  const body = response.data as { success?: unknown; message?: unknown; error?: unknown } | null;
  if (body && typeof body === 'object' && body.success === false) {
    throw new ToolRunError('remote_failed', { message: String(body.error ?? body.message ?? '') });
  }
  return response.data as T;
}

export interface ToolRunState<T> {
  result: T | null;
  error: string | null;
  running: boolean;
  /** Runs a local or remote job; the result is recorded to history unless record=false. */
  run: (input: unknown, job: () => T | Promise<T>, record?: boolean) => Promise<T | null>;
  reset: () => void;
  setResult: (value: T | null) => void;
}

/** One run lifecycle per workbench: latest call wins, errors are localized. */
export function useToolRun<T = unknown>(toolId: string, variant: string): ToolRunState<T> {
  const { t } = useTranslation();
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const seq = useRef(0);

  const run = useCallback(async (input: unknown, job: () => T | Promise<T>, record = true): Promise<T | null> => {
    const id = ++seq.current;
    setRunning(true);
    setError(null);
    try {
      const value = await job();
      if (id !== seq.current) return null;
      setResult(value);
      if (record) toolUsageStore.record(toolId, variant, input, value);
      return value;
    } catch (err) {
      if (id !== seq.current) return null;
      const message = err instanceof ToolRunError
        ? (err.code === 'remote_failed' && err.params.message
          ? String(err.params.message)
          : t(`uiTools.errors.${err.code}`, { ...err.params, defaultValue: err.code }))
        : err instanceof Error ? err.message : t('uiTools.errors.unknown');
      setError(message);
      setResult(null);
      return null;
    } finally {
      if (id === seq.current) setRunning(false);
    }
  }, [t, toolId, variant]);

  const reset = useCallback(() => {
    seq.current += 1;
    setResult(null);
    setError(null);
    setRunning(false);
  }, []);

  return { result, error, running, run, reset, setResult };
}
