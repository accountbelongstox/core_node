import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import MediaHub from './components/views/MediaHub';
import { UnifiedToolsPage } from './components/views/UnifiedToolsPage';
import ApiTester from './components/views/ApiTester';
import VocabularyLearning from './components/views/VocabularyLearning';
import AiManagement from './components/views/AiManagement';
import WordAudioCapability from './components/views/WordAudioCapability';
import TaskCenter from './components/views/TaskCenter';
import ServerManager from './components/views/ServerManager';
import DatabaseManager from './components/views/DatabaseManager';
import Settings from './components/views/Settings';
import AuthGuard from './components/auth/AuthGuard';
import { HtmlErrorModal } from './components/HtmlErrorModal';
import { UnifiedAppProvider } from './context/UnifiedAppContext';
import { useUnifiedApp } from './context/useUnifiedApp';
import { ToastProvider } from './components/admin';
import { api } from '@/apps/laravel-manager/api';
import { userModel } from './models/UserModel';
import { ViewType } from './uiTypes';
import { useTranslation } from 'react-i18next';
import { isRequireLoginView, setDebugAuthBypass } from './config/auth';
import { htmlErrorManager, HtmlErrorEvent } from '@/core/integrations/laravel/transport/HtmlErrorEvents';
import { apiManager } from '@/core/integrations/laravel/ApiManager';
import { syncOfflineRecheckLoop, stopOfflineRecheckLoop } from './services/ApiHealthRecheck';
import GlobalLogPanel from '@/apps/laravel-manager/components/common/GlobalLogPanel';
import OfflineBanner from '@/apps/laravel-manager/components/common/OfflineBanner';
import { dismissAuthLogin, requestAuthLogin } from '@/core/auth/AuthRequestCenter';

/**
 * Laravel manager layout and view routing.
 *
 * PROTECTED PAGES (require login; see config/auth.ts): Server Manager, Settings, Invite Code Manager, Database Viewer.
 * When user opens any of these without being logged in, AuthGuard requests the
 * global login modal while keeping the page mounted and visible.
 */
