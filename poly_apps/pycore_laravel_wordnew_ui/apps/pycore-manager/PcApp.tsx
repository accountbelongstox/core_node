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

registerPcLocales();
import { PC_PAGES } from './pcPages';

const Fallback: React.FC = () => <div className="p-8 text-slate-500">Loading…</div>;
const wrap = (node: React.ReactNode) => <Suspense fallback={<Fallback />}>{node}</Suspense>;

// react-router 7 types <Route> as a discriminated union (PathRoute | IndexRoute |
// LayoutRoute) that rejects a pre-built `{ path, element }` object literal when
// constructed in an array (the original reason these routes were hand-written).
// The runtime component is unchanged — this alias only relaxes the prop typing so
// the registry can drive the routes. Children of <Routes> are still real Routes.
const PcRoute = Route as unknown as React.ComponentType<{
  key?: React.Key; path?: string; index?: boolean; element?: React.ReactNode;
}>;

// One route per registry entry (plus an index route for the page flagged
// `index`), generated from PC_PAGES so the route table can't drift.
const pcPageRoutes: React.ReactElement[] = PC_PAGES.flatMap((p) => {
  const element = wrap(<p.Component />);
  const routes = [<PcRoute key={p.id} path={p.id} element={element} />];
  if (p.index) routes.unshift(<PcRoute key={`${p.id}-index`} index element={element} />);
  return routes;
});

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
        <Route path="*" element={<Navigate to="/pycore-manager" replace />} />
          </Route>
        </Routes>
      </PcProviders>
    </PcUiStateBackupGate>
  );
};

export default PcApp;
