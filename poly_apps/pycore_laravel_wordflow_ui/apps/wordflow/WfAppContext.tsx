/* [v4.1-Iris] WfAppContext — thin wordflow app context.
 * Ported from poly_apps/qy_capacitor/contexts/AppContext.tsx, but:
 *   - theme / dark / language are owned by the shell (useShell), NOT here.
 *   - auth / user / learning-language are backed by wordflowApi + WordflowStorage.
 *   - i18n is shell-driven: t() resolves against useShell().lang via
 *     WfLanguageCenter.translate (re-renders on a shell language switch).
 * Pages consume useWfApp() (user/auth/login/logout/learning language/t).
 *
 * NOTE (HMR): the context OBJECT itself lives in ./wfAppContextCore — this
 * module mixes a component + hooks so react-refresh re-evaluates it on every
 * HMR pass; keeping `createContext` here would change the context identity
 * mid-refresh and make useWfApp() throw in still-mounted consumers. Keep all
 * public imports on this module (the type is re-exported below). */
import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { wordflowApi } from '../../core/api-libs/wordflow/WordflowApi';
import { StorageCenter } from '../../core/api-libs/wordflow/WordflowStorage';
import type { User } from '../../core/api-libs/wordflow/wordflowTypes';
import { translate } from './WfLanguageCenter';
import { wfUserCenter } from './services/WfUserCenter';
import { WfAppContext, type WfAppContextType } from './wfAppContextCore';

export type { WfAppContextType } from './wfAppContextCore';

export function useWfApp(): WfAppContextType {
  const ctx = useContext(WfAppContext);
  if (!ctx) throw new Error('useWfApp must be used within <WfAppProvider>');
  return ctx;
}

/** Shell-language-bound translation hook (no context required). */
export function useWfT() {
  const { lang } = useShell();
  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>) =>
      translate(lang, key, replacements),
    [lang]
  );
  return { t, lang };
}

export const WfAppProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { lang } = useShell();

  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [learningLanguage, setLearningLanguageState] = useState<string>('en');
  const [activeGroupId, setActiveGroupIdState] = useState<string>('');

  // Keep the API client's language header in lock-step with the shell language.
  useEffect(() => {
    wordflowApi.setLanguage(lang);
  }, [lang]);

  // Restore session + persisted prefs on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedUser, storedToken, savedLearning, savedGroup] = await Promise.all([
          StorageCenter.auth.getUser(),
          StorageCenter.auth.getToken(),
          StorageCenter.language.getLearningLanguage(),
          StorageCenter.settings.getActiveGroupId(),
        ]);
        if (cancelled) return;
        if (savedLearning) setLearningLanguageState(savedLearning);
        const loggedIn = !!(storedUser && storedToken);
        if (loggedIn) {
          setUserState(storedUser);
          wordflowApi.setToken(storedToken);
        }

        // Resolve the REAL active group. The stored value defaults to the
        // placeholder 'g1' (StorageCenter.getActiveGroupId default), which is
        // never a real backend group id — using it to hit /query_gwords?gid=g1
        // makes the backend 500. So once logged in, fetch the real group list
        // and pick the first real group unless the saved id is a real one.
        // getWordGroups() is cached and degrades to [] on failure.
        if (loggedIn) {
          const isPlaceholder = !savedGroup || savedGroup === 'g1';
          try {
            const groups = await wordflowApi.getWordGroups();
            if (cancelled) return;
            const real = Array.isArray(groups) ? groups : [];
            const inList = !isPlaceholder && real.some((g) => g.id === savedGroup);
            if (inList) {
              setActiveGroupIdState(savedGroup);
            } else if (real.length > 0) {
              const firstId = real[0].id;
              setActiveGroupIdState(firstId);
              StorageCenter.settings.setActiveGroupId(firstId);
            } else {
              // New user with no groups yet — '' means "no active group".
              setActiveGroupIdState('');
            }
          } catch {
            // getWordGroups already degrades to []; keep '' (no active group).
            if (!cancelled) setActiveGroupIdState('');
          }
        } else if (savedGroup && savedGroup !== 'g1') {
          // Logged out but a real saved id exists — keep it for continuity.
          setActiveGroupIdState(savedGroup);
        }
      } catch (e) {
        console.error('[WfAppContext] init failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    // Drop any previous session's in-memory profile before the new one lands.
    wfUserCenter.clear();
    const result = await wordflowApi.login(email, password);
    if (result?.token) wordflowApi.setToken(result.token);
    if (result?.user) {
      setUserState(result.user);
      await StorageCenter.auth.setUser(result.user);
    }
    return result.user;
  }, []);

  const logout = useCallback(() => {
    setUserState(null);
    StorageCenter.auth.clearAuth();
    wordflowApi.clearCache();
    // Invalidate the user center's in-memory profile cache on logout.
    wfUserCenter.clear();
  }, []);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) StorageCenter.auth.setUser(u);
    else StorageCenter.auth.removeUser();
  }, []);

  const setLearningLanguage = useCallback((l: string) => {
    setLearningLanguageState(l);
    StorageCenter.language.setLearningLanguage(l);
  }, []);

  const setActiveGroupId = useCallback((id: string) => {
    setActiveGroupIdState(id);
    StorageCenter.settings.setActiveGroupId(id);
  }, []);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>) =>
      translate(lang, key, replacements),
    [lang]
  );

  const value: WfAppContextType = {
    user,
    isAuthenticated: !!user,
    loading,
    learningLanguage,
    setLearningLanguage,
    activeGroupId,
    setActiveGroupId,
    login,
    logout,
    setUser,
    t,
    lang,
  };

  return <WfAppContext.Provider value={value}>{children}</WfAppContext.Provider>;
};

export default WfAppProvider;
