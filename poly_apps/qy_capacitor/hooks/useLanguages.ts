/**
 * useLanguages Hook
 * Simplified hook for using LanguagesCenter in components
 */

import { useState, useEffect } from 'react';
import { SupportedLanguage } from '../types';
import { LanguagesCenter } from '../services/LanguagesCenter';

export interface UseLanguagesReturn {
  languages: SupportedLanguage[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getByCode: (code: string) => SupportedLanguage | undefined;
  search: (query: string) => SupportedLanguage[];
  getLanguageName: (code: string, preferNative?: boolean) => string;
}

/**
 * Custom hook to manage supported languages with automatic updates
 *
 * @example
 * ```tsx
 * function LanguageSelector() {
 *   const { languages, loading, getLanguageName } = useLanguages();
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <select>
 *       {languages.map(lang => (
 *         <option key={lang.code} value={lang.code}>
 *           {getLanguageName(lang.code, true)}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useLanguages(): UseLanguagesReturn {
  const [languages, setLanguages] = useState<SupportedLanguage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to automatic updates
    const unsubscribe = LanguagesCenter.subscribe((newLanguages) => {
      setLanguages(newLanguages);
      if (newLanguages.length > 0) {
        setLoading(false);
      }
    });

    // Initialize (loads from cache or fetches from API)
    LanguagesCenter.initialize().catch(err => {
      console.error('[useLanguages] Failed to initialize:', err);
      setError(err.message || 'Failed to load languages');
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await LanguagesCenter.refresh();
      setLoading(false);
    } catch (err: any) {
      console.error('[useLanguages] Refresh failed:', err);
      setError(err.message || 'Failed to refresh languages');
      setLoading(false);
    }
  };

  return {
    languages,
    loading,
    error,
    refresh,
    getByCode: LanguagesCenter.getByCode.bind(LanguagesCenter),
    search: LanguagesCenter.search.bind(LanguagesCenter),
    getLanguageName: LanguagesCenter.getLanguageName.bind(LanguagesCenter),
  };
}

/**
 * Hook to get a single language by code
 *
 * @example
 * ```tsx
 * function LanguageInfo({ code }: { code: string }) {
 *   const language = useLanguage(code);
 *
 *   if (!language) return <div>Language not found</div>;
 *
 *   return <div>{language.name} ({language.nativeName})</div>;
 * }
 * ```
 */
export function useLanguage(code: string): SupportedLanguage | undefined {
  const [language, setLanguage] = useState<SupportedLanguage | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = LanguagesCenter.subscribe((languages) => {
      const found = languages.find(lang => lang.code === code);
      setLanguage(found);
    });

    // Check immediately
    const found = LanguagesCenter.getByCode(code);
    if (found) {
      setLanguage(found);
    } else {
      // Initialize if not available
      LanguagesCenter.initialize();
    }

    return unsubscribe;
  }, [code]);

  return language;
}
