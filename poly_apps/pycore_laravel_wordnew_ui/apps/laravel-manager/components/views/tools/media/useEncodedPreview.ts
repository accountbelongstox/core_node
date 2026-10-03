/** Debounced "encode the current settings" job whose latest result drives the compare slider and size readouts. */
import { useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';
import { imageErrorCode } from './useImageExport';

const DEFAULT_DELAY_MS = 220;

export interface EncodedPreview {
  blob: Blob;
  width: number;
  height: number;
}

export interface EncodedPreviewState {
  result: EncodedPreview | null;
  busy: boolean;
  /** Error code under toolsMedia.errors. */
  error: string | null;
}

/** `compute` is null while there is nothing to encode; it re-runs whenever `deps` change. */
export const useEncodedPreview = (compute: (() => Promise<EncodedPreview>) | null, deps: DependencyList, delayMs = DEFAULT_DELAY_MS): EncodedPreviewState => {
  const [state, setState] = useState<EncodedPreviewState>({ result: null, busy: false, error: null });
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    if (!computeRef.current) {
      setState({ result: null, busy: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, busy: true, error: null }));
    const timer = window.setTimeout(async () => {
      try {
        const result = await computeRef.current!();
        if (!cancelled) setState({ result, busy: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ result: null, busy: false, error: imageErrorCode(err) });
      }
    }, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs]);

  return state;
};
