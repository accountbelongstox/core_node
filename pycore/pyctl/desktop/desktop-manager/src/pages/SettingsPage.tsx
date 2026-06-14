import { useEffect, useState } from 'react';
import { Moon, Sun, Cloud, CloudOff, Power, RefreshCw } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { useLive } from '../state/LiveContext';
import { ACCENT_LIST } from '../lib/accent';
import { pycoreApi } from '../api/pycore';
import type { Language, AutostartStatus } from '../types';

export default function SettingsPage() {
  const { settings, updateSettings, toggleTheme, setLang, t, toast } = useApp();
  const { wsConnected } = useLive();
  const langs: { id: Language; label: string }[] = [
    { id: 'en', label: 'English' }, { id: 'zh', label: '中文' }, { id: 'ja', label: '日本語' },
  ];

  // --- auto-start on boot (native OS startup entry) ---------------------- #
  const [autostart, setAutostart] = useState<AutostartStatus | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);

  useEffect(() => {
    pycoreApi.getAutostart().then(setAutostart).catch(() => { /* offline */ });
  }, []);

  const toggleAutostart = async (enabled: boolean) => {
    setAutostartBusy(true);
    try {
      const r = await pycoreApi.setAutostart(enabled);
      const s = await pycoreApi.getAutostart();
      setAutostart(s);
      if (r?.success === false) toast(r.message || 'Failed to update auto-start', 'error');
      else toast(enabled ? t.autoStartEnabled : t.autoStartDisabled, 'success');
    } catch (e: any) {
      toast('Request failed: ' + e.message, 'error');
    } finally { setAutostartBusy(false); }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">Fine-tune glassmorphic blur styles, theme presets, and languages.</p>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
          wsConnected ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'}`}
          title={t.syncedToBackend}>
          {wsConnected ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
          {t.syncedToBackend}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Backdrop Glass Options</h3>
          <div>
            <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
              <span>{t.backdropOpacity}</span><span className="font-mono font-bold text-sky-500">{settings.glassOpacity}%</span>
            </label>
            <input type="range" min={5} max={85} value={settings.glassOpacity}
              onChange={(e) => updateSettings({ glassOpacity: parseInt(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer" />
          </div>
          <div>
            <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
              <span>{t.backdropBlur}</span><span className="font-mono font-bold text-sky-500">{settings.blurStrength}px</span>
            </label>
            <input type="range" min={0} max={32} value={settings.blurStrength}
              onChange={(e) => updateSettings({ blurStrength: parseInt(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer" />
          </div>

          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider pt-2">{t.langSelect}</h3>
          <div className="flex gap-2">
            {langs.map((l) => (
              <button key={l.id} onClick={() => setLang(l.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  settings.lang === l.id ? 'bg-sky-500 text-white' : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Accent Theme</h3>
          <div>
            <span className="block text-xs text-slate-600 dark:text-slate-400 mb-2">{t.accentSelect}</span>
            <div className="flex flex-wrap gap-2">
              {ACCENT_LIST.map((accent) => (
                <button key={accent} onClick={() => { updateSettings({ accentColor: accent }); toast(`Accent: ${accent}`, 'success'); }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase tracking-tight transition ${
                    settings.accentColor === accent ? 'bg-sky-500 text-white font-extrabold scale-105 shadow shadow-sky-500/20'
                      : 'bg-slate-200/50 dark:bg-white/5 text-slate-500 hover:text-slate-300'}`}>
                  {accent}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs text-slate-600 dark:text-slate-400 mb-2">{t.themeSelect}</span>
            <div className="flex gap-2">
              <button onClick={() => toggleTheme('dark')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex-1 flex items-center justify-center gap-1.5 ${
                  settings.theme === 'dark' ? 'bg-sky-500 text-white shadow shadow-sky-500/10' : 'bg-slate-200/50 dark:bg-white/5 text-slate-500'}`}>
                <Moon className="w-3.5 h-3.5" /> Dark
              </button>
              <button onClick={() => toggleTheme('light')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex-1 flex items-center justify-center gap-1.5 ${
                  settings.theme === 'light' ? 'bg-sky-500 text-white shadow shadow-sky-500/10' : 'bg-slate-200/50 dark:bg-white/5 text-slate-400'}`}>
                <Sun className="w-3.5 h-3.5" /> Light
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System: auto-start on boot (native OS startup entry) */}
      <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-white/10">
        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">{t.systemSection}</h3>
        <div className="flex items-center justify-between gap-4 rounded-2xl p-4 bg-slate-100/60 dark:bg-white/5 border border-slate-300/35 dark:border-white/5">
          <div className="flex items-start gap-3">
            <Power className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">{t.autoStart}</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {autostart && autostart.supported === false ? t.autoStartUnsupported : t.autoStartHint}
              </p>
              {autostart?.location && (
                <p className="text-[10px] font-mono text-slate-400 mt-1 break-all">
                  {autostart.scope === 'current-user' ? t.autoStartScopeUser : t.autoStartScopeAll}: {autostart.location}
                </p>
              )}
            </div>
          </div>
          <button
            role="switch"
            aria-checked={!!autostart?.enabled}
            disabled={autostartBusy || (autostart?.supported === false)}
            onClick={() => toggleAutostart(!autostart?.enabled)}
            className={`relative w-11 h-6 rounded-full transition shrink-0 disabled:opacity-50 ${
              autostart?.enabled ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
            {autostartBusy ? (
              <RefreshCw className="w-3 h-3 animate-spin text-white absolute top-1.5 left-1.5" />
            ) : (
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                autostart?.enabled ? 'left-[22px]' : 'left-0.5'}`} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
