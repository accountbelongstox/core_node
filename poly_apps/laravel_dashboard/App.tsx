import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import MediaBrowser from './components/views/MediaBrowser';
import CodeBrowser from './components/views/CodeBrowser';
import { UnifiedToolsPage } from './components/views/UnifiedToolsPage';
import ApiTester from './components/views/ApiTester';
import VocabularyLearning from './components/views/VocabularyLearning';
import AITools from './components/views/AITools';
import MCPManager from './components/views/MCPManager';
import OctaneTasks from './components/views/OctaneTasks';
import ServerManager from './components/views/ServerManager';
import DatabaseViewer from './components/views/DatabaseViewer';
import Settings from './components/views/Settings';
import BankManager from './components/views/BankManager';
import LoginModal from './components/LoginModal';
import AuthGuard from './components/auth/AuthGuard';
import { HtmlErrorModal } from './components/HtmlErrorModal';
import { ApiConfigProvider } from './contexts/ApiConfigContext';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
import { ToastProvider, InviteCodeManager } from './components/admin';
import { api } from './core/api';
import { useUser } from './hooks/useUser';
import { ViewType } from './types';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from './constants';
import { getRequireLoginMessage, isRequireLoginView } from './config/auth';
import i18n from './core/i18n';
import { htmlErrorManager, HtmlErrorEvent } from './services/HtmlErrorManager';
import { apiManager } from './services/ApiManager';
import { OfflineBanner } from './components/shared';

/**
 * AppContent – main layout and view routing.
 *
 * PROTECTED PAGES (require login; see config/auth.ts): Server Manager, Settings, Invite Code Manager, Database Viewer.
 * When user opens any of these without being logged in, AuthGuard calls onLoginRequest() and the login modal
 * opens immediately. After login, the page content is shown. Set window.DISABLE_AUTH = true only to bypass auth (e.g. testing).
 */
