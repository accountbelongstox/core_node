import { Cpu, Captions, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useLive } from '../state/LiveContext';
import type { Language } from '../types';

export default function Header() {
  const { settings, t, activeTab, setActiveTab, setLang, toggleTheme } = useApp();
  // Single source of truth for "connected": the live rpc_v2 WebSocket (same one the
  // live-log panel uses), so the header status and the log panel never disagree.
  const { wsConnected } = useLive();
  const langs: Language[] = ['en', 'zh', 'ja'];
  const langLabel: Record<Language, string> = { en: 'EN', zh: '中文', ja: '日本語' };

  return (
    <header className={`h-16 flex items-center justify-between px-6 border-b transition-colors z-30 backdrop-blur-md sticky top-0 ${
      settings.theme === 'dark' ? 'border-white/5 bg-slate-950/40' : 'border-slate-200/50 bg-white/40'}`}>
      <div className="flex items-center gap-8">
        <div className="text-xl font-black tracking-tight flex items-center gap-2">
          <span className="p-1 rounded-lg bg-linear-to-tr from-sky-500 to-sky-600 text-white block"><Cpu className="w-5 h-5" /></span>
          <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent select-none font-bold">
            {t.title}
            <span className="text-[10px] uppercase font-mono tracking-wider opacity-70 px-1.5 py-0.5 rounded bg-slate-500/10 ml-1">v4.0</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button onClick={() => setActiveTab('subtitle')}
            className={`flex items-center gap-1.5 px-1 py-1 hover:text-sky-400 transition cursor-pointer ${activeTab === 'subtitle' ? 'text-sky-400 font-semibold' : 'text-slate-400'}`}>
            <Captions className="w-4 h-4" /> {t.subtitleMode}
          </button>
          <button onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-1 py-1 hover:text-sky-400 transition cursor-pointer ${activeTab === 'settings' ? 'text-sky-400 font-semibold' : 'text-slate-400'}`}>
            <SettingsIcon className="w-4 h-4" /> {t.settings}
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full relative flex">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wsConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
            <span className={wsConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {wsConnected ? t.connected : t.disconnected}
            </span>
          </div>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-full bg-slate-300/20 dark:bg-slate-800/40 p-0.5 border border-slate-300/30 dark:border-slate-800/30">
          {langs.map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${settings.lang === l ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
              {langLabel[l]}
            </button>
          ))}
        </div>
        <button onClick={() => toggleTheme(settings.theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl transition hover:bg-slate-300/30 dark:hover:bg-slate-800/30 border border-slate-300/20 dark:border-slate-800/25 bg-slate-200/50 dark:bg-slate-900/50"
          title="Toggle theme">
          {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
        </button>
      </div>
    </header>
  );
}
