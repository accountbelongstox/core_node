/**
 * Unified shell root. One BrowserRouter, one provider tree, lazy-loaded
 * ends mounted under prefixed routes + a cross-end summary home.
 *
 *   /                    redirects to /pycore-manager (default end)
 *   /home                summary home
 *   /laravel-manager/*   the existing dashboard (Lm)
 *   /pycore-manager/*    ported pycore manager (Pc)
 *   /wordnew/*           the word-learning client (WfNew) — replaces old wordnew
 *   /codemart/*          managed software delivery marketplace (Cm)
 *
 * Prod note: deep links need a server catch-all that serves index.html (dev is
 * covered by Vite's SPA fallback). See the plan's Risks section.
 */
import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { LaravelLoginHost } from '../shared/auth/LaravelLoginHost';
import { ShellLayout } from './ShellLayout';
import { ShellHome } from './ShellHome';
import { ShellRouteFallback, ShellRuntime } from './ShellRuntime';
import { FLAVOR } from './flavor';

/** A shell-mounted flavor lands on its own route; the plain shell defaults to the pycore end. */
const SHELL_HOME_ROUTE = FLAVOR.mount === 'shell' ? FLAVOR.rootRoute : '/pycore-manager';

const LmApp = lazy(() => import('../apps/laravel-manager/LmApp'));
const PcApp = lazy(() => import('../apps/pycore-manager/PcApp'));
const WfNewApp = lazy(() => import('../apps/wordnew/WfNewApp'));
const VortexApp = lazy(() => import('../apps/vortex/VortexApp'));
const CmApp = lazy(() => import('../apps/codemart/CmApp'));

/**
 * The shared Laravel reset-email link points at /password-reset/:token
 * (AppServiceProvider); CodeMart owns the only reset page in this shell, so
 * forward there and keep the query string (?email=).
 */
const ShellPasswordResetRedirect: React.FC = () => {
  const { token = '' } = useParams();
  const location = useLocation();
  return <Navigate to={`/codemart/password-reset/${token}${location.search}`} replace />;
};

export const ShellApp: React.FC = () => {
  return (
    <ShellRuntime authHost={<LaravelLoginHost />}>
      <Routes>
        <Route element={<ShellLayout />}>
          {/* Default to the pycore end. ShellHome stays reachable at /home. */}
          <Route path="/" element={<Navigate to={SHELL_HOME_ROUTE} replace />} />
          <Route path="/home" element={<ShellHome />} />
          <Route path="/laravel-manager/*" element={<Suspense fallback={<ShellRouteFallback />}><LmApp /></Suspense>} />
          <Route path="/pycore-manager/*" element={<Suspense fallback={<ShellRouteFallback />}><PcApp /></Suspense>} />
          <Route path="/wordnew/*" element={<Suspense fallback={<ShellRouteFallback />}><WfNewApp /></Suspense>} />
          <Route path="/vortex/*" element={<Suspense fallback={<ShellRouteFallback />}><VortexApp /></Suspense>} />
          <Route path="/codemart/*" element={<Suspense fallback={<ShellRouteFallback />}><CmApp /></Suspense>} />
          <Route path="/password-reset/:token" element={<ShellPasswordResetRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ShellRuntime>
  );
};

export default ShellApp;
