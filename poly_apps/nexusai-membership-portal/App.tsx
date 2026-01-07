
import React, { useState, createContext, useContext, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { translations } from './i18n';
import { Language, Theme } from './types';
import { ToastProvider, useToast } from './utils/toast';
import { ErrorHandler } from './utils/errorHandler';
import { stateCenter, type AppState } from './services/state';
import LoginPage from './pages/LoginPage';
import Layout from './pages/Layout';
import PublicLayout from './pages/PublicLayout';
import DashboardPage from './pages/DashboardPage';
import MembershipPage from './pages/MembershipPage';
import KeysPage from './pages/KeysPage';
import DocsPage from './pages/DocsPage';
import SettingsPage from './pages/SettingsPage';
import SubscribeCenterPage from './pages/SubscribeCenterPage';
import ModelPricingPage from './pages/ModelPricingPage';
import AvailabilityStatusPage from './pages/AvailabilityStatusPage';

const AppContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  user: any;
  setUser: (u: any) => void;
  t: any;
  state: AppState;
  stateCenter: typeof stateCenter;
} | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("AppContext missing");
  return context;
};


// Internal component: Initialize error handler
const AppContent: React.FC = () => {
  const toast = useToast();

  useEffect(() => {
    // Initialize Toast reference for error handler
    ErrorHandler.setToast(toast);
  }, [toast]);

  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [user, setUser] = useState<any>(null);
  const [appState, setAppState] = useState<AppState>(stateCenter.getState());
  
  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = stateCenter.subscribe((state) => {
      setAppState(state);
    });
    
    // Load initial availability data
    stateCenter.refreshAvailability();
    
    return unsubscribe;
  }, []);
  
  useEffect(() => {
    document.documentElement.className = theme;
    document.documentElement.lang = lang;
    // Update page title based on language
    if (translations[lang]?.pageTitle) {
      document.title = translations[lang].pageTitle;
    }
    // Update error handler language
    ErrorHandler.setLanguage(lang);
  }, [theme, lang]);

  const t = translations[lang];

  return (
    <AppContext.Provider value={{ 
      lang, 
      setLang, 
      theme, 
      setTheme, 
      user, 
      setUser, 
      t,
      state: appState,
      stateCenter,
    }}>
      <HashRouter>
        <Routes>
          {/* Public routes (no login required) */}
          <Route path="/subscribe" element={
            <PublicLayout>
              <SubscribeCenterPage />
            </PublicLayout>
          } />
          <Route path="/pricing" element={
            <PublicLayout>
              <ModelPricingPage />
            </PublicLayout>
          } />
          <Route path="/docs" element={
            <PublicLayout>
              <DocsPage />
            </PublicLayout>
          } />
          <Route path="/status" element={
            <PublicLayout>
              <AvailabilityStatusPage />
            </PublicLayout>
          } />
          
          {!user ? (
            /* Login page when not authenticated */
            <Route path="/" element={<LoginPage />} />
          ) : (
            /* Protected routes (login required) */
            <Route path="/*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/membership" element={<MembershipPage />} />
                  <Route path="/keys" element={<KeysPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            } />
          )}
        </Routes>
      </HashRouter>
    </AppContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider position="top-right" maxToasts={5}>
      <AppContent />
    </ToastProvider>
  );
};

export default App;