const AppContent: React.FC = () => {
  const {
    activeView,
    setActiveView,
    lang,
    toggleLang,
    theme,
    toggleTheme,
    isLoggedIn,
    setIsLoggedIn
  } = useAppState();
  const { isLoggedIn: userIsLoggedIn, logout: userLogout, user } = useUser();
  const { t } = useTranslation();

  const [showLoginModal, setShowLoginModal] = useState(false);
  /** True when modal was opened by AuthGuard (protected page); modal then uses full-block overlay and no close on backdrop. */
  const [loginModalFromProtectedView, setLoginModalFromProtectedView] = useState(false);
  const [htmlError, setHtmlError] = useState<HtmlErrorEvent | null>(null);
  const [apiReady, setApiReady] = useState(false);

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

    // Step 2 (background, does NOT gate paint): the single PARALLEL
    // all-endpoints probe runs exactly once (single-flight + StrictMode-safe
    // via the manager's shared healthPassPromise, no timers, no retries).
    // When it settles, "以能使用的为准": if the synchronously-chosen endpoint
    // is unreachable, the manager auto-fails-over to a healthy one (same
    // precedence, store write-back, api_user_modified never clobbered). If the
    // live endpoint changed we re-point `api`; either way we notify the
    // switcher (read-only — it does NOT re-probe).
    let cancelled = false;
    const refineApiHealth = async () => {
      const chosen = await apiManager.runBackgroundHealthPass(1000);
      if (cancelled) return;

      if (chosen) {
        const baseUrl = apiManager.getCurrentBaseUrl();
        if (!preselected || chosen.id !== preselected.id) {
          api.updateBaseURL(baseUrl);
          console.log('[ApiManager] Auto-failover to:', baseUrl);
        }
      }

      // Health results for ALL endpoints are populated now; let the switcher
      // render its dots and reflect any failover.
      window.dispatchEvent(new CustomEvent('api-health-initialized'));
    };

    refineApiHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setIsLoggedIn(userIsLoggedIn);
  }, [userIsLoggedIn, setIsLoggedIn]);

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  // Listen for HTML error events
  useEffect(() => {
    const unsubscribe = htmlErrorManager.addListener((event) => {
      setHtmlError(event);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    console.log('[App] Mounted with activeView:', activeView);
  }, []);

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      await userLogout();
      setIsLoggedIn(false);
    } else {
      setLoginModalFromProtectedView(false);
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setLoginModalFromProtectedView(false);
    setShowLoginModal(false);
  };

  const handleCloseLoginModal = () => {
    setLoginModalFromProtectedView(false);
    setShowLoginModal(false);
  };

  // Auth is required by default for protected views. Set window.DISABLE_AUTH = true only to skip login (e.g. local testing).
  const disableAuth = (window as any).DISABLE_AUTH === true;

  /** Wraps content with AuthGuard when this view requires login and auth is enabled. Reused for all protected views. */
  const wrapWithAuthGuard = (viewType: ViewType, content: React.ReactNode) => {
    if (disableAuth || !isRequireLoginView(viewType)) {
      return content;
    }
    return (
      <AuthGuard
        lang={lang}
        requireAuth={true}
        fallbackMessage={getRequireLoginMessage(viewType, lang)}
        onLoginRequest={() => {
          setLoginModalFromProtectedView(true);
          setShowLoginModal(true);
        }}
      >
        {content}
      </AuthGuard>
    );
  };

  const inviteCodesTitle = t('header.titles.invite_codes');

  const renderView = () => {
    switch (activeView) {
      case ViewType.MEDIA_BROWSER:
        return <MediaBrowser />;
      case ViewType.CODE_BROWSER:
        return <CodeBrowser />;
      case ViewType.TOOLS:
        return <UnifiedToolsPage lang={lang} />;
      case ViewType.API_TESTER:
        return <ApiTester />;
      case ViewType.VOCABULARY:
        return <VocabularyLearning />;
      case ViewType.AI_TOOLS:
        return <AITools />;
      case ViewType.MCP_MANAGER:
        return <MCPManager lang={lang} />;
      case ViewType.OCTANE_TASKS:
        return <OctaneTasks lang={lang} />;
      case ViewType.SERVER_MANAGER:
        return wrapWithAuthGuard(ViewType.SERVER_MANAGER, <ServerManager lang={lang} />);
      case ViewType.SETTINGS:
        return wrapWithAuthGuard(ViewType.SETTINGS, <Settings lang={lang} />);
      case ViewType.INVITE_CODE_MANAGER:
        return wrapWithAuthGuard(ViewType.INVITE_CODE_MANAGER, <InviteCodeManager lang={lang} />);
      case ViewType.BANK_MANAGER:
        return <BankManager lang={lang} />;
      case ViewType.DATABASE_VIEWER:
        return wrapWithAuthGuard(ViewType.DATABASE_VIEWER, <DatabaseViewer lang={lang} />);
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
             <div className="text-6xl font-black opacity-10 mb-4">404</div>
             <p>Module Not Initialized</p>
          </div>
        );
    }
  };

  const getPageTitle = () => {
    switch (activeView) {
      case ViewType.MEDIA_BROWSER: return t('header.titles.media');
      case ViewType.CODE_BROWSER: return t('header.titles.code');
      case ViewType.TOOLS: return t('header.titles.tools');
      case ViewType.API_TESTER: return t('header.titles.api');
      case ViewType.VOCABULARY: return t('header.titles.vocabulary');
      case ViewType.AI_TOOLS: return t('header.titles.ai_tools');
      case ViewType.MCP_MANAGER: return t('header.titles.mcp');
      case ViewType.OCTANE_TASKS: return t('header.titles.octane');
      case ViewType.SERVER_MANAGER: return t('header.titles.server');
      case ViewType.INVITE_CODE_MANAGER: return inviteCodesTitle;
      case ViewType.BANK_MANAGER: return t('header.titles.bank_manager');
      case ViewType.DATABASE_VIEWER: return t('header.titles.db_viewer');
      case ViewType.SETTINGS: return t('header.titles.settings');
      default: return APP_NAME;
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
            pageTitle={getPageTitle()}
            isLoggedIn={isLoggedIn}
            onAuthClick={handleAuthAction}
          />

          {/* Scrollable view content */}
          <div className="flex-1 min-h-0 relative overflow-y-auto overflow-x-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-cyan-600/5 dark:bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen" />
            {renderView()}
          </div>

          {/* Login modal: only over the right (main) area, not full screen; sidebar stays visible and clickable. */}
          {showLoginModal && (
            <div className="absolute inset-0 z-50">
              <LoginModal
                isOpen={true}
                onClose={handleCloseLoginModal}
                onSuccess={handleLoginSuccess}
                lang={lang}
                blockCloseBackdrop={loginModalFromProtectedView}
                contained
              />
            </div>
          )}
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

// Main App Component with AppStateProvider, ApiConfigProvider and ToastProvider
const App: React.FC = () => {
  return (
    <AppStateProvider>
      <ApiConfigProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </ApiConfigProvider>
    </AppStateProvider>
  );
};

export default App;