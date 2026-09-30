/** Live preview frame of the settings being edited: re-rendered by pycore ~500 ms after the last change. */
import { useEffect, useState } from 'react';
import { pycoreApi, type OrchVideoSettings } from '@/apps/pycore-manager/api';
import { ORCH_L, orchErrorMessage } from './orchShared';

const PREVIEW_DEBOUNCE_MS = 500;

export interface OrchVideoPreviewState {
  image: string;
  loading: boolean;
  error: string | null;
}

export function useOrchVideoPreview(settings: OrchVideoSettings | null, enabled: boolean): OrchVideoPreviewState {
  const [state, setState] = useState<OrchVideoPreviewState>({ image: '', loading: false, error: null });

  useEffect(() => {
    if (!enabled || !settings) return undefined;
    let cancelled = false;
    setState((current) => ({ ...current, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const response = await pycoreApi.orchVideoPreview(settings);
        if (!response.success || !response.image) throw response;
        if (!cancelled) setState({ image: response.image, loading: false, error: null });
      } catch (e) {
        if (!cancelled) setState((current) => ({ ...current, loading: false, error: orchErrorMessage(e, ORCH_L.videoPreviewFailed) }));
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [settings, enabled]);

  return state;
}
