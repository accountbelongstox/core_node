/** WfNewHeader - the sticky glass header: nav/page-icon control, search, quick
 * theme/language menu, notifications, admin badge, and the right-most account
 * slot (avatar → Settings when logged in; login + settings gear when not). */
import React from 'react';
import { Search, ShieldCheck, LogIn, Settings } from 'lucide-react';
import type { ElementTheme } from '../WfNewThemes';
import type { WfNewSuperAdminStatus } from '../api';
import type { WordNewPageHeader } from '../routing/WordNewHashRoutes';
import { WfNewNavLogo } from './WfNewNavLogo';
import { WfNewNotificationBell } from './WfNewNotificationBell';
import { WfNewQuickPrefsMenu } from './WfNewQuickPrefsMenu';
import { WfNewAvatarView } from './WfNewAvatarView';
import { requestAuthLogin } from '../../../core/auth/AuthRequestCenter';

interface WfNewHeaderProps {
  activeTheme: ElementTheme;
  trans: (k: string, r?: Record<string, string | number>) => string;
  navStack: any[];
  goBack: () => void;
  goHome: () => void;
  pageHeader: WordNewPageHeader | null;
  setIsSearchOverlayOpen: (v: boolean) => void;
  setActiveTab: (t: any) => void;
  activeTab: string;
  currentUser: any;
  superAdmin: WfNewSuperAdminStatus | null;
  nickname: string;
  avatarUrl: string;
  addToast: (t: string, ty?: any) => void;
}

const ROUND_ACTION = 'flex items-center justify-center w-10 h-10 rounded-full border bg-slate-900/5 hover:bg-slate-900/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-zinc-300 cursor-pointer shrink-0';

export const WfNewHeader: React.FC<WfNewHeaderProps> = (props) => {
  const {
    activeTheme, trans, navStack, goBack, goHome, pageHeader,
    setIsSearchOverlayOpen, setActiveTab, activeTab, currentUser,
    superAdmin, nickname, avatarUrl, addToast,
  } = props;
  const settingsActive = activeTab === 'settings' || activeTab === 'profile';

  return (
      <header className={`wf-safe-top sticky top-0 z-40 w-full backdrop-blur-xl border-b border-slate-900/5 dark:border-white/5 pb-3 px-3 sm:px-8 flex items-center gap-2 sm:gap-4 transition-all ${
        activeTheme.id === 'nordic'
          ? 'bg-white/80 dark:bg-slate-950/70'
          : 'bg-white/70 dark:bg-slate-950/40'
      }`}>
        <WfNewNavLogo
          canGoBack={navStack.length > 0}
          onBack={goBack}
          onHome={goHome}
          trans={trans}
          page={pageHeader}
        />

        <div className="flex-1 min-w-0 flex justify-center">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className={`hidden md:flex w-full max-w-sm py-2.5 pl-4 pr-10 rounded-full text-xs font-mono text-left items-center gap-2 border transition-all ${
              activeTheme.id === 'nordic'
                ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                : 'bg-slate-900/5 border-slate-900/10 text-slate-500 hover:bg-slate-900/10 dark:bg-white/5 dark:border-white/5 dark:text-zinc-400 dark:hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span className="truncate">{trans('search.placeholder')}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 font-mono shrink-0">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className={`${ROUND_ACTION} border-slate-900/10 dark:border-white/5 md:hidden`}
            title={trans('tip.search')}
            aria-label={trans('tip.search')}
          >
            <Search className="w-4 h-4" />
          </button>

          <WfNewQuickPrefsMenu trans={trans} />

          {currentUser.isLoggedIn && (
            <WfNewNotificationBell
              trans={trans}
              addToast={addToast}
              onOpenSocial={() => setActiveTab('social')}
            />
          )}

          {/* Super-admin badge: only when the backend granted the loopback bypass. */}
          {superAdmin?.enabled && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`${ROUND_ACTION} ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
              }`}
              title={trans('admin.badgeTip', { ip: superAdmin.clientIp || '127.0.0.1' })}
              aria-label={trans('admin.badge')}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>
          )}

          {currentUser.isLoggedIn ? (
            <button
              onClick={() => setActiveTab('settings')}
              className={`relative flex items-center justify-center w-10 h-10 rounded-full border transition-all cursor-pointer shrink-0 ${
                settingsActive ? 'border-indigo-400/60 ring-2 ring-indigo-500/25' : 'border-slate-900/10 dark:border-white/10 hover:border-indigo-400/40'
              }`}
              title={`${nickname || trans('tip.profile')} · ${trans('nav.settings')}`}
              aria-label={`${nickname || trans('tip.profile')} · ${trans('nav.settings')}`}
            >
              <span className="w-8 h-8 rounded-full bg-slate-900 overflow-hidden flex items-center justify-center text-sm">
                <WfNewAvatarView value={avatarUrl} className="text-sm" />
              </span>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 bg-emerald-500" />
            </button>
          ) : (
            <>
              <button
                onClick={() => requestAuthLogin({ source: 'wordnew-header', reason: 'login-action' })}
                className={`${ROUND_ACTION} ${activeTab === 'auth' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'border-slate-900/10 dark:border-white/5'}`}
                title={trans('common.login')}
                aria-label={trans('common.login')}
              >
                <LogIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`${ROUND_ACTION} ${settingsActive ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'border-slate-900/10 dark:border-white/5'}`}
                title={trans('nav.settings')}
                aria-label={trans('nav.settings')}
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>
  );
};
