/**
 * PcQueueCenterPage — tabbed Queue Manager + Task Queue + Translation Queue + …
 *
 * Tab bodies live in dedicated panel modules (same pattern as PcTaskQueuePage).
 * Shared hub: GET /api/local/task-center (useQueueCenterHub).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ListOrdered, RefreshCw, TimerReset, AlertTriangle, SlidersHorizontal,
} from 'lucide-react';
import { loadQueueCache, getPycoreHealth, PYCORE_HEALTH_EVENT } from '../../../core/api-libs/pycore';
import PcQueueManagerPanel from './PcQueueManagerPage';
import PcTaskQueuePanel from './PcTaskQueuePage';
import PcTranslationQueuePanel from './PcTranslationQueuePage';
import PcSentenceQueuePanel from './PcSentenceQueuePanel';
import PcSentenceVoiceVariantsPanel from '../components/PcSentenceVoiceVariantsPanel';
import { PcPuterWordAudioBatchBar } from '../components/PcPuterWordAudioBatchBar';
import PcQueueOverviewPanel from './PcQueueOverviewPanel';
import PcRecentTasksPanel from './PcRecentTasksPanel';
import PcWorkerStatusStrip from '../components/PcWorkerStatusStrip';
import PcAssistStrip from '../components/PcAssistStrip';
import PcTtsEnginesStrip from '../components/PcTtsEnginesStrip';
import PcUnifiedVoiceStrip from '../components/PcUnifiedVoiceStrip';
import PcQueueBumpToasts from '../components/PcQueueBumpToasts';
import PcCapabilityDrawer from '../components/PcCapabilityDrawer';
import { QueueCenterHubProvider } from '../hooks/useQueueCenterHub';
import {
  type QcTab, type PanelMeta,
  QC_TAB_KEY, QC_AUTO_KEY, QC_DRAWER_KEY, QC_AUTO_REFRESH_MS,
  QC_TAB_DEFS, isQcTab,
} from '../utils/pcQueueCenterTypes';

const PcQueueCenterPage: React.FC = () => {
  const { t } = useTranslation('pc');
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<QcTab>(() => {
    const fromUrl = searchParams.get('tab');
    if (isQcTab(fromUrl)) return fromUrl;
    const saved = localStorage.getItem(QC_TAB_KEY);
    return isQcTab(saved) ? saved : 'overview';
  });
  useEffect(() => { localStorage.setItem(QC_TAB_KEY, tab); }, [tab]);

  const [drawerOpen, setDrawerOpen] = useState(() => localStorage.getItem(QC_DRAWER_KEY) === '1');
  useEffect(() => { localStorage.setItem(QC_DRAWER_KEY, drawerOpen ? '1' : '0'); }, [drawerOpen]);

  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (isQcTab(fromUrl)) setTab(fromUrl);
  }, [searchParams]);

  const switchTab = useCallback((next: QcTab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  }, [setSearchParams]);

  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(() => localStorage.getItem(QC_AUTO_KEY) === '1');
  useEffect(() => { localStorage.setItem(QC_AUTO_KEY, auto ? '1' : '0'); }, [auto]);
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setTick((n) => n + 1), QC_AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto]);

  const [meta, setMeta] = useState<Record<QcTab, PanelMeta>>(() => ({
    overview: { count: null, loading: false },
    manager: { count: loadQueueCache()?.length ?? null, loading: false },
    tasks: { count: null, loading: false },
    translation: { count: null, loading: false },
    sentence: { count: null, loading: false },
    recent: { count: null, loading: false },
  }));
  const reportMeta = useCallback((key: QcTab, m: PanelMeta) => {
    setMeta((prev) =>
      prev[key].count === m.count && prev[key].loading === m.loading ? prev : { ...prev, [key]: m });
  }, []);
  const onOverviewMeta = useCallback((m: PanelMeta) => reportMeta('overview', m), [reportMeta]);
  const onManagerMeta = useCallback((m: PanelMeta) => reportMeta('manager', m), [reportMeta]);
  const onTasksMeta = useCallback((m: PanelMeta) => reportMeta('tasks', m), [reportMeta]);
  const onTranslationMeta = useCallback((m: PanelMeta) => reportMeta('translation', m), [reportMeta]);
  const onSentenceMeta = useCallback((m: PanelMeta) => reportMeta('sentence', m), [reportMeta]);
  const onRecentMeta = useCallback((m: PanelMeta) => reportMeta('recent', m), [reportMeta]);

  const activeLoading = meta[tab].loading;
  const [pycoreUp, setPycoreUp] = useState<boolean | null>(() => getPycoreHealth().up);
  useEffect(() => {
    const sync = () => setPycoreUp(getPycoreHealth().up);
    sync();
    window.addEventListener(PYCORE_HEALTH_EVENT, sync);
    return () => window.removeEventListener(PYCORE_HEALTH_EVENT, sync);
  }, []);

  return (
    <QueueCenterHubProvider refreshTick={tick}>
      <div className="p-6 md:p-8 space-y-6">
        <PcQueueBumpToasts />
        {pycoreUp === false && (
          <section className="pc-glass p-3 text-xs text-rose-500 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t('queueCenter.overview.unavailable')}</span>
          </section>
        )}

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <ListOrdered className="w-5 h-5 text-indigo-500" /> {t('queueCenter.title')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('queueCenter.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl pc-glass overflow-hidden">
              {QC_TAB_DEFS.map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => switchTab(key)}
                  className={`px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition ${
                    tab === key
                      ? 'bg-indigo-500/15 text-indigo-500'
                      : 'text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {t(`queueCenter.tabs.${key}` as const)}
                  {meta[key].count != null && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      tab === key ? 'bg-indigo-500/15 text-indigo-500' : 'bg-slate-500/10 text-slate-400'}`}>
                      {meta[key].count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAuto((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                auto
                  ? 'bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30'
                  : 'pc-glass text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
              }`}
              title={auto ? t('queueCenter.autoOnTitle', { sec: QC_AUTO_REFRESH_MS / 1000 }) : t('queueCenter.autoOffTitle')}>
              <TimerReset className="w-3.5 h-3.5" />
              {t('queueCenter.auto')} {auto ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
            </button>
            <button
              onClick={() => setTick((n) => n + 1)}
              disabled={activeLoading}
              className="p-2 rounded-xl pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
              title={t('queueCenter.refreshActive')}>
              <RefreshCw className={`w-4 h-4 ${activeLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                drawerOpen
                  ? 'bg-indigo-500/15 text-indigo-500 ring-1 ring-inset ring-indigo-500/30'
                  : 'pc-glass text-slate-500 hover:bg-indigo-500/10 hover:text-indigo-500'
              }`}
              title={t('queueCenter.drawer.openTitle')}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('queueCenter.drawer.open')}
            </button>
          </div>
        </div>

        {/* Persistent across all tabs: Puter.js word-audio batch generator. */}
        <PcPuterWordAudioBatchBar />

        {tab === 'overview' && (
          <>
            <PcWorkerStatusStrip refreshTick={tick} />
            <PcQueueOverviewPanel refreshTick={tick} onMeta={onOverviewMeta} />
          </>
        )}

        {(tab === 'manager' || tab === 'tasks' || tab === 'translation' || tab === 'sentence') && (
          <>
            <PcAssistStrip />
            <PcTtsEnginesStrip />
            <PcUnifiedVoiceStrip refreshTick={tick} />
          </>
        )}

        {tab === 'manager' && <PcQueueManagerPanel refreshTick={tick} onMeta={onManagerMeta} />}
        {tab === 'tasks' && <PcTaskQueuePanel refreshTick={tick} onMeta={onTasksMeta} />}
        {tab === 'translation' && <PcTranslationQueuePanel refreshTick={tick} onMeta={onTranslationMeta} />}
        {tab === 'sentence' && (
          <>
            <PcSentenceVoiceVariantsPanel />
            <PcSentenceQueuePanel refreshTick={tick} onMeta={onSentenceMeta} />
          </>
        )}
        {tab === 'recent' && <PcRecentTasksPanel refreshTick={tick} onMeta={onRecentMeta} />}

        <PcCapabilityDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </QueueCenterHubProvider>
  );
};

export default PcQueueCenterPage;
