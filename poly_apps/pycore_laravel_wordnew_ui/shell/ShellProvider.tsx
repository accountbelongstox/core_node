/**
 * Unified shell state owner for all application ends.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import i18n from '../core/i18n/UiI18n';
import { setPycoreActive } from '../core/integrations/pycore/PycoreHttp';
import { StorageManager } from '../core/persistence';
import { ShellContext } from './ShellContext';
import { ShellStorageKeys as StorageKeys } from './ShellStorageKeys';
import { EndId, END_THEME, END_USES_PYCORE, SHELL_LANGUAGES, ShellContextValue, ThemeId } from './shellTypes';

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = new Set(SHELL_LANGUAGES.map((language) => language.code));

function normalizeLanguage(value: string | null): string | null {
  const code = value?.trim().toLowerCase().split(/[-_]/, 1)[0] || '';
  return SUPPORTED_LANGUAGES.has(code) ? code : null;
}

function readLanguageFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?')) : '';
  return normalizeLanguage(
    new URLSearchParams(window.location.search).get('lang')
      || new URLSearchParams(hashQuery).get('lang'),
  );
}

function endFromPath(pathname: string): EndId {
  if (pathname.startsWith('/laravel-manager')) return 'laravel-manager';
  if (pathname.startsWith('/pycore-manager')) return 'pycore-manager';
  if (pathname.startsWith('/wordnew')) return 'wordnew';
  if (pathname.startsWith('/vortex')) return 'vortex';
  if (pathname.startsWith('/codemart')) return 'codemart';
  return 'home';
}

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const end = endFromPath(location.pathname);
  const [dark, setDarkState] = useState<boolean>(() => {
    const stored = StorageManager.getRaw(StorageKeys.DARK);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;
  });
  const [lang, setLangState] = useState<string>(() => {
    const fromUrl = readLanguageFromUrl();
    const stored = StorageManager.getRaw(StorageKeys.LANGUAGE);
    return fromUrl || normalizeLanguage(stored) || DEFAULT_LANGUAGE;
  });
  const [themeOverride, setThemeOverrideState] = useState<ThemeId | null>(() => {
    const stored = StorageManager.getRaw(StorageKeys.THEME_OVERRIDE);
    if (stored === 'nexus' || stored === 'pycore' || stored === 'iris') return stored;
    return null;
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatAdapterId, setActiveChatAdapterId] = useState<string>('pycore');
  const themeId: ThemeId = themeOverride ? themeOverride : END_THEME[end];
  const setLang = useCallback((code: string) => {
    const normalized = normalizeLanguage(code);
    if (!normalized) return;
    setLangState(normalized);
    StorageManager.setRaw(StorageKeys.LANGUAGE, normalized);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [themeId, dark]);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (i18n.language !== lang) void i18n.changeLanguage(lang);
  }, [lang]);

  useEffect(() => {
    const applyLanguageFromUrl = (): void => {
      const next = readLanguageFromUrl();
      if (next) setLang(next);
    };
    window.addEventListener('popstate', applyLanguageFromUrl);
    window.addEventListener('hashchange', applyLanguageFromUrl);
    return () => {
      window.removeEventListener('popstate', applyLanguageFromUrl);
      window.removeEventListener('hashchange', applyLanguageFromUrl);
    };
  }, [setLang]);

  useEffect(() => {
    setPycoreActive(END_USES_PYCORE[end]);
  }, [end]);

  const setDark = useCallback((value: boolean) => {
    setDarkState(value);
    StorageManager.setRaw(StorageKeys.DARK, value ? '1' : '0');
  }, []);
  const toggleDark = useCallback(() => setDark(!dark), [dark, setDark]);
  const setThemeOverride = useCallback((value: ThemeId | null) => {
    setThemeOverrideState(value);
    if (value) StorageManager.setRaw(StorageKeys.THEME_OVERRIDE, value);
    else StorageManager.remove(StorageKeys.THEME_OVERRIDE);
  }, []);
  const openChat = useCallback((adapterId?: string) => {
    if (adapterId) setActiveChatAdapterId(adapterId);
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const value = useMemo<ShellContextValue>(() => ({
    end,
    themeId,
    themeOverride,
    setThemeOverride,
    dark,
    toggleDark,
    setDark,
    lang,
    setLang,
    chatOpen,
    activeChatAdapterId,
    openChat,
    closeChat,
  }), [
    end,
    themeId,
    themeOverride,
    setThemeOverride,
    dark,
    toggleDark,
    setDark,
    lang,
    setLang,
    chatOpen,
    activeChatAdapterId,
    openChat,
    closeChat,
  ]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
};

export default ShellProvider;
