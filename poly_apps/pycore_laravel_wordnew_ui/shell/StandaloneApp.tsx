import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { TaskPersistenceProvider } from '../core/tasks/TaskPersistenceProvider';
import { AppToaster } from '../core/notify/notify';
import { ShellProvider } from './ShellContext';
import { FloatingAppSwitcher } from './FloatingAppSwitcher';
import { applyFlavorDocument, FLAVOR_REGISTRY, type FlavorConfig } from './flavor';

type AppModule = { default: React.ComponentType<any> };

const APP_MODULES = import.meta.glob('../apps/*/*App.tsx') as Record<string, () => Promise<AppModule>>;
const SWITCHABLE_APPS = Object.values(FLAVOR_REGISTRY).filter((candidate) => {
  return Boolean(candidate.entry && APP_MODULES[`../${candidate.entry}`]);
});

const Fallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
);

const UnknownApp: React.FC<{ flavor: FlavorConfig }> = ({ flavor }) => (
  <div className="min-h-screen flex items-center justify-center text-rose-400 font-mono text-sm">
    Unknown app flavor: {flavor.id}
  </div>
);

const StandaloneRoutes: React.FC<{ buildFlavor: FlavorConfig }> = ({ buildFlavor }) => {
  const [activeFlavor, setActiveFlavor] = useState(buildFlavor);
  const navigate = useNavigate();
  const loader = activeFlavor.entry ? APP_MODULES[`../${activeFlavor.entry}`] : undefined;
  const ActiveApp = useMemo(() => loader ? lazy(loader) : null, [loader]);
  const appElement = ActiveApp
    ? <Suspense fallback={<Fallback />}><ActiveApp /></Suspense>
    : <UnknownApp flavor={activeFlavor} />;
  const rootElement = activeFlavor.standalone?.homeAtRoot
    ? appElement
    : <Navigate to={activeFlavor.rootRoute || '/'} replace />;
  const switcherVisible = Boolean(
    buildFlavor.standalone?.switcher?.enabled && buildFlavor.standalone.switcher.visible,
  );
  const selectApp = (nextFlavor: FlavorConfig): void => {
    setActiveFlavor(nextFlavor);
    navigate(nextFlavor.id === buildFlavor.id && nextFlavor.standalone?.homeAtRoot
      ? '/'
      : nextFlavor.rootRoute || '/', { replace: true });
  };

  useEffect(() => {
    applyFlavorDocument(activeFlavor);
  }, [activeFlavor]);

  return (
    <>
      <Routes>
        <Route path="/" element={rootElement} />
        <Route path="*" element={appElement} />
      </Routes>
      <FloatingAppSwitcher
        active={activeFlavor}
        apps={SWITCHABLE_APPS}
        visible={switcherVisible}
        onSelect={selectApp}
      />
    </>
  );
};

export const StandaloneApp: React.FC<{ flavor: FlavorConfig }> = ({ flavor }) => (
  <TaskPersistenceProvider>
    <BrowserRouter>
      <ShellProvider>
        <AppToaster />
        <StandaloneRoutes buildFlavor={flavor} />
      </ShellProvider>
    </BrowserRouter>
  </TaskPersistenceProvider>
);

export default StandaloneApp;
