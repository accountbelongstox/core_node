/* [v4.1-Iris] wordflow end (Wf*). Mounted by the shell at /wordflow/*.
 *
 * Applies the Iris component CSS + aura background, wraps everything in the
 * thin WfAppProvider (shell-backed theme/lang, wordflowApi-backed auth), and
 * renders the full route registry via useRoutes(WF_ROUTES). The registry owns
 * the layout (top bar + bottom island) vs immersive split. */
import React, { useEffect } from 'react';
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

const WfApp: React.FC = () => {
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
    <div className="wf-root min-h-screen" data-end="wordflow">
      {/* Iris aura background (scoped by html[data-theme="iris"]) */}
      <div className="ds-aura-bg" />
      <div className="ds-aura-overlay" />
      <WfErrorBoundary>
        <WfAppProvider>
          <WfRoutes />
        </WfAppProvider>
      </WfErrorBoundary>
    </div>
  );
};

export default WfApp;
