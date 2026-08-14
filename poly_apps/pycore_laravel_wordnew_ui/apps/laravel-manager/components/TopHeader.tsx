import React, { useState, useEffect, useCallback } from 'react';
import { Power, Sun, Moon, Languages, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ApiEndpointSwitcher } from './ApiEndpointSwitcher';
import { useUnifiedApp } from '@/apps/laravel-manager/context/useUnifiedApp';
import { api } from '@/apps/laravel-manager/api';

const CODE_UPDATE_POLL_MS = 60000;
const RELATIVE_TICK_MS = 1000;

interface TopHeaderProps {
  isLoggedIn: boolean;
  onAuthClick: () => void;
}

function localeTag(lang: string): string {
  if (lang === 'zh') return 'zh-CN';
  return 'en-US';
}

function formatCodeUpdateTime(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(localeTag(lang), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function serverNowMs(serverScannedAt: string | null, fetchedAtClient: number | null): number {
  if (!serverScannedAt || fetchedAtClient === null) return Date.now();
  return new Date(serverScannedAt).getTime() + (Date.now() - fetchedAtClient);
}

function formatRelativeAgo(lastModifiedIso: string, serverNow: number, t: TFunction): string {
  const lastMs = new Date(lastModifiedIso).getTime();
  if (Number.isNaN(lastMs)) return t('header.code_last_updated_unavailable');

  const diffSec = Math.max(0, Math.floor((serverNow - lastMs) / 1000));
  if (diffSec < 10) return t('header.code_updated_just_now');
  if (diffSec < 60) return t('header.code_updated_seconds_ago', { count: diffSec });

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('header.code_updated_minutes_ago', { count: diffMin });

  const diffHr = Math.floor(diffSec / 3600);
  if (diffHr < 24) return t('header.code_updated_hours_ago', { count: diffHr });

  const diffDay = Math.floor(diffSec / 86400);
  return t('header.code_updated_days_ago', { count: diffDay });
}

/**
 * Right-side top bar. Sticks to the top when the main content scrolls.
 * Rendered inside the main content column (next to the fixed Sidebar).
 */
const TopHeader: React.FC<TopHeaderProps> = ({ isLoggedIn, onAuthClick }) => {
  const { lang, theme, toggleLang, toggleTheme } = useUnifiedApp();
  const { t } = useTranslation();
  const [codeUpdatedAt, setCodeUpdatedAt] = useState<string | null>(null);
  const [codeUpdatedFile, setCodeUpdatedFile] = useState<string | null>(null);
  const [serverScannedAt, setServerScannedAt] = useState<string | null>(null);
  const [fetchedAtClient, setFetchedAtClient] = useState<number | null>(null);
  const [, setRelativeTick] = useState(0);

  const refreshCodeUpdateTime = useCallback(async () => {
    try {
      const status = await api.codeUpdate.getLastModified();
      if (!status?.last_modified_at) return;
      setCodeUpdatedAt(status.last_modified_at);
      setCodeUpdatedFile(status.latest_file ?? null);
      setServerScannedAt(status.scanned_at ?? null);
      setFetchedAtClient(Date.now());
    } catch {
      /* backend may be offline; keep the last known value */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      await refreshCodeUpdateTime();
    };

    tick();
    const pollId = window.setInterval(tick, CODE_UPDATE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [refreshCodeUpdateTime]);

  useEffect(() => {
    const tickId = window.setInterval(() => {
      setRelativeTick((value) => value + 1);
    }, RELATIVE_TICK_MS);
    return () => window.clearInterval(tickId);
  }, []);

  const codeUpdateBadge = codeUpdatedAt
    ? `${t('header.code_last_updated')}: ${formatCodeUpdateTime(codeUpdatedAt, lang)} · ${formatRelativeAgo(
        codeUpdatedAt,
        serverNowMs(serverScannedAt, fetchedAtClient),
        t
      )}`
    : t('header.code_last_updated_unavailable');

  return (
    <header className="sticky top-0 z-40 min-h-16 border-b border-black/5 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-md transition-colors duration-300 flex-shrink-0">
      <div className="grid w-full grid-cols-1 lg:grid-cols-2 items-center gap-3 px-4 sm:px-6 py-2">
        <div className="flex min-w-0 items-center justify-start">
        <span
          className="inline-block max-w-full truncate px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-600 dark:text-indigo-400 font-mono whitespace-nowrap"
          title={codeUpdatedFile ? codeUpdatedFile : undefined}
        >
          {codeUpdateBadge}
        </span>
        </div>

      <div className="flex items-center justify-end gap-2 sm:gap-4 text-xs font-medium flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] ${isLoggedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span className={`${isLoggedIn ? 'text-emerald-600 dark:text-emerald-500' : 'text-slate-500'} whitespace-nowrap`}>
            {isLoggedIn ? t('header.system_online') : t('header.system_offline')}
          </span>
        </div>

        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 hidden sm:block" />

        <div className="flex items-center gap-2">
          <ApiEndpointSwitcher />
          <button
            onClick={() => toggleLang(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            title="Switch Language"
          >
            <Languages size={18} />
          </button>
          <button
            onClick={() => toggleTheme(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-amber-500 dark:hover:text-yellow-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 hidden sm:block" />

        <div className="flex items-center gap-2 flex-shrink-0">
          {isLoggedIn && (
            <div className="hidden lg:flex items-center gap-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <span className="text-xs">{t('header.logged_in_as')}</span>
              <span className="text-slate-800 dark:text-white font-bold text-xs">adminroot</span>
            </div>
          )}
          <button
            onClick={onAuthClick}
            className={`
              px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all flex items-center gap-1.5 border font-semibold text-xs sm:text-sm flex-shrink-0
              ${isLoggedIn
                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-500 border-red-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-lg shadow-indigo-500/20'}
            `}
          >
            {isLoggedIn ? (
              <>
                <Power size={14} /> <span className="hidden sm:inline whitespace-nowrap">{t('header.logout')}</span>
              </>
            ) : (
              <>
                <LogIn size={14} /> <span className="whitespace-nowrap">{t('header.login')}</span>
              </>
            )}
          </button>
        </div>
      </div>
      </div>
    </header>
  );
};

export default TopHeader;