const LmDashboardContent: React.FC = () => {
  const {
    activeView,
    setActiveView,
    lang,
    toggleLang,
    theme,
    toggleTheme,
    isLoggedIn,
    logout: userLogout,
    UnifiedUser: user,
  } = useUnifiedApp();
  const { t } = useTranslation();

  const [htmlError, setHtmlError] = useState<HtmlErrorEvent | null>(null);
  const [apiReady, setApiReady] = useState(false);
  /** Bumped once the loopback debug-status probe resolves so AuthGuard re-reads the bypass flag. */
  const [, setDebugProbed] = useState(false);

  // Initialize API Manager and set global API base URL before any views run requests.
  // This ensures the preferred endpoint (from API Endpoints switcher / store) is used everywhere.
  useEffect(() => {
    // FIRST PAINT IS NEVER BLOCKED BY A PROBE.
    //
    // Step 1 (synchronous, no network): pick the active endpoint instantly
    // from the store/priority precedence, point `api` at it and flip
    // apiReady=true in the same tick. The app shell renders immediately —
    // there is no awaited health probe between mount and paint, so dead LAN
    // IPs / slow HTTPS remotes can no longer cause the white
    // "Loading API endpoint..." screen.
    const preselected = apiManager.preselectEndpointSync();
    if (preselected) {
      api.updateBaseURL(apiManager.getCurrentBaseUrl());
      console.log('[ApiManager] Pre-selected (sync):', apiManager.getCurrentBaseUrl());
    }
    setApiReady(true);

    // Step 2 (background, does NOT gate paint): the shared STORED-FIRST
    // detection pass (single-flight + StrictMode-safe). The localStorage
    // endpoint is an invariant across refresh, HMR, and StrictMode remounts:
    // this pass may update its health badge but MUST NOT replace it. A sweep
    // and automatic persisted choice are allowed only on the first run when
    // no stored selection exists. No timeout override here — the config's 3000ms applies (a
    // 1s override regressed the Octane cold-worker fix recorded in
    // core/integrations/laravel/LaravelEndpoints.ts and froze a false all-Offline state). The pass
    // itself dispatches `api-health-initialized` for the read-only switcher.
    //
    // If EVERYTHING is Offline (e.g. the WSL backend was started after this
    // page loaded), syncOfflineRecheckLoop starts the per-end retry loop:
    // re-run the same pass at the configurable healthCheckInterval until
    // something comes online, then stop. Unmounting this end stops the loop
    // (path-prefix gating — /laravel-manager owns this scheduler).
    let cancelled = false;
    const refineApiHealth = async () => {
      const chosen = await apiManager.runBackgroundHealthPass();
      if (cancelled) return;

      if (chosen) {
        const baseUrl = apiManager.getCurrentBaseUrl();
        if (!preselected || chosen.id !== preselected.id) {
          api.updateBaseURL(baseUrl);
          console.log('[ApiManager] Initial endpoint selected:', baseUrl);
        }
      }

      syncOfflineRecheckLoop();
    };

    refineApiHealth();

    return () => {
      cancelled = true;
      stopOfflineRecheckLoop();
    };
  }, []);

  // Login state lives in UnifiedAppContext (useUnifiedApp().isLoggedIn already
  // reflects it) — no legacy setIsLoggedIn sync needed.

  // Loopback DEBUG auth bypass: probe the open /auth/debug-status once on
  // startup. When debug_mode is true (request came from 127.0.0.1) we set the
  // global bypass flag so AuthGuard treats every user as authenticated and the
  // login modal never appears. When false, behavior is unchanged.
  useEffect(() => {
    let cancelled = false;
    api.authDebug
      .getDebugStatus()
      .then((status) => {
        if (cancelled || !status) return;
        if (status.debug_mode === true) {
          setDebugAuthBypass(true);
          console.log('[Auth] Loopback debug bypass enabled:', status.reason, status.client_ip);
          userModel.bootstrapLoopbackSession().then((ok) => {
            if (ok) {
              console.log('[Auth] Loopback session bootstrapped from server profile');
            }
          });
          // Force a re-render so already-mounted AuthGuards re-read the flag.
          setDebugProbed(true);
          // Dismiss any login modal an AuthGuard opened before the (async) probe
          // resolved: a protected view can mount and call onLoginRequest() in the
          // same tick as startup, latching showLoginModal=true. Once the bypass is
          // known to be active the modal must go away, otherwise it stays stuck
          // over already-unlocked content.
          dismissAuthLogin();
        }
      })
      .catch(() => {
        /* open endpoint best-effort; bypass stays off so auth remains required */
        console.warn('[Auth] debug-status probe failed; loopback bypass disabled');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for HTML error events
  useEffect(() => {
    const unsubscribe = htmlErrorManager.addListener((event) => {
      setHtmlError(event);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    console.log('[LaravelManager] Mounted with activeView:', activeView);
  }, []);

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      await userLogout();
    } else {
      requestAuthLogin({ source: 'laravel-manager-header', reason: 'header-auth' });
    }
  };

  // Auth is required by default for protected views. Set window.DISABLE_AUTH = true only to skip login (e.g. local testing).
  const disableAuth = (window as any).DISABLE_AUTH === true;

  /** Wraps content with AuthGuard when this view requires login and auth is enabled. Reused for all protected views. */
  const wrapWithAuthGuard = (viewType: ViewType, content: React.ReactNode) => {
    if (disableAuth || !isRequireLoginView(viewType)) {
      return content;
    }
    return <AuthGuard requireAuth>{content}</AuthGuard>;
  };

  const renderView = () => {
    switch (activeView) {
      case ViewType.MEDIA_BROWSER:
        return (
          <MediaHub
            lang={lang}
            onRequireLogin={() => requestAuthLogin({ source: 'laravel-manager-media', reason: 'protected-feature' })}
          />
        );
      case ViewType.TOOLS:
        return <UnifiedToolsPage lang={lang} />;
      case ViewType.API_TESTER:
        return <ApiTester lang={lang} />;
      case ViewType.VOCABULARY:
        return <VocabularyLearning />;
      case ViewType.AI_MANAGEMENT:
        return <AiManagement />;
      case ViewType.WORD_AUDIO:
        return <WordAudioCapability />;
      case ViewType.TASK_CENTER:
        return <TaskCenter lang={lang} />;
      case ViewType.SERVER_MANAGER:
        return wrapWithAuthGuard(ViewType.SERVER_MANAGER, <ServerManager lang={lang} />);
      case ViewType.SETTINGS:
        return wrapWithAuthGuard(ViewType.SETTINGS, <Settings lang={lang} />);
      case ViewType.DATABASE_MANAGER:
        return wrapWithAuthGuard(ViewType.DATABASE_MANAGER, <DatabaseManager lang={lang} />);
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
             <div className="text-6xl font-black opacity-10 mb-4">404</div>
             <p>Module Not Initialized</p>
          </div>
        );
    }
  };

  return (
    <div className={`
      flex w-screen min-h-screen overflow-x-hidden font-sans transition-colors duration-500
      ${theme === 'dark' 
        ? 'bg-slate-900 text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200' 
        : 'bg-slate-50 text-slate-800 selection:bg-indigo-500/20 selection:text-indigo-600'}
    `}>

      {/* Global connectivity banner – fixed, non-blocking, overlays everything */}
      <OfflineBanner />

      {/* Dynamic Backgrounds */}
      {theme === 'dark' ? (
        <div className="fixed inset-0 pointer-events-none z-0">
           <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,hsla(253,16%,7%,1)_0,transparent_50%),radial-gradient(at_50%_0%,hsla(225,39%,30%,1)_0,transparent_50%),radial-gradient(at_100%_0%,hsla(339,49%,30%,1)_0,transparent_50%)]"></div>
        </div>
      ) : (
        <div className="fixed inset-0 pointer-events-none z-0">
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/50"></div>
           <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.8)_0%,_transparent_60%)]"></div>
        </div>
      )}

      {/* Main App Container - only after preferred API base URL is set */}
      {!apiReady ? (
        <div className="relative z-10 flex w-full h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading API endpoint...</p>
          </div>
        </div>
      ) : (
      <div className="relative z-10 flex w-full h-full min-w-0">
        <Sidebar activeView={activeView} onViewChange={setActiveView} lang={lang} />

        {/* Right area: offset by fixed sidebar width; only this column scrolls (header sticky, content scrolls) */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 pl-14 md:pl-16 bg-transparent relative overflow-x-hidden">
          <TopHeader
            isLoggedIn={isLoggedIn}
            onAuthClick={handleAuthAction}
          />

          {/* Global operation log — floating bottom dock (portaled to <body>,
              collapsed to a pill by default; the store keeps the last 1000
              entries). Mounted here once for the whole laravel-manager end. */}
          <GlobalLogPanel />

          {/* Scrollable view content */}
          <div className="flex-1 min-h-0 relative overflow-y-auto overflow-x-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-cyan-600/5 dark:bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />
            {renderView()}
          </div>

        </main>
      </div>
      )}

      {/* HTML Error Debug Modal */}
      <HtmlErrorModal
        isOpen={htmlError !== null}
        onClose={() => setHtmlError(null)}
        htmlContent={htmlError?.htmlContent || ''}
        url={htmlError?.url || ''}
        statusCode={htmlError?.statusCode}
      />

    </div>
  );
};

// Main App Component with the Laravel Manager state and notification providers.
const LmDashboard: React.FC = () => {
  return (
    <UnifiedAppProvider>
      <ToastProvider>
        <LmDashboardContent />
      </ToastProvider>
    </UnifiedAppProvider>
  );
};

export default LmDashboard;
