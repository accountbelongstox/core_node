/**
 * PcAiPage — the unified "AI & Pycore Capabilities" page. The tab model lives in
 * pages/ai/aiTabs.ts (defined once): Models (manifest-driven list with live
 * panels), Providers & Keys, Studio, Tools and History. The active tab is
 * reflected in the URL (?tab=), persisted, and only the active view is mounted.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, MessageSquare, RefreshCcw } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { SUBTAB_MOTION } from '../components/PcAiShared';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { AI_TABS, DEFAULT_TAB, resolveTabTarget, type AiTab } from './ai/aiTabs';

const PcAiPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const { openChat } = useShell();

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AiTab>(() => (
    resolveTabTarget(searchParams.get('tab'))?.tab
    ?? resolveTabTarget(StorageManager.getRaw(StorageKeys.PYCORE_AI_TAB))?.tab
    ?? DEFAULT_TAB
  ));
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => { StorageManager.setRaw(StorageKeys.PYCORE_AI_TAB, tab); }, [tab]);

  // A link can land here while the page is already mounted (only ?tab= changes).
  const urlTarget = resolveTabTarget(searchParams.get('tab'));
  useEffect(() => { if (urlTarget) setTab(urlTarget.tab); }, [urlTarget?.tab]);

  const switchTab = useCallback((next: AiTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  }, [setSearchParams]);

  const active = useMemo(() => AI_TABS.find((entry) => entry.key === tab) ?? AI_TABS[0], [tab]);
  const View = active.View;

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-5 min-w-0 max-w-full">
      <div
        className="sticky top-0 z-20 -mx-3 sm:-mx-6 md:-mx-8 pl-3 sm:pl-6 md:pl-8 pc-dock-gutter-r py-3 -mt-3 sm:-mt-6 md:-mt-8 mb-1 flex flex-col gap-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Sparkles className="w-5 h-5 shrink-0 text-indigo-500" /> {t('ai.title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t(active.hintKey)}</p>
          </div>
          <div className="flex shrink-0 gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => openChat('pycore')}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 whitespace-nowrap transition">
              <MessageSquare className="w-3.5 h-3.5" /> {t('common.openAiChat')}
            </button>
            <button
              type="button"
              onClick={() => setRefreshTick((tick) => tick + 1)}
              title={t('common.refresh')}
              className="px-3 py-2 pc-glass hover:bg-indigo-500/10 text-xs font-bold rounded-xl flex items-center gap-1 whitespace-nowrap transition text-slate-700 dark:text-slate-200">
              <RefreshCcw className="w-3.5 h-3.5" /> {t('common.refresh')}
            </button>
          </div>
        </div>

        <div className="flex rounded-xl pc-glass overflow-x-auto max-w-full self-start no-scrollbar">
          {AI_TABS.map(({ key, labelKey, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              className={`relative px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap transition ${
                tab === key ? 'text-indigo-500' : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
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

      <AnimatePresence mode="wait">
        <motion.div key={tab} {...SUBTAB_MOTION}>
          <View refreshSignal={refreshTick} initialTool={urlTarget?.tab === tab ? urlTarget.tool : undefined} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default PcAiPage;
