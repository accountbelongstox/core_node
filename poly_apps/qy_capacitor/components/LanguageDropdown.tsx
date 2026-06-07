/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState, useRef, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { Icons, IconButton, Popover } from './UI';
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
  const wrapRef = useRef<HTMLDivElement>(null);

  const currentLanguage = LanguageCenter.getCurrentLanguage();
  const rawLanguages = LanguageCenter.getSupportedLanguages();
  const supportedLanguages = Array.isArray(rawLanguages) ? rawLanguages : [];
  // outside-click / Escape handled by <Popover>

  const handleSelect = (lang: SupportedLanguage) => {
    // Apply reactively — NO window.location.reload(). LanguageCenter.setLanguage
    // notifies subscribers (AppContext bumps languageVersion → whole tree
    // re-renders with the new strings). A full reload blanked the webview and
    // forced a re-init/auth-redirect cycle (black-screen crash + route bounce).
    LanguageCenter.setLanguage(lang);
    updateSettings({ language: { ...settings.language, appInterface: lang } });
    StateManager.set(GlobalState.LANGUAGE, lang);
    api.setLanguage(lang);
    setIsOpen(false);
  };

  const isMinimal = variant === 'minimal';
  const useGlass = !scrolled && !isMinimal;

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <IconButton
        icon={<Icons.Globe />}
        onClick={() => setIsOpen(!isOpen)}
        label={t('header.changeLanguage')}
        active={isOpen}
        className={useGlass ? 'ds-glass ds-glass-edge border border-[var(--border-highlight)] shadow-sm' : ''}
      />

      <Popover open={isOpen} onClose={() => setIsOpen(false)} anchorRef={wrapRef} align="end" className="w-[min(15rem,calc(100vw-2rem))]">
          <div className="p-3 flex flex-col gap-2" role="listbox">
            {supportedLanguages.map((lang) => {
              const isActive = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handleSelect(lang.code)}
                  className={`ds-pill-chip ds-touch-target !justify-start !rounded-[var(--radius-button)] w-full text-left ${isActive ? 'is-active' : ''}`}
                >
                  <span className="text-xl flex-shrink-0">{lang.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{lang.nativeName}</div>
                    <div className={`text-xs truncate ${isActive ? 'opacity-80' : 'text-[var(--color-text-tertiary)]'}`}>{lang.name}</div>
                  </div>
                  {isActive && <Icons.Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
      </Popover>
    </div>
  );
};

export default LanguageDropdown;
