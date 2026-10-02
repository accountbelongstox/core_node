import React from 'react';
import { Check, CheckCircle2 } from 'lucide-react';
import { CUSTOM_THEMES } from '../../WfNewThemes';

const GLOW_BY_THEME: Record<string, string> = {
  cosmic: 'bg-fuchsia-500',
  aurora: 'bg-emerald-400',
  sunset: 'bg-orange-500',
};
const DEFAULT_GLOW = 'bg-indigo-400';

interface WfNewThemePickerProps {
  activeId: string;
  onSelect: (themeId: string) => void;
  /** `tile`: large tiles with glow (Settings); `compact`: bilingual-name chips (Onboarding). */
  variant?: 'tile' | 'compact';
  /** Interface language deciding which theme name the `tile` variant shows. */
  lang?: string;
}

/** The one theme selection grid. */
export const WfNewThemePicker: React.FC<WfNewThemePickerProps> = ({ activeId, onSelect, variant = 'tile', lang = 'en' }) => (
  <div className={`grid grid-cols-2 ${variant === 'tile' ? 'gap-4' : 'gap-2'}`}>
    {CUSTOM_THEMES.map((theme) => {
      const selected = activeId === theme.id;
      if (variant === 'compact') {
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelect(theme.id)}
            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              selected ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            <div>
              <span className="text-xs font-bold block">{theme.nameZh}</span>
              <span className="text-[9px] font-mono opacity-60 block">{theme.nameEn}</span>
            </div>
            {selected && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
          </button>
        );
      }
      return (
        <button
          key={theme.id}
          type="button"
          onClick={() => onSelect(theme.id)}
          className={`p-4 rounded-2xl text-left border transition-all duration-300 relative overflow-hidden cursor-pointer ${
            selected
              ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10 ring-1 ring-indigo-500/30'
              : 'border-zinc-200 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/10 bg-zinc-50 dark:bg-white/5'
          }`}
        >
          <div className={`absolute -right-2 -bottom-2 w-10 h-10 filter blur-xl rounded-full opacity-50 ${GLOW_BY_THEME[theme.id] ?? DEFAULT_GLOW}`} />
          <div className="relative z-10 flex flex-col justify-between h-full gap-4">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{lang === 'en' ? theme.nameEn : theme.nameZh}</span>
            <div className="flex items-center gap-1.5 self-end">
              {selected && (
                <span className="p-0.5 rounded-full bg-indigo-500 text-white">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </button>
      );
    })}
  </div>
);
