/**
 * pycore-manager end (Pc*). Mounted by the shell at /pycore-manager/*.
 * Sidebar layout + one lazy route PER page, GENERATED from PC_PAGES (the single
 * registry the sidebar also derives from) so the route table and the registry
 * can never drift apart — adding a page entry is enough.
 */
import React, { Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PcLayout } from './PcLayout';
import { PcProviders } from './PcProviders';
import {
  checkPycoreNow, syncPycoreOfflineRecheckLoop, stopPycoreOfflineRecheckLoop,
} from '@/apps/pycore-manager/api';
import { registerPcLocales } from './pc-locales';
import { PcLanguageSync } from './PcLanguageSync';
import { PcUiStateBackupGate } from './persistence/PcUiStateBackupGate';
import {
  createAppRouteElements,
  type AppRouteElementDefinition,
} from '../../shared/routing/AppRouteElements';
import { PC_PAGES } from './pcPages';
import { PcCloudClipboardRedirect } from './components/PcCloudClipboardRedirect';
import { CLOUD_CLIPBOARD_PAGE_SLUG } from '../../shared/cloud-clipboard/CloudClipboardNavigation';

registerPcLocales();

const Fallback: React.FC = () => <div className="p-8 text-slate-500">Loading…</div>;
const wrap = (node: React.ReactNode) => <Suspense fallback={<Fallback />}>{node}</Suspense>;

// One route per registry entry (plus an index route for the page flagged
// `index`), generated from PC_PAGES so the route table can't drift.
// Warm the index page chunk at module scope: route elements only trigger their
// lazy import at render time, which would otherwise serialize the first page
// behind everything else instead of loading in parallel.
void import('./pages/PcAgentHistoryPage');

const pcPageRoutes = createAppRouteElements(PC_PAGES.flatMap((p) => {
  const element = wrap(<p.Component />);
  const routes: AppRouteElementDefinition[] = [{ key: p.id, path: p.id, element }];
  if (p.index) routes.unshift({ key: `${p.id}-index`, index: true, element });
  return routes;
}));

const PcApp: React.FC = () => {
  // Pycore reachability, gated by the /pycore-manager prefix: one ping on
  // mount, then the all-Offline retry loop re-pings at the configurable
  // interval (PcSettingsPage) only while the backend is down; stops on
  // recovery and on unmount.
  useEffect(() => {
    let cancelled = false;
    checkPycoreNow().then(() => {
      if (!cancelled) syncPycoreOfflineRecheckLoop();
    });
    return () => {
      cancelled = true;
      stopPycoreOfflineRecheckLoop();
    };
  }, []);

  return (
    <PcUiStateBackupGate>
      <PcLanguageSync />
      <PcProviders>
        <Routes>
          <Route element={<PcLayout />}>
        {/* Page routes are generated from PC_PAGES (above) — add a registry
            entry, get a route. */}
        {pcPageRoutes}
        <Route path={CLOUD_CLIPBOARD_PAGE_SLUG} element={<PcCloudClipboardRedirect />} />
        <Route path="*" element={<Navigate to="/pycore-manager" replace />} />
          </Route>
        </Routes>
      </PcProviders>
    </PcUiStateBackupGate>
  );
};

export default PcApp;
