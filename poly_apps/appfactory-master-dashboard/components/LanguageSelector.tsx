import React, { useState, useCallback } from 'react';
import { Globe, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../services/i18nService';
import { useClickOutside } from '../hooks/useClickOutside';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  
  // Use React Hook for click outside detection instead of manual addEventListener
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false));

  // Use React's useCallback for event handlers
  const handleLanguageChange = useCallback((lang: SupportedLanguage) => {
    setLanguage(lang);
    setIsOpen(false);
  }, [setLanguage]);

  const currentLanguageName = SUPPORTED_LANGUAGES[language];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
        aria-label={t('common.selectLanguage')}
      >
        <Globe size={18} />
        <span className="text-sm font-medium hidden sm:inline">{currentLanguageName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code as SupportedLanguage)}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                language === code
                  ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <span>{name}</span>
              {language === code && <Check size={16} className="text-indigo-600 dark:text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};