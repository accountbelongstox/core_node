import React, { useEffect, useRef, useState } from 'react';
import { LogIn, Power, User } from 'lucide-react';
import { requestAuthLogin } from '../../core/auth/AuthRequestCenter';
import { authEndpointLabel } from '../../core/auth/AuthSession';
import { useAuthSnapshot } from '../../core/auth/useAuthSession';
import { laravelUserLabel } from '../../core/auth/LaravelUser';
import { logoutLaravel } from '../../core/integrations/laravel/LaravelAuthClient';
import { getSharedBaseURL } from '../../core/integrations/laravel/transport/BaseAPI';
import { LARAVEL_AUTH_NS, useTranslation } from './laravelAuthI18n';

const CHIP_CLASS = 'flex items-center gap-1.5 h-8 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 shrink-0 whitespace-nowrap';
const INITIAL_FALLBACK = '?';

interface LaravelAuthChipProps {
  /** Replaces the plain sign-out (an app clears its own per-user state there). */
  onSignOut?: () => Promise<unknown> | void;
}

/**
 * Header login entry of the ACTIVE Laravel API: Login button while signed out;
 * username + Logout while signed in; below sm only an icon / the user's initial.
 * Reads the shared per-API session store, so an endpoint switch updates it at once.
 */
export const LaravelAuthChip: React.FC<LaravelAuthChipProps> = ({ onSignOut }) => {
  const { t } = useTranslation(LARAVEL_AUTH_NS);
  const auth = useAuthSnapshot();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const host = auth.namespace ? authEndpointLabel(auth.namespace) : '';
  const username = laravelUserLabel(auth.user);
  const initial = (username.charAt(0) || INITIAL_FALLBACK).toUpperCase();

  const signOut = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      if (onSignOut) await onSignOut();
      else await logoutLaravel(getSharedBaseURL() ?? auth.namespace ?? '');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handlePointerDown = (event: PointerEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen]);

  if (!auth.loggedIn) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div className={`hidden md:flex px-2.5 text-slate-500 dark:text-slate-400 text-xs ${CHIP_CLASS}`} title={t('chip.signedOut', { host })}>
          <User size={13} className="text-slate-400 shrink-0" />
          <span className="font-medium">{t('chip.guest')}</span>
        </div>
        <button
          type="button"
          onClick={() => requestAuthLogin({ source: 'auth-chip', reason: 'header-auth' })}
          className="flex items-center justify-center gap-1.5 h-8 w-8 sm:w-auto sm:px-3.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 border border-transparent shadow-sm shadow-indigo-500/25 transition-all shrink-0 whitespace-nowrap"
          title={`${t('chip.login')} (${host})`}
          aria-label={t('chip.login')}
        >
          <LogIn size={13} className="shrink-0" />
          <span className="hidden sm:inline">{t('chip.login')}</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative flex items-center gap-1.5 sm:gap-2 shrink-0">
      <div className={`hidden md:flex px-2.5 ${CHIP_CLASS}`} title={t('chip.signedIn', { host, user: username })}>
        <User size={13} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
        <span className="text-slate-400 dark:text-slate-500 text-xs hidden lg:inline">{t('chip.loggedInAs')}</span>
        <span className="text-slate-800 dark:text-slate-200 font-semibold text-xs max-w-[10rem] truncate">{username}</span>
      </div>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="sm:hidden flex items-center justify-center h-8 w-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-xs font-bold shrink-0"
        title={t('chip.signedIn', { host, user: username })}
        aria-label={t('chip.signedIn', { host, user: username })}
        aria-expanded={menuOpen}
      >
        {initial}
      </button>
      {menuOpen && (
        <div className="sm:hidden absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{username}</p>
          <p className="text-[10px] font-mono text-slate-400 break-all">{host}</p>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); void signOut(); }}
            disabled={busy}
            className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 disabled:opacity-60"
          >
            <Power size={13} className="shrink-0" />
            {t('chip.logout')}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        className="hidden sm:flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/20 transition-all shrink-0 whitespace-nowrap shadow-sm disabled:opacity-60"
        title={`${t('chip.logout')} (${username})`}
        aria-label={t('chip.logout')}
      >
        <Power size={13} className="shrink-0" />
        <span>{t('chip.logout')}</span>
      </button>
    </div>
  );
};

export default LaravelAuthChip;
