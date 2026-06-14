import { useEffect } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { LiveProvider } from './state/LiveContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Toasts from './components/Toasts';
import SettingsOverlay from './components/SettingsOverlay';
import Footer from './components/Footer';
import { PAGE_MAP } from './pages/registry';
import { accentBackdrop } from './lib/accent';

function Shell() {
  const { settings, activeTab, t } = useApp();
  const ActivePage = (PAGE_MAP[activeTab] || PAGE_MAP.voice_player).Component;

  // Drive the host window title from the active language: the PySide6 webview
  // mirrors document.title onto the framework's simulated title bar (and the
  // taskbar), so switching language here also retitles the native title bar.
  useEffect(() => { document.title = t.title; }, [t.title]);

  return (
    <div className={`h-screen w-full font-sans transition-colors duration-500 overflow-hidden relative flex flex-col justify-between ${
      settings.theme === 'dark' ? 'bg-[#060608] text-slate-100' : 'bg-[#f4f7fa] text-slate-800'}`}>

      {/* dynamic gradient blur backdrop */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full filter blur-[130px] opacity-40 pointer-events-none transition-all duration-1000"
        style={{ background: accentBackdrop(settings.accentColor) }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full filter blur-[150px] opacity-30 pointer-events-none transition-all duration-1000"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)' }} />

      <Header />

      <div className="flex flex-1 overflow-hidden z-20">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto z-10">
          <ActivePage />
        </main>
      </div>

      <SettingsOverlay />
      <Toasts />
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <LiveProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </LiveProvider>
  );
}
