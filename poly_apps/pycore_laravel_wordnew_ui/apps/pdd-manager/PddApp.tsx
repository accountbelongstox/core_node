/**
 * pdd-manager end (Pdd*). Mounted by the shell at /pdd-manager/*.
 * Admin console for the 订多多 (Pinduoduo SaaS) backend. Sidebar layout + one
 * lazy route PER page, GENERATED from PDD_PAGES (the single registry the sidebar
 * also derives from) so the route table and the registry can never drift apart —
 * adding a page entry is enough. Mirrors apps/pycore-manager/PcApp.tsx.
 */
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PddLayout } from './PddLayout';
import { registerPddLocales } from './pdd-locales';

registerPddLocales();
import { PDD_PAGES } from './pddPages';

const Fallback: React.FC = () => <div className="p-8 text-slate-500">Loading…</div>;
const wrap = (node: React.ReactNode) => <Suspense fallback={<Fallback />}>{node}</Suspense>;

// react-router 7 types <Route> as a discriminated union that rejects a pre-built
// `{ path, element }` object literal in an array; this alias relaxes the prop
// typing so the registry can drive the routes (runtime is unchanged). Same
// pattern as PcApp.tsx.
const PddRoute = Route as unknown as React.ComponentType<{
  key?: React.Key; path?: string; index?: boolean; element?: React.ReactNode;
}>;

// One route per registry entry (plus an index route for the page flagged
// `index`), generated from PDD_PAGES so the route table can't drift.
const pddPageRoutes: React.ReactElement[] = PDD_PAGES.flatMap((p) => {
  const element = wrap(<p.Component />);
  const routes = [<PddRoute key={p.id} path={p.id} element={element} />];
  if (p.index) routes.unshift(<PddRoute key={`${p.id}-index`} index element={element} />);
  return routes;
});

const PddApp: React.FC = () => {
  return (
    <Routes>
      <Route element={<PddLayout />}>
        {/* Page routes are generated from PDD_PAGES — add a registry entry,
            get a route. */}
        {pddPageRoutes}
        <Route path="*" element={<Navigate to="/pdd-manager" replace />} />
      </Route>
    </Routes>
  );
};

export default PddApp;
