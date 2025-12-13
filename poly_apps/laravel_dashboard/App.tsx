import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MediaBrowser from './components/views/MediaBrowser';
import CodeBrowser from './components/views/CodeBrowser';
import { UnifiedToolsPage } from './components/views/UnifiedToolsPage';
import ApiTester from './components/views/ApiTester';
import SystemInfo from './components/views/SystemInfo';
import VocabularyLearning from './components/views/VocabularyLearning';
import AITools from './components/views/AITools';
import MCPManager from './components/views/MCPManager';
import OctaneTasks from './components/views/OctaneTasks';
import ServerManager from './components/views/ServerManager';
import Settings from './components/views/Settings';
import LoginModal from './components/LoginModal';
import AuthGuard from './components/auth/AuthGuard';
import { ApiConfigProvider, useApiConfig } from './contexts/ApiConfigContext';
import { AppStateProvider, useAppState } from './contexts/AppStateContext';
import { ToastProvider } from './components/admin';
import { apiService } from './services/apiService';
import { api } from './core/api';
import { useUser } from './hooks/useUser';
import { ViewType } from './types';
import { TRANSLATIONS, APP_NAME, APP_VERSION } from './constants';
import { Power, Sun, Moon, Languages, LogIn } from "lucide-react";

const AppContent: React.FC = () => {
  const { config } = useApiConfig();
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

  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    apiService.setConfig(config.baseUrl, config.apiKey);
    api.updateBaseURL(config.baseUrl);
  }, [config]);

  useEffect(() => {
    setIsLoggedIn(userIsLoggedIn);
  }, [userIsLoggedIn, setIsLoggedIn]);

  useEffect(() => {
    console.log('[App] Mounted with activeView:', activeView);
  }, []);

  const handleAuthAction = async () => {
    if (isLoggedIn) {
      await userLogout();
      setIsLoggedIn(false);
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
  };

  const t = TRANSLATIONS[lang];

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
      case ViewType.SYSTEM_INFO:
        return <SystemInfo lang={lang} />;
      case ViewType.VOCABULARY:
        return <VocabularyLearning lang={lang} />;
      case ViewType.AI_TOOLS:
        return <AITools lang={lang} />;
      case ViewType.MCP_MANAGER:
        return <MCPManager lang={lang} />;
      case ViewType.OCTANE_TASKS:
        return <OctaneTasks lang={lang} />;
      case ViewType.SERVER_MANAGER:
        return <ServerManager lang={lang} />;
      case ViewType.SETTINGS:
        return (
          <AuthGuard
            lang={lang}
            requireAuth={true}
            fallbackMessage={t.settings?.auth_required || 'Settings page requires authentication. Please login to continue.'}
            onLoginRequest={() => setShowLoginModal(true)}
          >
            <Settings lang={lang} />
          </AuthGuard>
        );
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
      case ViewType.MEDIA_BROWSER: return t.header.titles.media;
      case ViewType.CODE_BROWSER: return t.header.titles.code;
      case ViewType.TOOLS: return t.header.titles.tools;
      case ViewType.API_TESTER: return t.header.titles.api;
      case ViewType.SYSTEM_INFO: return t.header.titles.system;
      case ViewType.VOCABULARY: return t.header.titles.vocabulary;
      case ViewType.AI_TOOLS: return t.header.titles.ai_tools;
      case ViewType.MCP_MANAGER: return t.header.titles.mcp;
      case ViewType.OCTANE_TASKS: return t.header.titles.octane;
      case ViewType.SERVER_MANAGER: return t.header.titles.server;
      case ViewType.SETTINGS: return t.header.titles.settings;
      default: return APP_NAME;
    }
  };

  return (
    <div className={`
      flex w-screen h-screen overflow-hidden font-sans transition-colors duration-500
      ${theme === 'dark' 
        ? 'bg-slate-900 text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200' 
        : 'bg-slate-50 text-slate-800 selection:bg-indigo-500/20 selection:text-indigo-600'}
    `}>
      
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

      {/* Main App Container */}
      <div className="relative z-10 flex w-full h-full">
        <Sidebar activeView={activeView} onViewChange={setActiveView} lang={lang} />
        
        <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
          {/* Top Header */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md z-40 transition-colors duration-300">
             <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
                   {getPageTitle()}
                </h1>
                <span className="hidden md:inline-block px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                  {APP_NAME} {APP_VERSION}
                </span>
             </div>

             <div className="flex items-center gap-4 md:gap-6 text-xs font-medium">
                {/* System Status */}
                <div className="hidden md:flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] ${isLoggedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span className={isLoggedIn ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-500'}>
                      {isLoggedIn ? t.header.system_online : t.header.system_offline}
                    </span>
                </div>

                <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 hidden md:block"></div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    {/* Language Switcher */}
                    <button 
                      onClick={toggleLang}
                      className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                      title="Switch Language"
                    >
                      <Languages size={18} />
                    </button>

                    {/* Theme Switcher */}
                    <button 
                      onClick={toggleTheme}
                      className="p-2 rounded-lg text-slate-500 hover:text-amber-500 dark:hover:text-yellow-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                      title="Toggle Theme"
                    >
                      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>

                <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10"></div>

                {/* User Info / Auth */}
                <div className="flex items-center gap-4">
                    {isLoggedIn && (
                      <div className="hidden lg:flex items-center gap-2 text-slate-500 dark:text-slate-400">
                          <span>{t.header.logged_in_as}</span>
                          <span className="text-slate-800 dark:text-white font-bold">adminroot</span>
                      </div>
                    )}
                    
                    <button 
                      onClick={handleAuthAction}
                      className={`
                        px-4 py-2 rounded-lg transition-all flex items-center gap-2 border font-semibold
                        ${isLoggedIn 
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-500 border-red-500/20' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-lg shadow-indigo-500/20'}
                      `}
                    >
                        {isLoggedIn ? (
                          <>
                            <Power size={14} /> <span className="hidden sm:inline">{t.header.logout}</span>
                          </>
                        ) : (
                          <>
                            <LogIn size={14} /> <span>{t.header.login}</span>
                          </>
                        )}
                    </button>
                </div>
             </div>
          </header>

          {/* View Content */}
          <div className="flex-1 relative overflow-hidden">
               {/* Background Effects for Main Content Area */}
               <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>
               <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-cyan-600/5 dark:bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none mix-blend-screen"></div>
               
               {renderView()}
          </div>
        </main>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        lang={lang}
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