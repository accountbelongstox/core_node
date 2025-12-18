
import React, { useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, AppContext } from './contexts/AppContext';
import { Icons } from './components/UI';
import { Sparkles } from 'lucide-react';
import { ROUTE_REGISTRY, RouteCenter } from './router/RouteCenter';

// Router Component with URL-based navigation
const AppRouter = () => {
  const { user } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const isImmersive = RouteCenter.isImmersiveRoute(currentPath);
  const showDock = user && !isImmersive;

  return (
    <div className="h-full w-full max-w-md mx-auto relative flex flex-col bg-transparent overflow-hidden">
      <main className="flex-1 relative z-10 overflow-hidden">
        <Routes>
          {ROUTE_REGISTRY.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Routes>
      </main>

      {/* Premium Glass Dock - Fixed to bottom */}
      {showDock && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-50 pointer-events-none">
            {/* Dock Container - Pointer events auto to allow clicking buttons */}
            <div className="pointer-events-auto relative holo-card rounded-[2rem] px-5 py-3 flex justify-between items-center shadow-2xl border border-white/60 backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80">
              <button
                onClick={() => navigate('/home')}
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPath === '/home' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Icons.Home />
              </button>
              <button
                onClick={() => navigate('/playlist')}
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPath === '/playlist' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="text-xl font-bold">▶</span>
              </button>

              {/* Floating Action Button (FAB) */}
              <div className="relative -top-8">
                  <button
                    onClick={() => navigate('/reading_setup')}
                    className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white w-16 h-16 rounded-2xl shadow-lg shadow-blue-500/40 border-[4px] border-[#f8fafc] dark:border-slate-950 active:scale-95 transition-transform flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </button>
              </div>

              <button
                onClick={() => navigate('/quiz_run')}
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPath === '/quiz_run' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <span className="font-bold text-lg">?</span>
              </button>
              <button
                onClick={() => navigate('/settings')}
                className={`p-2 rounded-2xl transition-all duration-300 ${currentPath.startsWith('/settings') || currentPath.startsWith('/profile') ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Icons.Settings />
              </button>
            </div>
          </div>
      )}
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
