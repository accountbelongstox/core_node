
import React, { useContext, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, AppContext } from './contexts/AppContext';
import { ROUTE_REGISTRY, RouteCenter, RouteConfig } from './router/RouteCenter';
import { AppLayout } from './components/AppLayout';
import { BottomTabNav } from './components/BottomTabNav';
import { GlobalInitializer } from './services/GlobalInitializer';
import { DialogManager } from './components/Dialog';
import './index.css';

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];
const CUSTOM_HEADER_PATHS = ['/vocabulary_library']; // routes that render their own Header (e.g. with back + actions)

function useAppLayout(route: RouteConfig): boolean {
  const isAuth = AUTH_PATHS.includes(route.path);
  const isImmersive = RouteCenter.isImmersiveRoute(route.path);
  const hasCustomHeader = CUSTOM_HEADER_PATHS.some((p) => route.path.startsWith(p));
  return !isAuth && !isImmersive && !hasCustomHeader;
}

// Router Component
const AppRouter = () => {
  const { user } = useContext(AppContext);
  const location = useLocation();

  useEffect(() => {
    GlobalInitializer.initialize();
    console.log('[App] Global services initialized:', GlobalInitializer.getStatus());
  }, []);

  const currentPath = location.pathname;
  // Product requirement: the bottom floating menu is shown on EVERY page.
  const showBottomNav = true;

  return (
    <div className="h-full w-full relative flex flex-col bg-transparent overflow-hidden">
      <main className="flex-1 relative z-10 overflow-hidden flex flex-col min-h-0">
        {/* Keyed wrapper → each route gently fades in (smooths the chrome swap
            on navigation, e.g. Settings/API Server ↔ Login). */}
        <div key={currentPath} className="route-fade flex-1 flex flex-col min-h-0">
          <Routes location={location}>
            {ROUTE_REGISTRY.map((route) => {
              const element: React.ReactNode = useAppLayout(route) ? (
                <AppLayout>{route.element}</AppLayout>
              ) : (
                route.element
              );
              // Built via createElement: this project has no @types/react, so the
              // JSX `key`-stripping mechanism is unavailable and react-router's
              // concretely-typed RouteProps rejects the synthetic `key` prop.
              // createElement keeps `key` in the element config (identical runtime
              // output) while typing the route props correctly.
              const routeProps: React.ComponentProps<typeof Route> = {
                path: route.path,
                element,
              };
              return React.createElement(Route, { key: route.path, ...routeProps });
            })}
          </Routes>
        </div>
      </main>

      {/* Bottom Tab Navigation */}
      {showBottomNav && <BottomTabNav />}
      
      {/* Dialog Manager for web fallback */}
      <DialogManager />
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <AppProvider>
      <AppRouter />
    </AppProvider>
  </BrowserRouter>
);
