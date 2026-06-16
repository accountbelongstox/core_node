/**
 * Unified shell — cross-end state + theme application (Nexus / Pycore / Iris).
 *
 * Single source of truth for: which end is active (derived from the route),
 * the effective theme (per-end auto + optional user override), global dark mode,
 * global language, and the AI ChatKit panel. Theme + dark are applied to <html>
 * via data-theme / .dark so every end's CSS resolves from one place.
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import i18n from '../core/i18n';
import { EndId, ThemeId, END_THEME, ShellContextValue } from './shellTypes';

const LS_DARK = 'shell_dark';
const LS_LANG = 'shell_lang';
const LS_THEME_OVERRIDE = 'shell_theme_override';

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

function endFromPath(pathname: string): EndId {
  if (pathname.startsWith('/laravel-manager')) return 'laravel-manager';
  if (pathname.startsWith('/pycore-manager')) return 'pycore-manager';
  if (pathname.startsWith('/wordflow') || pathname.startsWith('/wordnew')) return 'wordflow';
  return 'home';
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within <ShellProvider>');
  return ctx;
}

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const end = endFromPath(location.pathname);

  const [dark, setDarkState] = useState<boolean>(() => {
    const stored = safeGet(LS_DARK);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;
  });

  const [lang, setLangState] = useState<string>(() => {
    const stored = safeGet(LS_LANG);
    return stored ? stored : 'en';
  });

  const [themeOverride, setThemeOverrideState] = useState<ThemeId | null>(() => {
    const stored = safeGet(LS_THEME_OVERRIDE);
    if (stored === 'nexus' || stored === 'pycore' || stored === 'iris') return stored;
    return null;
  });

  const [chatOpen, setChatOpen] = useState(false);
  const [activeChatAdapterId, setActiveChatAdapterId] = useState<string>('pycore');

  const themeId: ThemeId = themeOverride ? themeOverride : END_THEME[end];

  // Apply theme + dark to <html> so all ends' CSS variables resolve consistently.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [themeId, dark]);

  // Keep i18next in lock-step with the shell language.
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
  }, [lang]);

  const setDark = useCallback((v: boolean) => {
    setDarkState(v);
    safeSet(LS_DARK, v ? '1' : '0');
  }, []);
  const toggleDark = useCallback(() => setDark(!dark), [dark, setDark]);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    safeSet(LS_LANG, code);
  }, []);

  const setThemeOverride = useCallback((t: ThemeId | null) => {
    setThemeOverrideState(t);
    if (t) safeSet(LS_THEME_OVERRIDE, t);
    else safeRemove(LS_THEME_OVERRIDE);
  }, []);

  const openChat = useCallback((adapterId?: string) => {
    if (adapterId) setActiveChatAdapterId(adapterId);
    setChatOpen(true);
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const value = useMemo<ShellContextValue>(() => ({
    end, themeId, themeOverride, setThemeOverride,
    dark, toggleDark, setDark,
    lang, setLang,
    chatOpen, activeChatAdapterId, openChat, closeChat,
  }), [end, themeId, themeOverride, setThemeOverride, dark, toggleDark, setDark, lang, setLang, chatOpen, activeChatAdapterId, openChat, closeChat]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
};
