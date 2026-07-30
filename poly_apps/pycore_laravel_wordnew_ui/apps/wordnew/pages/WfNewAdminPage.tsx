/**
 * WfNewAdminPage — the SUPER-ADMIN console (loopback local-management mode).
 *
 * Mirrors laravel-manager's #/vocabulary management surface, rebuilt in the
 * wordnew design language (theme tokens, framer-motion, trans() i18n, toasts).
 * Only reachable when the backend granted the loopback debug bypass — WfNewApp
 * probes wfNewAdminApi.probeStatus() and passes the result down; a deep-link
 * from a non-super origin renders the locked card instead of the console.
 *
 * Layout: a status banner (client IP + pinned backend base) + a persisted
 * sub-tab bar over five management panels:
 *   overview  — vocabulary statistics + per-language breakdown
 *   words     — dictionary word CRUD / batch actions / example sentences
 *   libraries — vocabulary library catalog + covers + delete
 *   queues    — TTS queue live stats/items + translation queue control
 *   translate — translate / TTS test tool (needs a login session)
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Lock, LayoutDashboard, BookA, LibraryBig, ListTodo, Languages,
} from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import type { WfNewSuperAdminStatus } from '../api';
import { wfNewAdminApi } from '../api';
import { WfNewAdminOverview } from '../components/admin/WfNewAdminOverview';
import { WfNewAdminWords } from '../components/admin/WfNewAdminWords';
import { WfNewAdminLibraries } from '../components/admin/WfNewAdminLibraries';
import { WfNewAdminQueues } from '../components/admin/WfNewAdminQueues';
import { WfNewAdminTranslate } from '../components/admin/WfNewAdminTranslate';
import { StorageKeys, StorageManager } from '../../../core/persistence';

type WfNewAdminTab = 'overview' | 'words' | 'libraries' | 'queues' | 'translate';

/** Persisted active sub-tab (returning to the console restores the last view). */
const ADMIN_TABS: Array<{ key: WfNewAdminTab; labelKey: string; icon: React.ReactNode }> = [
  { key: 'overview', labelKey: 'admin.tab.overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { key: 'words', labelKey: 'admin.tab.words', icon: <BookA className="w-3.5 h-3.5" /> },
  { key: 'libraries', labelKey: 'admin.tab.libraries', icon: <LibraryBig className="w-3.5 h-3.5" /> },
  { key: 'queues', labelKey: 'admin.tab.queues', icon: <ListTodo className="w-3.5 h-3.5" /> },
  { key: 'translate', labelKey: 'admin.tab.translate', icon: <Languages className="w-3.5 h-3.5" /> },
];

interface WfNewAdminPageProps {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  addToast: (text: string, type?: 'success' | 'info' | 'warning' | 'star') => void;
  /** Backend-decided loopback status (null while the probe is in flight). */
  superAdmin: WfNewSuperAdminStatus | null;
  /** Open a library in the existing word-browser page (#/library/<id>). */
  onOpenLibrary: (id: string, title?: string, language?: string) => void;
}

export const WfNewAdminPage: React.FC<WfNewAdminPageProps> = ({
  activeTheme,
  trans,
  addToast,
  superAdmin,
  onOpenLibrary,
}) => {
  const [activeTab, setActiveTab] = useState<WfNewAdminTab>(() => {
    try {
      const saved = StorageManager.get<WfNewAdminTab | null>(StorageKeys.WORDNEW_ADMIN_TAB, null);
      if (saved && ADMIN_TABS.some((t) => t.key === saved)) return saved;
    } catch { /* ignore */ }
    return 'overview';
  });

  const switchTab = (key: WfNewAdminTab): void => {
    setActiveTab(key);
    StorageManager.set(StorageKeys.WORDNEW_ADMIN_TAB, key);
  };

  // Deep-linked from a non-super origin (or the probe said no) — locked card.
  if (!superAdmin?.enabled) {
    return (
      <div className={`p-10 rounded-3xl ${activeTheme.cardClass} text-center space-y-3`}>
        <Lock className="w-10 h-10 mx-auto text-zinc-500" />
        <h3 className="text-base font-extrabold tracking-tight">{trans('admin.locked')}</h3>
        <p className="text-[11px] font-mono text-zinc-500 leading-relaxed max-w-md mx-auto">
          {trans('admin.lockedDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Super-mode status banner: who granted it (client IP) + where admin
          calls go (pinned page-origin backend, NOT the failover pool). */}
      <div className="p-4 sm:p-5 rounded-3xl border border-amber-500/25 bg-amber-500/[0.07] flex items-start gap-3">
        <div className="p-2 rounded-2xl bg-amber-500/15 border border-amber-500/20 shrink-0">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-extrabold tracking-tight text-amber-300">
            {trans('admin.bannerTitle')}
          </h3>
          <p className="text-[10px] font-mono text-zinc-400 leading-relaxed">
            {trans('admin.bannerDesc', { ip: superAdmin.clientIp || '127.0.0.1' })}
          </p>
          <p className="text-[10px] font-mono text-zinc-500 truncate">
            {trans('admin.bannerTarget')}: <span className="text-zinc-300">{wfNewAdminApi.baseUrl()}</span>
          </p>
        </div>
      </div>

      {/* Sub-tab segmented bar (persisted) */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-mono font-bold uppercase tracking-wider border transition ${
              activeTab === tab.key
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400'
            }`}
          >
            {tab.icon}
            <span>{trans(tab.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Active panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'overview' && (
            <WfNewAdminOverview activeTheme={activeTheme} trans={trans} addToast={addToast} />
          )}
          {activeTab === 'words' && (
            <WfNewAdminWords activeTheme={activeTheme} trans={trans} addToast={addToast} />
          )}
          {activeTab === 'libraries' && (
            <WfNewAdminLibraries
              activeTheme={activeTheme}
              trans={trans}
              addToast={addToast}
              onOpenLibrary={onOpenLibrary}
            />
          )}
          {activeTab === 'queues' && (
            <WfNewAdminQueues activeTheme={activeTheme} trans={trans} addToast={addToast} />
          )}
          {activeTab === 'translate' && (
            <WfNewAdminTranslate activeTheme={activeTheme} trans={trans} addToast={addToast} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
