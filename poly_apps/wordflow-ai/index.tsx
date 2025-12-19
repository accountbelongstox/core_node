
import React, { useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, AppContext } from './contexts/AppContext';
import { ROUTE_REGISTRY, RouteCenter } from './router/RouteCenter';
import { BottomTabNav } from './components/BottomTabNav';

// Router Component with URL-based navigation
const AppRouter = () => {
  const { user } = useContext(AppContext);
  const location = useLocation();

  const currentPath = location.pathname;
  const isImmersive = RouteCenter.isImmersiveRoute(currentPath);
  const showBottomNav = !isImmersive;

  return (
    <div className="h-full w-full sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto relative flex flex-col bg-transparent overflow-hidden">
      <main className="flex-1 relative z-10 overflow-hidden">
        <Routes>
          {ROUTE_REGISTRY.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </main>

      {/* Bottom Tab Navigation */}
      {showBottomNav && <BottomTabNav />}
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
