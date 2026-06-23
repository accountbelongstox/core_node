/**
 * PcAiPage — the unified "AI" page, merging the three former AI pages into ONE
 * tabbed surface:
 *   - Capability  (PcAiCapabilityView)  — compute, providers, rate budgets,
 *                 OCR/TTS, free libraries + per-provider image test.
 *   - Image Studio (PcAiStudioView)     — chat-style image & text generation.
 *   - Keys        (PcAiKeysView)        — add / rotate / delete provider keys.
 *
 * The active sub-tab is reflected in the URL (?tab=capability|studio|keys) so
 * the legacy routes /ai-status, /ai-image and /ai-keys can redirect here with
 * the matching ?tab= (see PcApp.tsx). Sub-tab switching is animated with
 * framer-motion; only the active sub-view is mounted (its polling is the only
 * one running). A shared sticky header carries the title, an "Open AI chat"
 * hand-off and a Refresh button that signals the active sub-view to reload.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, Activity, ImagePlay, KeyRound, MessageSquare, RefreshCcw,
  type LucideIcon,
} from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import PcAiCapabilityView from '../components/PcAiCapabilityView';
import PcAiStudioView from '../components/PcAiStudioView';
import PcAiKeysView from '../components/PcAiKeysView';
import { SUBTAB_MOTION } from '../components/PcAiShared';

type AiTab = 'capability' | 'studio' | 'keys';

const TAB_KEY = 'pc_ai_tab';

const isTab = (v: string | null): v is AiTab =>
  v === 'capability' || v === 'studio' || v === 'keys';

interface TabDef { key: AiTab; labelKey: string; hintKey: string; Icon: LucideIcon; }

const TABS: TabDef[] = [
  { key: 'capability', labelKey: 'ai.tabs.capability', hintKey: 'ai.tabHint.capability', Icon: Activity },
  { key: 'studio', labelKey: 'ai.tabs.studio', hintKey: 'ai.tabHint.studio', Icon: ImagePlay },
  { key: 'keys', labelKey: 'ai.tabs.keys', hintKey: 'ai.tabHint.keys', Icon: KeyRound },
];

const PcAiPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const { openChat } = useShell();

  // Initial tab: ?tab= (set by the legacy-route redirects) wins over the
  // last-used tab persisted in localStorage.
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AiTab>(() => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(TAB_KEY);
    return isTab(saved) ? saved : 'capability';
  });
  useEffect(() => { localStorage.setItem(TAB_KEY, tab); }, [tab]);

  // A legacy-slug redirect can land here while the page is ALREADY mounted
  // (only ?tab= changes, no remount) — keep the tab in sync with the URL.
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isTab(fromUrl)) setTab(fromUrl);
  }, [searchParams]);

  const switchTab = useCallback((next: AiTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  }, [setSearchParams]);

  // Per-tab refresh signal — bumping it tells the active sub-view to reload.
  const [refreshTick, setRefreshTick] = useState<Record<AiTab, number>>({
    capability: 0, studio: 0, keys: 0,
  });
  const refreshActive = useCallback(() => {
    setRefreshTick((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
  }, [tab]);

  const activeHint = useMemo(
    () => t(TABS.find((d) => d.key === tab)!.hintKey),
    [t, tab],
  );

  return (
    <div className="p-6 md:p-8 space-y-5 min-w-0 max-w-full">
      {/* Sticky page chrome — title + sub-tabs + actions pinned below PcTopBar. */}
      <div
        className="sticky top-0 z-20 -mx-6 md:-mx-8 px-6 md:px-8 py-3 -mt-6 md:-mt-8 mb-1 flex flex-col gap-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl"
        style={{ paddingRight: 'max(1.5rem, var(--shell-dock-right-gutter, 264px))' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Sparkles className="w-5 h-5 text-indigo-500" /> {t('ai.title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeHint}</p>
          </div>
          <div className="flex shrink-0 gap-2 self-end sm:self-auto">
            <button
              onClick={() => openChat('pycore')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition">
              <MessageSquare className="w-3.5 h-3.5" /> {t('common.openAiChat')}
            </button>
            <button
              onClick={refreshActive}
              title={t('common.refresh')}
              className="px-3 py-2 pc-glass hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 transition text-slate-700 dark:text-slate-200">
              <RefreshCcw className="w-3.5 h-3.5" /> {t('common.refresh')}
            </button>
          </div>
        </div>

        {/* sub-tab bar */}
        <div className="flex rounded-xl pc-glass overflow-hidden w-full sm:w-auto self-start">
          {TABS.map(({ key, labelKey, Icon }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`relative px-4 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                tab === key
                  ? 'text-indigo-500'
                  : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {t(labelKey)}
              {tab === key && (
                <motion.span
                  layoutId="pc-ai-subtab"
                  className="absolute inset-0 -z-10 bg-indigo-500/15 rounded-lg"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* animated sub-view swap */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} {...SUBTAB_MOTION}>
          {tab === 'capability' && <PcAiCapabilityView refreshSignal={refreshTick.capability} />}
          {tab === 'studio' && <PcAiStudioView refreshSignal={refreshTick.studio} />}
          {tab === 'keys' && <PcAiKeysView refreshSignal={refreshTick.keys} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PcAiPage;
