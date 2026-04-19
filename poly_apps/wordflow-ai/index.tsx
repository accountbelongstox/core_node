
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
  const isImmersive = RouteCenter.isImmersiveRoute(currentPath);
  const showBottomNav = !isImmersive;

  return (
    <div className="h-full w-full relative flex flex-col bg-transparent overflow-hidden">
      <main className="flex-1 relative z-10 overflow-hidden flex flex-col min-h-0">
        <Routes>
          {ROUTE_REGISTRY.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                useAppLayout(route) ? (
                  <AppLayout>{route.element}</AppLayout>
                ) : (
                  route.element
                )
              }
            />
          ))}
        </Routes>
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
