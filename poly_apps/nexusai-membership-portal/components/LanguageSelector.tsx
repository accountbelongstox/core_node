import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../App';
import { Language } from '../types';

const LanguageSelector: React.FC<{ className?: string; variant?: 'default' | 'compact' }> = ({ 
  className = '', 
  variant = 'default' 
}) => {
  const { lang, setLang, t } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: t.langEn },
    { code: 'zh', label: t.langZh },
    { code: 'ja', label: t.langJa },
    { code: 'ko', label: t.langKo },
  ];

  const currentLanguage = languages.find(l => l.code === lang) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (languageCode: Language) => {
    setLang(languageCode);
    setIsOpen(false);
  };

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] font-black uppercase tracking-[0.3em] px-7 py-4 rounded-[1.5rem] bg-slate-500/5 hover:bg-blue-600/15 transition-all shadow-lg"
          title={t.switchLanguage}
        >
          {currentLanguage.label}
        </button>
        
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-40 glass rounded-[1.5rem] border dark:border-white/10 border-slate-200 shadow-2xl overflow-hidden z-50">
            {languages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleSelect(language.code)}
                className={`w-full text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
                  lang === language.code
                    ? 'bg-blue-600 text-white'
                    : 'dark:text-slate-400 text-slate-600 hover:bg-blue-600/10 hover:text-blue-500'
                }`}
              >
                {language.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-black uppercase tracking-wider px-5 py-3 rounded-[1.5rem] bg-slate-500/5 hover:bg-blue-600/15 transition-all shadow-lg flex items-center gap-2"
        title={t.switchLanguage}
      >
        <span>{currentLanguage.label}</span>
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-40 glass rounded-[1.5rem] border dark:border-white/10 border-slate-200 shadow-2xl overflow-hidden z-50">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleSelect(language.code)}
              className={`w-full text-left px-6 py-4 text-xs font-black uppercase tracking-wider transition-all ${
                lang === language.code
                  ? 'bg-blue-600 text-white'
                  : 'dark:text-slate-400 text-slate-600 hover:bg-blue-600/10 hover:text-blue-500'
              }`}
            >
              {language.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;

