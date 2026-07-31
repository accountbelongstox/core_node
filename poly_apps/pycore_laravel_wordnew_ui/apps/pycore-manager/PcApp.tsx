/**
 * pycore-manager end (Pc*). Mounted by the shell at /pycore-manager/*.
 * Sidebar layout + one lazy route PER page, GENERATED from PC_PAGES (the single
 * registry the sidebar also derives from) so the route table and the registry
 * can never drift apart — adding a page entry is enough. Only the legacy
 * `<Navigate>` redirects (old slugs that merged into tabbed pages) stay manual.
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
    <>
    <PcLanguageSync />
    <PcProviders>
    <Routes>
      <Route element={<PcLayout />}>
        {/* Page routes are generated from PC_PAGES (above) — add a registry
            entry, get a route. */}
        {pcPageRoutes}
        {/* Legacy redirects (manual): old slugs that merged into tabbed pages,
            each landing on the matching ?tab=. These have no PC_PAGES entry, so
            they are intentionally kept here rather than generated. */}
        <Route path="voice-player" element={<Navigate to="/pycore-manager/voice-subtitle" replace />} />
        <Route path="subtitle" element={<Navigate to="/pycore-manager/voice-subtitle" replace />} />
        <Route path="queue" element={<Navigate to="/pycore-manager/queue-center?tab=manager" replace />} />
        <Route path="task-queue" element={<Navigate to="/pycore-manager/queue-center?tab=tasks" replace />} />
        <Route path="translation-queue" element={<Navigate to="/pycore-manager/queue-center?tab=translation" replace />} />
        <Route path="video-extract" element={<Navigate to="/pycore-manager/content?tab=subtitles" replace />} />
        <Route path="books" element={<Navigate to="/pycore-manager/content?tab=books" replace />} />
        <Route path="corebook" element={<Navigate to="/pycore-manager/content?tab=books" replace />} />
        <Route path="movie-poster" element={<Navigate to="/pycore-manager/queue-center?tab=overview" replace />} />
        <Route path="ai-status" element={<Navigate to="/pycore-manager/ai?tab=capability" replace />} />
        <Route path="ai-image" element={<Navigate to="/pycore-manager/ai?tab=studio" replace />} />
        <Route path="ai-keys" element={<Navigate to="/pycore-manager/ai?tab=keys" replace />} />
        {/* Translate / Image Search / Subtitle Search folded into the AI page as tabs. */}
        <Route path="translate" element={<Navigate to="/pycore-manager/ai?tab=translate" replace />} />
        <Route path="image-search" element={<Navigate to="/pycore-manager/ai?tab=imageSearch" replace />} />
        <Route path="subtitle-search" element={<Navigate to="/pycore-manager/ai?tab=subtitleSearch" replace />} />
        <Route path="*" element={<Navigate to="/pycore-manager" replace />} />
      </Route>
    </Routes>
    </PcProviders>
    </>
  );
};

export default PcApp;
