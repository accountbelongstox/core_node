import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { LmGlobalLoginHost } from '../apps/laravel-manager/auth/LmGlobalLoginHost';
import { useTranslation } from '../core/i18n/UiI18n';
import { FloatingAppSwitcher } from './FloatingAppSwitcher';
import { applyFlavorDocument, FLAVOR_REGISTRY, type FlavorConfig } from './flavor';
import { ShellRouteFallback, ShellRuntime } from './ShellRuntime';

type AppModule = { default: React.ComponentType<any> };

const APP_MODULES = import.meta.glob('../apps/*/*App.tsx') as Record<string, () => Promise<AppModule>>;
const SWITCHABLE_APPS = Object.values(FLAVOR_REGISTRY).filter((candidate) => {
  return Boolean(candidate.entry && APP_MODULES[`../${candidate.entry}`]);
});

const UnknownApp: React.FC<{ flavor: FlavorConfig }> = ({ flavor }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center text-rose-400 font-mono text-sm">
      {t('common.unknown_app_flavor', { id: flavor.id })}
    </div>
  );
};

const StandaloneRoutes: React.FC<{ buildFlavor: FlavorConfig }> = ({ buildFlavor }) => {
  const [activeFlavor, setActiveFlavor] = useState(buildFlavor);
  const navigate = useNavigate();
  const loader = activeFlavor.entry ? APP_MODULES[`../${activeFlavor.entry}`] : undefined;
  const ActiveApp = useMemo(() => loader ? lazy(loader) : null, [loader]);
  const appElement = ActiveApp
    ? <Suspense fallback={<ShellRouteFallback />}><ActiveApp /></Suspense>
    : <UnknownApp flavor={activeFlavor} />;
  // The homepage is ALWAYS the flavor's own route (e.g. /wordnew): '/' redirects
  // there (React Router declarative redirect), and the splat route serves the app
  // under it - identical URL semantics to shell mode and to the Capacitor WebView
  // (its local server serves index.html for any app path).
  const rootElement = <Navigate to={activeFlavor.rootRoute || '/'} replace />;
  const switcherVisible = Boolean(
    buildFlavor.standalone?.switcher?.enabled && buildFlavor.standalone.switcher.visible,
  );
  const selectApp = (nextFlavor: FlavorConfig): void => {
    setActiveFlavor(nextFlavor);
    navigate(nextFlavor.rootRoute || '/', { replace: true });
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
  <ShellRuntime authHost={<LmGlobalLoginHost />}>
    <StandaloneRoutes buildFlavor={flavor} />
  </ShellRuntime>
);

export default StandaloneApp;
