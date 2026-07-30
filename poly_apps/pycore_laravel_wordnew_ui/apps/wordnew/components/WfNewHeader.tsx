/** WfNewHeader - the sticky glass header (nav logo, search, social, admin badge,
 * profile/login bubble, settings gear) extracted from WfNewApp so the shell stays
 * under the 800-line modular limit. */
import React from 'react';
import { Search, ShieldCheck, LogIn, Settings } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import type { WfNewSuperAdminStatus } from '../api';
import { WfNewNavLogo } from './WfNewNavLogo';
import { WfNewNotificationBell } from './WfNewNotificationBell';
import { WfNewAvatarView } from './WfNewAvatarView';

interface WfNewHeaderProps {
  activeTheme: ElementTheme;
  trans: (k: string, r?: Record<string, string | number>) => string;
  navStack: any[];
  goBack: () => void;
  goHome: () => void;
  pageHeader: { title: string; subtitle?: string } | null;
  setIsSearchOverlayOpen: (v: boolean) => void;
  setActiveTab: (t: any) => void;
  activeTab: string;
  currentUser: any;
  superAdmin: WfNewSuperAdminStatus | null;
  nickname: string;
  avatarUrl: string;
  addToast: (t: string, ty?: any) => void;
}

export const WfNewHeader: React.FC<WfNewHeaderProps> = (props) => {
  const {
    activeTheme, trans, navStack, goBack, goHome, pageHeader,
    setIsSearchOverlayOpen, setActiveTab, activeTab, currentUser,
    superAdmin, nickname, avatarUrl, addToast,
  } = props;
  return (
      <header className={`sticky top-0 z-40 w-full backdrop-blur-xl border-b border-white/5 py-4 px-4 sm:px-8 flex justify-between items-center transition-all ${
        activeTheme.id === 'nordic' 
          ? 'bg-white/80 dark:bg-slate-950/70' 
          : 'bg-slate-950/40'
      }`}>
        {/* GLOBAL nav/brand control: a back arrow when there is a previous page
            in the stack (goBack), else the brand logo (goHome). One component for
            the whole app — pages no longer need their own back row. */}
        <WfNewNavLogo
          canGoBack={navStack.length > 0}
          onBack={goBack}
          onHome={goHome}
          trans={trans}
          title={pageHeader?.title}
          subtitle={pageHeader?.subtitle}
        />

        {/* Real-time search button triggering instant search popup */}
        <div className="relative max-w-sm flex-1 mx-6 hidden md:block">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className={`w-full py-2.5 pl-4 pr-10 rounded-full text-xs font-mono text-left flex items-center gap-2 border transition-all ${
              activeTheme.id === 'nordic'
                ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span>{trans('search.placeholder')}</span>
          </button>
        </div>

        {/* Setting items right portion */}
        <div className="flex items-center gap-2.5 font-mono">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 md:hidden"
            title={trans('tip.search')}
          >
            <Search className="w-4 h-4 text-zinc-300" />
          </button>

          {/* Social exchange portal */}
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full border bg-white/5 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 transition-all text-xs cursor-pointer ${
              activeTab === 'social' ? 'bg-indigo-500/15 border-indigo-500/30' : 'border-white/5'
            }`}
            title={trans('tip.social')}
          >
            <span>🌐</span>
            <span className="hidden sm:inline font-mono font-bold text-[10px] tracking-tight">{trans('bc.social')}</span>
          </button>

          {/* Notification center bell (only when logged in) */}
          {currentUser.isLoggedIn && (
            <WfNewNotificationBell
              trans={trans}
              addToast={addToast}
              onOpenSocial={() => setActiveTab('social')}
            />
          )}

          {/* Super-admin badge (only when the backend granted the loopback
              bypass) — the always-visible UI hint that this session holds
              login-free management permission; opens the admin console. */}
          {superAdmin?.enabled && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full border transition-all text-xs cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20'
              }`}
              title={trans('admin.badgeTip', { ip: superAdmin.clientIp || '127.0.0.1' })}
              aria-label={trans('admin.badge')}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline font-mono font-bold text-[10px] tracking-tight uppercase">
                {trans('admin.badge')}
              </span>
            </button>
          )}

          {/* Individual Profile Console / Login bubble */}
          <button
            onClick={() => setActiveTab(currentUser.isLoggedIn ? 'profile' : 'auth')}
            className={`flex items-center p-1.5 rounded-full border bg-white/5 transition-all cursor-pointer ${
              activeTab === 'profile' || activeTab === 'auth' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/10 border-white/5'
            }`}
            title={currentUser.isLoggedIn ? (nickname || trans('tip.profile')) : trans('common.login')}
            aria-label={currentUser.isLoggedIn ? (nickname || trans('tip.profile')) : trans('common.login')}
          >
            {/* Logged in -> avatar (with online dot); logged out -> a plain login
                icon (next to the settings gear), NOT a placeholder avatar. The name
                is available via the title/aria-label tooltip when present. */}
            {currentUser.isLoggedIn ? (
              <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-sm relative overflow-visible">
                <WfNewAvatarView value={avatarUrl} className="text-sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 bg-emerald-500" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300">
                <LogIn className="w-4 h-4" />
              </div>
            )}
          </button>

          {/* Dark/light + language controls moved into Settings → Appearance to
              keep the header compact (a quick gear shortcut remains). */}
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-zinc-300"
            title={trans('nav.settings')}
            aria-label={trans('nav.settings')}
          >
            <Settings className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </header>
  );
};
