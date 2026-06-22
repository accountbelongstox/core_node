/* [v4.1-Iris] wordflow end (Wf*). Mounted by the shell at /wordflow/*.
 *
 * Applies the Iris component CSS + aura background, wraps everything in the
 * thin WfAppProvider (shell-backed theme/lang, wordflowApi-backed auth), and
 * renders the full route registry via useRoutes(WF_ROUTES). The registry owns
 * the layout (top bar + bottom island) vs immersive split. */
import React, { useEffect, useRef } from 'react';
import { useRoutes } from 'react-router-dom';
import './wf-iris-components.css';
import { WfAppProvider } from './WfAppContext';
import { WfErrorBoundary } from './WfErrorBoundary';
import { WF_ROUTES } from './WfRouteCenter';
import { apiManager } from '../../core/api-libs/wordflow/WordflowApiManager';
import {
  syncWordflowOfflineRecheckLoop,
  stopWordflowOfflineRecheckLoop,
} from '../../core/api-libs/wordflow/WordflowHealthRecheck';

const WfRoutes: React.FC = () => {
  const el = useRoutes(WF_ROUTES);
  return <>{el}</>;
};

/**
 * Fluid-Glass parallax driver. Writes normalized --wf-px / --wf-py (range
 * roughly [-0.5, 0.5]) onto the .wf-root element from pointer movement (desktop)
 * and device tilt (mobile). The aura layers in themes/iris.css multiply these by
 * their per-layer parallax range, so background blobs drift at different depths
 * behind the glass. Throttled via rAF; fully disabled under reduced-motion. */
const useWfParallax = (rootRef: React.RefObject<HTMLDivElement | null>) => {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduce?.matches) return;

    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      raf = 0;
      root.style.setProperty('--wf-px', px.toFixed(4));
      root.style.setProperty('--wf-py', py.toFixed(4));
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(apply);
    };

    const onPointer = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      px = e.clientX / w - 0.5;
      py = e.clientY / h - 0.5;
      schedule();
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      // gamma: left/right [-90,90], beta: front/back [-180,180]; clamp gently.
      const g = Math.max(-30, Math.min(30, e.gamma ?? 0));
      const b = Math.max(-30, Math.min(30, e.beta ?? 0));
      px = g / 60;
      py = b / 60;
      schedule();
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
    };
  }, [rootRef]);
};

const WfApp: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  useWfParallax(rootRef);

  // Endpoint detection + all-Offline retry, gated by the /wordflow prefix:
  // run detection proactively on mount (initialize() is single-flighted, so
  // WordflowApi's lazy ensureReady shares the same pass), then keep the
  // configurable-interval retry loop alive only while ALL endpoints are
  // Offline and only while this end is mounted.
  useEffect(() => {
    let cancelled = false;
    apiManager
      .initialize({ autoDetect: true })
      .catch(() => { /* degraded — loop below keeps retrying */ })
      .then(() => {
        if (!cancelled) syncWordflowOfflineRecheckLoop();
      });
    return () => {
      cancelled = true;
      stopWordflowOfflineRecheckLoop();
    };
  }, []);

  return (
    <div className="wf-root min-h-screen" data-end="wordflow" ref={rootRef}>
      {/* Iris aura background — three parallax depth layers (scoped by
          html[data-theme="iris"]; mounted as direct .wf-root children only). */}
      <div className="ds-aura-bg" />
      <div className="ds-aura-overlay" />
      <div className="ds-aura-blobs" />
      <WfErrorBoundary>
        <WfAppProvider>
          <WfRoutes />
        </WfAppProvider>
      </WfErrorBoundary>
    </div>
  );
};

export default WfApp;
