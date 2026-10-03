import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Moon, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ApiEndpointSwitcher } from './ApiEndpointSwitcher';
import { useUnifiedApp } from '@/apps/laravel-manager/context/useUnifiedApp';
import { api } from '@/apps/laravel-manager/api';
import { LaravelAuthChip } from '@/shared/auth/LaravelAuthChip';

const CODE_UPDATE_POLL_MS = 60000;
const RELATIVE_TICK_MS = 1000;

interface TopHeaderProps {
  isLoggedIn: boolean;
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
const TopHeader: React.FC<TopHeaderProps> = ({ isLoggedIn }) => {
  const { lang, theme, toggleLang, toggleTheme, logout } = useUnifiedApp();
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

  const codeUpdateRelative = codeUpdatedAt
    ? formatRelativeAgo(codeUpdatedAt, serverNowMs(serverScannedAt, fetchedAtClient), t)
    : t('header.code_last_updated_unavailable');
  const codeUpdateBadge = codeUpdatedAt
    ? `${t('header.code_last_updated')}: ${formatCodeUpdateTime(codeUpdatedAt, lang)} · ${codeUpdateRelative}`
    : codeUpdateRelative;
  const codeUpdateTitle = codeUpdatedFile ? `${codeUpdateBadge}
${codeUpdatedFile}` : codeUpdateBadge;

  const chipClass = 'flex items-center gap-1.5 h-8 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 shrink-0 whitespace-nowrap';

  return (
    <header className="sticky top-0 z-40 h-12 md:h-14 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md transition-colors duration-300 shrink-0">
      <div className="flex items-center justify-between w-full h-full px-2 sm:px-4 md:px-6 gap-2 md:gap-3 flex-nowrap whitespace-nowrap">
        {/* Left: code update badge — relative time only below md, full timestamp from md */}
        <div className="flex items-center min-w-0 flex-1">
          <span
            className="inline-flex items-center h-7 max-w-full min-w-0 px-2 md:px-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-600 dark:text-indigo-400 font-mono whitespace-nowrap"
            title={codeUpdateTitle}
          >
            <span className="truncate md:hidden">{codeUpdateRelative}</span>
            <span className="truncate hidden md:inline">{codeUpdateBadge}</span>
          </span>
        </div>

        {/* Right: Actions and Status - Single Line, Never Wraps */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap whitespace-nowrap text-xs font-medium">
          {/* Login state badge (the login button below carries the state on phones) */}
          <div className={`hidden sm:flex px-2.5 ${chipClass}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${isLoggedIn ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-slate-400'}`} />
            <span className={`text-xs ${isLoggedIn ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
              {isLoggedIn ? t('header.system_online') : t('header.system_offline')}
            </span>
          </div>

          <div className="hidden sm:block h-4 w-[1px] bg-black/10 dark:bg-white/10 shrink-0" />

          {/* API Endpoint Switcher */}
          <ApiEndpointSwitcher />

          {/* Language and Theme Toggles */}
          <div className="flex items-center h-8 bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => toggleLang(true)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all"
              title={t('header.switch_language')}
              aria-label={t('header.switch_language')}
            >
              <Languages size={15} />
            </button>
            <button
              onClick={() => toggleTheme(true)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-yellow-400 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
              title={t('header.toggle_theme')}
              aria-label={t('header.toggle_theme')}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>

          <div className="hidden sm:block h-4 w-[1px] bg-black/10 dark:bg-white/10 shrink-0" />

          {/* Shared Laravel login entry of the active API */}
          <LaravelAuthChip onSignOut={logout} />
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
