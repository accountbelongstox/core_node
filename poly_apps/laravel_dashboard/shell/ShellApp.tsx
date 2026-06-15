/**
 * Unified shell root. One BrowserRouter, one provider tree, three lazy-loaded
 * ends mounted under prefixed routes + a cross-end summary home.
 *
 *   /                    redirects to /pycore-manager (default end)
 *   /home                summary home
 *   /laravel-manager/*   the existing dashboard (Lm)
 *   /pycore-manager/*    ported pycore manager (Pc)
 *   /wordflow/*          ported WordFlow client (Wf)
 *
 * Prod note: deep links need a server catch-all that serves index.html (dev is
 * covered by Vite's SPA fallback). See the plan's Risks section.
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShellProvider } from './ShellContext';
import { ShellLayout } from './ShellLayout';
import { ShellHome } from './ShellHome';
import { TaskPersistenceProvider } from '../core/tasks/TaskPersistenceProvider';
import { AppToaster } from '../core/notify/notify';

const LmApp = lazy(() => import('../apps/laravel-manager/LmApp'));
const PcApp = lazy(() => import('../apps/pycore-manager/PcApp'));
const WfApp = lazy(() => import('../apps/wordflow/WfApp'));

const Fallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
);

export const ShellApp: React.FC = () => {
  return (
    <TaskPersistenceProvider>
    <BrowserRouter>
      <ShellProvider>
        {/* Global toast viewport (core/notify) — one per app, top-right desktop stack. */}
        <AppToaster />
        <Routes>
          <Route element={<ShellLayout />}>
            {/* Default to the pycore end. ShellHome stays reachable at /home. */}
            <Route path="/" element={<Navigate to="/pycore-manager" replace />} />
            <Route path="/home" element={<ShellHome />} />
            <Route path="/laravel-manager/*" element={<Suspense fallback={<Fallback />}><LmApp /></Suspense>} />
            <Route path="/pycore-manager/*" element={<Suspense fallback={<Fallback />}><PcApp /></Suspense>} />
            <Route path="/wordflow/*" element={<Suspense fallback={<Fallback />}><WfApp /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ShellProvider>
    </BrowserRouter>
    </TaskPersistenceProvider>
  );
};

export default ShellApp;
