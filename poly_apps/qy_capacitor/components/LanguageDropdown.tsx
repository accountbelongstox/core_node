import React, { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Icons } from './UI';
import { LanguageCenter, SupportedLanguage } from '../i18n/LanguageCenter';
import { StateManager, GlobalState } from '../services/StateManager';
import { api } from '../services/api';

export const LanguageDropdown: React.FC<{
  className?: string;
  variant?: 'bar' | 'minimal';
  scrolled?: boolean;
}> = ({ className = '', variant = 'bar', scrolled = false }) => {
  const { t, updateSettings, settings } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLanguage = LanguageCenter.getCurrentLanguage();
  const supportedLanguages = LanguageCenter.getSupportedLanguages();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (lang: SupportedLanguage) => {
    updateSettings({ language: { ...settings.language, appInterface: lang } });
    LanguageCenter.setLanguage(lang);
    StateManager.set(GlobalState.LANGUAGE, lang);
    api.setLanguage(lang);
    setIsOpen(false);
    window.location.reload();
  };

  const useGlass = !scrolled && variant !== 'minimal';
  const isMinimal = variant === 'minimal';

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('header.changeLanguage')}
        title={t('header.changeLanguage')}
        className={`
          ds-touch-target flex items-center justify-center rounded-full transition-all duration-300
          ${useGlass ? 'ds-glass ds-glass-edge border border-white/40 dark:border-white/10 shadow-sm text-slate-600 dark:text-slate-300' : ''}
          ${scrolled && !isMinimal ? 'bg-transparent text-slate-500' : ''}
          ${isMinimal ? 'ds-glass ds-glass-edge text-slate-600 dark:text-slate-300' : ''}
          hover:opacity-90 active:scale-95
        `}
      >
        <Icons.Globe />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-48 ds-glass ds-material-thick rounded-xl border border-white/20 dark:border-white/10 overflow-hidden z-50 animate-slide-down"
          role="listbox"
        >
          <div className="p-2">
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`
                  w-full px-4 py-3 rounded-lg text-left transition-all flex items-center gap-3 ds-touch-target min-h-[44px]
                  ${currentLanguage === lang.code
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'}
                `}
              >
                <span className="text-xl">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{lang.nativeName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{lang.name}</div>
                </div>
                {currentLanguage === lang.code && <Icons.Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageDropdown;
