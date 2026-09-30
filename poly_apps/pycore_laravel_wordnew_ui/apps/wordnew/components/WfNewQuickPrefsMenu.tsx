import React, { useState } from 'react';
import { Check, Moon, Sun } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { getLanguageConfig, getSupportedLanguages } from '../WfNewLocales';
import { WfNewHeaderPopover } from './WfNewHeaderPopover';

/** Header quick menu: light/dark and interface language, applied on click. */
interface WfNewQuickPrefsMenuProps {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

export const WfNewQuickPrefsMenu: React.FC<WfNewQuickPrefsMenuProps> = ({ trans }) => {
  const { lang, setLang, dark, toggleDark } = useShell();
  const [open, setOpen] = useState(false);
  const current = getLanguageConfig(lang);

  const modes = [
    { dark: false, icon: Sun, label: trans('set.modeLight') },
    { dark: true, icon: Moon, label: trans('set.modeDark') },
  ];

  return (
    <WfNewHeaderPopover
      open={open}
      onOpenChange={setOpen}
      widthClass="w-64"
      trigger={(toggle) => (
        <button
          onClick={toggle}
          className={`flex items-center gap-1 h-10 pl-2.5 pr-2 rounded-full border bg-slate-900/5 hover:bg-slate-900/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-zinc-300 cursor-pointer ${
            open ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-slate-900/10 dark:border-white/5'
          }`}
          title={`${trans('set.appearanceMode')} · ${trans('lang.selector')}`}
          aria-label={`${trans('set.appearanceMode')} · ${trans('lang.selector')}`}
          aria-expanded={open}
        >
          {dark ? <Moon className="w-4 h-4 text-violet-300" /> : <Sun className="w-4 h-4 text-amber-400" />}
          <span className="text-sm leading-none">{current.flag}</span>
        </button>
      )}
    >
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/5 border border-white/5">
          {modes.map((mode) => {
            const active = mode.dark === dark;
            const Icon = mode.icon;
            return (
              <button
                key={mode.label}
                onClick={() => { if (!active) toggleDark(); }}
                aria-pressed={active}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  active ? 'bg-indigo-500/25 text-indigo-200' : 'text-zinc-400 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="truncate">{mode.label}</span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {getSupportedLanguages().map((cfg) => {
            const active = cfg.code === current.code;
            return (
              <button
                key={cfg.code}
                onClick={() => { setLang(cfg.code); setOpen(false); }}
                aria-pressed={active}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer min-w-0 ${
                  active ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-200' : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'
                }`}
              >
                <span className="shrink-0">{cfg.flag}</span>
                <span className="truncate flex-1 text-left">{cfg.nativeName}</span>
                {active && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </WfNewHeaderPopover>
  );
};
