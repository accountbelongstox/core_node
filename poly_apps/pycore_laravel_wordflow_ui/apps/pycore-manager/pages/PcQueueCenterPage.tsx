/**
 * PcQueueCenterPage — single page of queue sections (no tabs).
 *
 * Every section is a card with a header row (icon, title, live count, and an
 * idempotent toggle switch where applicable) plus the existing panel component
 * as its body. Shared hub: GET /api/local/task-center (useQueueCenterHub);
 * toggles mutate via PycoreApi then hub.refreshHub(). Legacy ?tab= links
 * scroll to the matching section anchor instead of switching tabs.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ListOrdered, RefreshCw, TimerReset, AlertTriangle, SlidersHorizontal,
} from 'lucide-react';
import { getPycoreHealth, PYCORE_HEALTH_EVENT, pycoreApi } from '../../../core/api-libs/pycore';
import PcQueueManagerPanel from './PcQueueManagerPage';
import PcTaskQueuePanel from './PcTaskQueuePage';
import PcTranslationQueuePanel from './PcTranslationQueuePage';
import PcSentenceQueuePanel from './PcSentenceQueuePanel';
import { PcPuterWordAudioBatchBar } from '../components/PcPuterWordAudioBatchBar';
import PcQueueOverviewPanel from './PcQueueOverviewPanel';
import PcRecentTasksPanel from './PcRecentTasksPanel';
import PcWorkerStatusStrip from '../components/PcWorkerStatusStrip';
import PcAssistStrip from '../components/PcAssistStrip';
import PcTtsEnginesStrip from '../components/PcTtsEnginesStrip';
import PcQueueBumpToasts from '../components/PcQueueBumpToasts';
import PcCapabilityDrawer from '../components/PcCapabilityDrawer';
import { QueueCenterHubProvider, useQueueCenterHub } from '../hooks/useQueueCenterHub';
import {
  type QcSection, type PanelMeta,
  QC_AUTO_KEY, QC_DRAWER_KEY, QC_AUTO_REFRESH_MS,
  QC_SECTION_DEFS, isQcSection, qcSectionAnchor,
} from '../utils/pcQueueCenterTypes';

const HIGHLIGHT_MS = 2500;

/** Idempotent section toggle switch (header row). */
const QcSectionSwitch: React.FC<{ on: boolean; busy: boolean; onToggle: () => void; title: string }> = ({
  on, busy, onToggle, title,
}) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={busy}
    aria-pressed={on}
    title={title}
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
      on ? 'bg-emerald-500' : 'bg-slate-400/40'
    }`}>
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${
      on ? 'translate-x-[18px]' : 'translate-x-[3px]'
    }`} />
  </button>
);

interface QcSectionCardProps {
  section: QcSection;
  count: number | null;
  highlight: boolean;
  toggle?: { on: boolean; busy: boolean; onToggle: () => void; title: string };
  extra?: React.ReactNode;
  children: React.ReactNode;
}

