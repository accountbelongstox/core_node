
import React, { useContext, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, AppContext } from './contexts/AppContext';
import { ROUTE_REGISTRY, RouteCenter } from './router/RouteCenter';
import { BottomTabNav } from './components/BottomTabNav';
import { GlobalInitializer } from './services/GlobalInitializer';
import { DialogManager } from './components/Dialog';
import './index.css';

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
      <main className="flex-1 relative z-10 overflow-hidden">
        <Routes>
          {ROUTE_REGISTRY.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
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
