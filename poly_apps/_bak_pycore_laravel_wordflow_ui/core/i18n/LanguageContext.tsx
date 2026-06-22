'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translate, loadTranslation } from './translator';
import { DEFAULT_LANGUAGE, detectBrowserLanguage, SUPPORTED_LANGUAGES, Language } from './languages';

/**
 * Language Context Type
 */
interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, vars?: Record<string, any>) => string;
  supportedLanguages: Language[];
  isRTL: boolean;
}

/**
 * Language Context
 */
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Storage key for persisting language preference
 */
const STORAGE_KEY = 'app_language';

/**
 * Language Provider Props
 */
interface LanguageProviderProps {
  children: React.ReactNode;
  defaultLanguage?: string;
}

/**
 * Language Provider Component
 */
export function LanguageProvider({ children, defaultLanguage }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<string>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    }

    // Use provided default or detect browser language
    return defaultLanguage || detectBrowserLanguage();
  });

  // Check if current language is RTL
  const isRTL = SUPPORTED_LANGUAGES.find(lang => lang.code === language)?.rtl || false;

  /**
   * Change language and persist preference
   */
  const setLanguage = useCallback(async (lang: string) => {
    // Validate language
    const supported = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    if (!supported) {
      console.warn(`Language ${lang} is not supported`);
      return;
    }

    // Load translation if not already loaded
    await loadTranslation(lang);

    // Update state
    setLanguageState(lang);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
    }

    // Update document attributes
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = supported.rtl ? 'rtl' : 'ltr';
    }
  }, []);

  /**
   * Translation function with current language
   */
  const t = useCallback(
    (key: string, vars?: Record<string, any>) => {
      return translate(key, language, vars);
    },
    [language]
  );

  /**
   * Initialize language on mount
   */
  useEffect(() => {
    const supported = SUPPORTED_LANGUAGES.find(l => l.code === language);
    if (supported && typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = supported.rtl ? 'rtl' : 'ltr';
    }

    // Preload translation
    loadTranslation(language);
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isRTL
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * useTranslation Hook
 *
 * Usage:
 * const { t, language, setLanguage } = useTranslation();
 * const text = t('common.loading');
 * const greeting = t('messages.hello', { name: 'World' });
 */
export function useTranslation() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }

  return context;
}

/**
 * Language Selector Component
 */
export function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage, supportedLanguages } = useTranslation();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      className={className}
    >
      {supportedLanguages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.nativeName}
        </option>
      ))}
    </select>
  );
}
