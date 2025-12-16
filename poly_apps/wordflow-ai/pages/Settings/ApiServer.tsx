import React from 'react';
import { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons } from '../../components/UI';
import { ApiEndpointSwitcher } from '../../components/ApiEndpointSwitcher';

const ApiServerSettings = () => {
  const { navigate } = useContext(AppContext);

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up-fade">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between">
        <button
          onClick={() => navigate('settings')}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5"
        >
          <Icons.ChevronLeft />
        </button>
        <h1 className="text-2xl font-serif text-slate-800 dark:text-white tracking-tight">API Server</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
        <div className="max-w-lg mx-auto w-full space-y-6">
          {/* Info Card */}
          <div className="holo-card p-5 rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/40">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3">Backend API Configuration</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              The app will automatically detect and connect to the first available API server based on priority.
              You can manually switch servers if needed.
            </p>

            {/* Endpoint Switcher Component */}
            <div className="flex justify-center mt-6">
              <ApiEndpointSwitcher />
            </div>
          </div>

          {/* How It Works */}
          <div className="holo-card p-5 rounded-3xl border border-white/60 dark:border-white/10 bg-white/60 dark:bg-slate-800/40">
            <h3 className="font-semibold text-slate-800 dark:text-white mb-3">How It Works</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Servers are tested in priority order on startup</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>First working server is automatically selected</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Health checks run periodically in the background</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <span>Manual selection persists across app restarts</span>
              </li>
            </ul>
          </div>

          {/* Technical Details */}
          <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
            <p>Health checks verify server availability via GET /api/health</p>
            <p>Response times are measured to help identify performance</p>
            <p>Selected endpoint is saved to localStorage</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiServerSettings;