/** One Queue Center section: header row (icon/title/count/toggle) + body. */
const QcSectionCard: React.FC<QcSectionCardProps> = ({
  section, count, highlight, toggle, extra, children,
}) => {
  const { t } = useTranslation('pc');
  const def = QC_SECTION_DEFS.find((d) => d.key === section)!;
  const Icon = def.Icon;
  return (
    <section
      id={qcSectionAnchor(section)}
      className={`pc-glass p-4 space-y-4 scroll-mt-6 transition ${
        highlight ? 'ring-2 ring-indigo-400/70' : ''
      }`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {t(`queueCenter.sections.${section}` as const)}
        </h2>
        {count != null && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">{count}</span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {extra}
          {toggle && (
            <>
              <QcSectionSwitch on={toggle.on} busy={toggle.busy} onToggle={toggle.onToggle} title={toggle.title} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${toggle.on ? 'text-emerald-500' : 'text-slate-400'}`}>
                {toggle.on ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
              </span>
            </>
          )}
        </div>
      </div>
      {children}
    </section>
  );
};

/** Page body — lives under QueueCenterHubProvider so it can drive toggles. */
const QueueCenterBody: React.FC = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const [searchParams] = useSearchParams();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const [drawerOpen, setDrawerOpen] = useState(() => localStorage.getItem(QC_DRAWER_KEY) === '1');
  useEffect(() => { localStorage.setItem(QC_DRAWER_KEY, drawerOpen ? '1' : '0'); }, [drawerOpen]);

  // Page-level auto refresh (shared tick → hub + panels).
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(() => localStorage.getItem(QC_AUTO_KEY) === '1');
  useEffect(() => { localStorage.setItem(QC_AUTO_KEY, auto ? '1' : '0'); }, [auto]);
  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setTick((n) => n + 1), QC_AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [auto]);

  // Per-section live counts reported up by the body panels.
  const [meta, setMeta] = useState<Record<QcSection, PanelMeta>>(() => ({
    overview: { count: null, loading: false },
    manager: { count: null, loading: false },
    tasks: { count: null, loading: false },
    translation: { count: null, loading: false },
    wordAudio: { count: null, loading: false },
    sentence: { count: null, loading: false },
    recent: { count: null, loading: false },
  }));
  const reportMeta = useCallback((key: QcSection, m: PanelMeta) => {
    setMeta((prev) =>
      prev[key].count === m.count && prev[key].loading === m.loading ? prev : { ...prev, [key]: m });
  }, []);
  const onOverviewMeta = useCallback((m: PanelMeta) => reportMeta('overview', m), [reportMeta]);
  const onManagerMeta = useCallback((m: PanelMeta) => reportMeta('manager', m), [reportMeta]);
  const onTasksMeta = useCallback((m: PanelMeta) => reportMeta('tasks', m), [reportMeta]);
  const onTranslationMeta = useCallback((m: PanelMeta) => reportMeta('translation', m), [reportMeta]);
  const onSentenceMeta = useCallback((m: PanelMeta) => reportMeta('sentence', m), [reportMeta]);
  const onRecentMeta = useCallback((m: PanelMeta) => reportMeta('recent', m), [reportMeta]);

  // Legacy ?tab= links → scroll to the section anchor + a brief highlight.
  const [highlight, setHighlight] = useState<QcSection | null>(null);
  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    if (!isQcSection(fromUrl)) return;
    setHighlight(fromUrl);
    document.getElementById(qcSectionAnchor(fromUrl))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const id = window.setTimeout(() => { if (mounted.current) setHighlight(null); }, HIGHLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [searchParams]);

  // Section toggles — every mutation is idempotent and followed by a hub refresh.
  const [busySection, setBusySection] = useState<QcSection | null>(null);
  const runToggle = useCallback(async (key: QcSection, fn: () => Promise<unknown>) => {
    if (busySection) return;
    setBusySection(key);
    try {
      await fn();
      hub.refreshHub();
    } catch (e: any) {
      console.warn(`[QueueCenter] ${key} toggle failed:`, e?.message || e);
    } finally {
      if (mounted.current) setBusySection(null);
    }
  }, [busySection, hub]);

  // Frontend-only live switches (start/stop the panel's own polling).
  const [managerLive, setManagerLive] = useState(true);
  const [tasksLive, setTasksLive] = useState(true);
  const [translationLive, setTranslationLive] = useState(true);

  const assistOn = hub.assist?.enabled === true;
  const translationWorkerOn =
    hub.workers?.callbacks?.find((c) => c.name === 'translation_worker')?.enabled === true;
  const sentenceOn = hub.voiceSentence?.auto_start === true;

  const toggleAssist = useCallback(
    () => runToggle('overview', () => pycoreApi.setAssistConfig({ enabled: !assistOn })),
    [runToggle, assistOn]);
  const toggleTranslation = useCallback(async () => {
    const next = !translationWorkerOn;
    setTranslationLive(next);
    await runToggle('translation', () => pycoreApi.setHeartbeatWorkerConfig('translation_worker', next));
  }, [runToggle, translationWorkerOn]);
  const toggleSentence = useCallback(
    () => runToggle('sentence', () => pycoreApi.setSentenceAudioAutoConfig(!sentenceOn)),
    [runToggle, sentenceOn]);

  const [pycoreUp, setPycoreUp] = useState<boolean | null>(() => getPycoreHealth().up);
  useEffect(() => {
    const sync = () => setPycoreUp(getPycoreHealth().up);
    sync();
    window.addEventListener(PYCORE_HEALTH_EVENT, sync);
    return () => window.removeEventListener(PYCORE_HEALTH_EVENT, sync);
  }, []);

  const wordPending = hub.voiceWord?.laravel?.pending ?? null;

  return (
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
            onClick={() => { setTick((n) => n + 1); hub.refreshHub(); }}
            disabled={hub.loading}
            className="p-2 rounded-xl pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
            title={t('queueCenter.refreshActive')}>
            <RefreshCw className={`w-4 h-4 ${hub.loading ? 'animate-spin' : ''}`} />
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

      {/* Heartbeat worker status — once, page level. */}
      <PcWorkerStatusStrip refreshTick={tick} />

      <QcSectionCard
        section="overview"
        count={meta.overview.count}
        highlight={highlight === 'overview'}
        toggle={{
          on: assistOn,
          busy: busySection === 'overview',
          onToggle: toggleAssist,
          title: assistOn ? t('queueCenter.sectionsToggle.assistOff') : t('queueCenter.sectionsToggle.assistOn'),
        }}>
        <PcAssistStrip />
        <PcQueueOverviewPanel refreshTick={tick} onMeta={onOverviewMeta} />
      </QcSectionCard>

      <QcSectionCard
        section="manager"
        count={meta.manager.count}
        highlight={highlight === 'manager'}
        toggle={{
          on: managerLive,
          busy: false,
          onToggle: () => setManagerLive((v) => !v),
          title: managerLive ? t('queueCenter.sectionsToggle.pollOff') : t('queueCenter.sectionsToggle.pollOn'),
        }}>
        <PcQueueManagerPanel refreshTick={tick} onMeta={onManagerMeta} live={managerLive} />
      </QcSectionCard>

      <QcSectionCard
        section="tasks"
        count={meta.tasks.count}
        highlight={highlight === 'tasks'}
        toggle={{
          on: tasksLive,
          busy: false,
          onToggle: () => setTasksLive((v) => !v),
          title: tasksLive ? t('queueCenter.sectionsToggle.pollOff') : t('queueCenter.sectionsToggle.pollOn'),
        }}>
        <PcTaskQueuePanel refreshTick={tick} onMeta={onTasksMeta} live={tasksLive} />
      </QcSectionCard>

      <QcSectionCard
        section="translation"
        count={meta.translation.count}
        highlight={highlight === 'translation'}
        toggle={{
          on: translationWorkerOn,
          busy: busySection === 'translation',
          onToggle: toggleTranslation,
          title: translationWorkerOn ? t('queueCenter.sectionsToggle.workerOff') : t('queueCenter.sectionsToggle.workerOn'),
        }}>
        <PcTranslationQueuePanel refreshTick={tick} onMeta={onTranslationMeta} live={translationLive} />
      </QcSectionCard>

      <QcSectionCard
        section="wordAudio"
        count={wordPending}
        highlight={highlight === 'wordAudio'}>
        <PcTtsEnginesStrip />
        <PcPuterWordAudioBatchBar />
      </QcSectionCard>

      <QcSectionCard
        section="sentence"
        count={meta.sentence.count}
        highlight={highlight === 'sentence'}
        toggle={{
          on: sentenceOn,
          busy: busySection === 'sentence',
          onToggle: toggleSentence,
          title: sentenceOn ? t('queueCenter.sectionsToggle.sentenceOff') : t('queueCenter.sectionsToggle.sentenceOn'),
        }}>
        <PcSentenceQueuePanel refreshTick={tick} onMeta={onSentenceMeta} />
      </QcSectionCard>

      <QcSectionCard
        section="recent"
        count={meta.recent.count}
        highlight={highlight === 'recent'}>
        <PcRecentTasksPanel refreshTick={tick} onMeta={onRecentMeta} />
      </QcSectionCard>

      <PcCapabilityDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};

const PcQueueCenterPage: React.FC = () => (
  <QueueCenterHubProvider>
    <QueueCenterBody />
  </QueueCenterHubProvider>
);

export default PcQueueCenterPage;
