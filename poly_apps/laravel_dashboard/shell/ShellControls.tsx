/**
 * Floating shell control dock. Sits above every end (collapsed to a single
 * button by default) so it never clobbers an end's own chrome. Provides:
 * home, end switch, AI chat, dark toggle, language, and theme override.
 *
 * Geometry is defined in shellChrome.ts — end-local top-right chrome (e.g.
 * pycore PcTopBar) reserves shellDockRightGutterPx() to avoid overlapping
 * Apps / Home / Laravel Manager / theme / language when this panel is open.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Home, Bot, Sun, Moon, Languages, Palette, X } from 'lucide-react';
import { useShell } from './ShellContext';
import { END_META, SHELL_LANGUAGES, ThemeId } from './shellTypes';
import {
  SHELL_DOCK_INSET_PX, SHELL_DOCK_BUTTON_PX,
  SHELL_DOCK_PANEL_WIDTH_PX, SHELL_DOCK_Z_INDEX,
} from './shellChrome';

export const ShellControls: React.FC = () => {
  const navigate = useNavigate();
  const { end, dark, toggleDark, lang, setLang, themeOverride, setThemeOverride, openChat } = useShell();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="fixed flex flex-col items-end gap-2"
      style={{
        // top-3 right-3 — keep in sync with shellChrome.ts constants
        top: SHELL_DOCK_INSET_PX,
        right: SHELL_DOCK_INSET_PX,
        zIndex: SHELL_DOCK_Z_INDEX,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:scale-105 transition"
        style={{ width: SHELL_DOCK_BUTTON_PX, height: SHELL_DOCK_BUTTON_PX }}
        title="Shell controls"
      >
        {open ? <X className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
      </button>

      {open && (
        <div
          className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 shadow-2xl p-3 space-y-3 text-sm"
          style={{
            // w-60 — keep in sync with SHELL_DOCK_PANEL_WIDTH_PX
            width: SHELL_DOCK_PANEL_WIDTH_PX,
          }}
        >
          {/* Ends */}
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Apps</div>
            <button
              onClick={() => { navigate('/'); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 ${end === 'home' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}
            >
              <Home className="w-4 h-4" /> Home
            </button>
            {(Object.keys(END_META) as (keyof typeof END_META)[]).map((id) => (
              <button
                key={id}
                onClick={() => { navigate(END_META[id].path); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 ${end === id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}
              >
                <span className="w-4 h-4 rounded-full" style={{ background: 'var(--shell-accent, #6366f1)' }} />
                {END_META[id].label}
              </button>
            ))}
          </div>

          <div className="h-px bg-slate-200 dark:bg-slate-700" />

          {/* AI chat */}
          <button
            onClick={() => { openChat(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200"
          >
            <Bot className="w-4 h-4" /> AI Chat
          </button>

          {/* Dark toggle */}
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>

          {/* Language */}
          <label className="flex items-center gap-2 px-2 text-slate-700 dark:text-slate-200">
            <Languages className="w-4 h-4" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="flex-1 bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1"
            >
              {SHELL_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>

          {/* Theme override */}
          <label className="flex items-center gap-2 px-2 text-slate-700 dark:text-slate-200">
            <Palette className="w-4 h-4" />
            <select
              value={themeOverride ? themeOverride : 'auto'}
              onChange={(e) => setThemeOverride(e.target.value === 'auto' ? null : (e.target.value as ThemeId))}
              className="flex-1 bg-transparent border border-slate-300 dark:border-slate-600 rounded px-2 py-1"
            >
              <option value="auto">Auto (per app)</option>
              <option value="nexus">Nexus</option>
              <option value="pycore">Pycore</option>
              <option value="iris">Iris</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
};

export default ShellControls;
