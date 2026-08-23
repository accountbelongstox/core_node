/**
 * Unified shell root. One BrowserRouter, one provider tree, lazy-loaded
 * ends mounted under prefixed routes + a cross-end summary home.
 *
 *   /                    redirects to /pycore-manager (default end)
 *   /home                summary home
 *   /laravel-manager/*   the existing dashboard (Lm)
 *   /pycore-manager/*    ported pycore manager (Pc)
 *   /wordnew/*           the word-learning client (WfNew) — replaces old wordnew
 *
 * Prod note: deep links need a server catch-all that serves index.html (dev is
 * covered by Vite's SPA fallback). See the plan's Risks section.
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LmGlobalLoginHost } from '../apps/laravel-manager/auth/LmGlobalLoginHost';
import { ShellLayout } from './ShellLayout';
import { ShellHome } from './ShellHome';
import { ShellRouteFallback, ShellRuntime } from './ShellRuntime';

const LmApp = lazy(() => import('../apps/laravel-manager/LmApp'));
const PcApp = lazy(() => import('../apps/pycore-manager/PcApp'));
const WfNewApp = lazy(() => import('../apps/wordnew/WfNewApp'));
const VortexApp = lazy(() => import('../apps/vortex/VortexApp'));
const CmApp = lazy(() => import('../apps/codemart/CmApp'));
// const PddApp = lazy(() => import('../apps/pdd-manager/PddApp')); // Archived: PDD Manager is not exposed in UIApps.

export const ShellApp: React.FC = () => {
  return (
    <ShellRuntime authHost={<LmGlobalLoginHost />}>
      <Routes>
        <Route element={<ShellLayout />}>
          {/* Default to the pycore end. ShellHome stays reachable at /home. */}
          <Route path="/" element={<Navigate to="/pycore-manager" replace />} />
          <Route path="/home" element={<ShellHome />} />
          <Route path="/laravel-manager/*" element={<Suspense fallback={<ShellRouteFallback />}><LmApp /></Suspense>} />
          <Route path="/pycore-manager/*" element={<Suspense fallback={<ShellRouteFallback />}><PcApp /></Suspense>} />
          <Route path="/wordnew/*" element={<Suspense fallback={<ShellRouteFallback />}><WfNewApp /></Suspense>} />
          <Route path="/vortex/*" element={<Suspense fallback={<ShellRouteFallback />}><VortexApp /></Suspense>} />
          <Route path="/codemart/*" element={<Suspense fallback={<ShellRouteFallback />}><CmApp /></Suspense>} />
          {/* <Route path="/pdd-manager/*" element={<Suspense fallback={<ShellRouteFallback />}><PddApp /></Suspense>} /> */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ShellRuntime>
  );
};

export default ShellApp;
