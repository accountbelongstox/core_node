/**
 * StandaloneApp — mounts ONE sub-app as the homepage for a flavor build.
 *
 * Unlike ShellApp (which mounts every end + cross-app chrome), this renders only
 * the selected flavor's app at the root, with the same provider tree so the app
 * behaves identically to when it runs inside the shell. Selected at build time by
 * `VITE_APP_FLAVOR` (see ./flavor + index.tsx). The other apps are NOT mounted —
 * with lazy-loading + tree-shaking, a flavor bundle effectively "compiles one
 * app out".
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShellProvider } from './ShellContext';
import { TaskPersistenceProvider } from '../core/tasks/TaskPersistenceProvider';
import { AppToaster } from '../core/notify/notify';
import type { FlavorConfig } from './flavor';

/** Lazy loaders for each buildable app (mirrors ShellApp's imports). */
const APP_LOADERS: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'wordnew': () => import('../apps/wordnew/WfNewApp'),
  'vortex': () => import('../apps/vortex/VortexApp'),
  'pycore-manager': () => import('../apps/pycore-manager/PcApp'),
  'laravel-manager': () => import('../apps/laravel-manager/LmApp'),
};

const Fallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
);

export const StandaloneApp: React.FC<{ flavor: FlavorConfig }> = ({ flavor }) => {
  const loader = APP_LOADERS[flavor.id];
  if (!loader) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-400 font-mono text-sm">
        Unknown app flavor: {flavor.id}
      </div>
    );
  }
  const App = lazy(loader);
  const route = flavor.rootRoute || '/';

  return (
    <TaskPersistenceProvider>
      <BrowserRouter>
        <ShellProvider>
          <AppToaster />
          <Routes>
            <Route path="/" element={<Navigate to={route} replace />} />
            <Route path={`${route}/*`} element={<Suspense fallback={<Fallback />}><App /></Suspense>} />
            <Route path="*" element={<Navigate to={route} replace />} />
          </Routes>
        </ShellProvider>
      </BrowserRouter>
    </TaskPersistenceProvider>
  );
};

export default StandaloneApp;
