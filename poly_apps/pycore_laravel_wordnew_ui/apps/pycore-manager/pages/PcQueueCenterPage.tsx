/**
 * PcQueueCenterPage — single page of queue sections (no tabs).
 *
 * Every section is a card with a header row (icon, title, live count, and an
 * idempotent toggle switch where applicable) plus the existing panel component
 * as its body. One HTTP API snapshot drives the page; control mutations also use
 * HTTP API, followed by hub.refreshHub(). Legacy ?tab= links
 * scroll to the matching section anchor instead of switching tabs.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ListOrdered, RefreshCw, TimerReset, AlertTriangle, SlidersHorizontal,
} from 'lucide-react';
import {
  getPycoreHealth,
  PYCORE_HEALTH_EVENT,
  PYCORE_HTTP_DEFAULTS,
} from '@/apps/pycore-manager/api';
import PcTranslationQueuePanel from './PcTranslationQueuePage';
import PcSentenceQueuePanel from './PcSentenceQueuePanel';
import { PcWordAudioPanel } from '../components/PcWordAudioPanel';
import PcQueueOverviewPanel from './PcQueueOverviewPanel';
import PcRecentTasksPanel from './PcRecentTasksPanel';
import PcWorkerStatusStrip from '../components/PcWorkerStatusStrip';
import PcAssistStrip from '../components/PcAssistStrip';
import PcTtsEnginesStrip from '../components/PcTtsEnginesStrip';
import PcQueueBumpToasts from '../components/PcQueueBumpToasts';
import PcCapabilityDrawer from '../components/PcCapabilityDrawer';
import {
  QueueCenterHubProvider, useQueueCenterHub, workerEndpointMismatch,
} from '../hooks/useQueueCenterHub';
import {
  type QcSection,
  type QcSectionScope,
  type QueueSectionLifecycle,
  QC_DRAWER_KEY,
  QC_SECTION_DEFS, isQcSection, qcSectionAnchor,
} from '../utils/pcQueueCenterTypes';
import { StorageManager } from '../../../core/persistence';

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
    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-slate-400/40'
      }`}>
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${on ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`} />
  </button>
);

interface QcSectionCardProps {
  section: QcSection;
  count: number | null;
  highlight: boolean;
  toggle?: {
    enabled: boolean;
    lifecycle: QueueSectionLifecycle;
    pausedByUser: boolean;
    gracefulStop: boolean;
    busy: boolean;
    onToggle: () => void;
    title: string;
  };
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
  const stateLabel = (() => {
    if (!toggle) return '';
    if (toggle.gracefulStop) return 'stopping';
    if (toggle.pausedByUser) return 'paused';
    switch (toggle.lifecycle) {
      case 'on':
        return 'running';
      case 'starting':
        return 'starting';
      case 'error':
        return 'error';
      default:
        return t('queueCenter.autoOff');
    }
  })();

  return (
    <section
      id={qcSectionAnchor(section)}
      className={`pc-glass p-4 space-y-4 scroll-mt-6 transition ${highlight ? 'ring-2 ring-indigo-400/70' : ''
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
              <QcSectionSwitch on={toggle.enabled} busy={toggle.busy} onToggle={toggle.onToggle} title={toggle.title} />
              <span className={`text-[10px] font-bold uppercase tracking-wide ${toggle.lifecycle === 'on' ? 'text-emerald-500' : toggle.lifecycle === 'error' ? 'text-rose-500' : toggle.enabled ? 'text-amber-500' : 'text-slate-400'
                }`}>
                {stateLabel}
              </span>
            </>
          )}
        </div>
      </div>
      {children}
    </section>
  );
};

/** Page body — one page-scoped hub drives every Queue Center section. */
const QueueCenterBody: React.FC = () => {
  const { t } = useTranslation('pc');
  const hub = useQueueCenterHub();
  const auto = hub.autoRefresh;
  const setAuto = hub.setAutoRefresh;
  const [searchParams] = useSearchParams();
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const [drawerOpen, setDrawerOpen] = useState(() => StorageManager.getRaw(QC_DRAWER_KEY) === '1');
  useEffect(() => { StorageManager.setRaw(QC_DRAWER_KEY, drawerOpen ? '1' : '0'); }, [drawerOpen]);

  const sectionContracts = hub.sectionContracts;
  const endpointMismatch = workerEndpointMismatch(hub);
  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * Prior approach aggregated section badges in child callbacks:
   * onMeta->(count/loading) from PcQueueOverview/PcTranslation/PcSentence/PcRecent.
   * The page now reads all counters from shared sectionContracts only.
   * [gpt-5.3-codex-spark:LEGACY-END]
   */
  const overviewCount = (hub.overview?.categories ?? []).reduce(
    (sum, category) => sum + (category.pending ?? 0),
    0,
  );
  const translationCount = sectionContracts.assist_translation.queue.pending;
  const wordPending = sectionContracts.word_audio.queue.pending;
  const sentenceCount = sectionContracts.sentence_audio.queue.pending;

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
  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * Previous logic tracked busy by section row (`overview`/`translation`/etc.),
   * so both assist and translation switches could run concurrently.
   * Current logic tracks busy by unified scope (`assist_translation`, `word_audio`,
   * `sentence_audio`) to avoid scope races.
   * [gpt-5.3-codex-spark:LEGACY-END]
   */
  const [busyScope, setBusyScope] = useState<Partial<Record<QcSectionScope, boolean>>>({});
  const [toggleError, setToggleError] = useState<string | null>(null);
  const runToggle = useCallback(async (scope: QcSectionScope, caller: string, fn: () => Promise<unknown>) => {
    if (busyScope[scope]) return;
    setBusyScope((current) => ({ ...current, [scope]: true }));
    setToggleError(null);
    try {
      await fn();
    } catch (e: any) {
      if (mounted.current) setToggleError(`${caller}: ${e?.message || 'control update failed'}`);
    } finally {
      if (mounted.current) setBusyScope((current) => ({ ...current, [scope]: false }));
    }
  }, [busyScope]);

  // Unified assistant/translation lifecycle and toggle state now always comes from one
  // shared section contract to avoid duplicate ON/OFF behavior in two cards.
  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * Previous page logic tracked `assistOn` and `translationWorkerOn` separately.
   * In practice both were read from the same backend contract (`assist_translation`)
   * and could temporarily diverge in the UI.
   * New behavior uses one canonical view for both cards.
   * [gpt-5.3-codex-spark:LEGACY-END]
   */
  const assistContract = sectionContracts.assist_translation;
  const translationContract = sectionContracts.assist_translation;
  const sentenceContract = sectionContracts.sentence_audio;
  const wordAudioContract = sectionContracts.word_audio;

  const assistTranslationOn = assistContract.toggle.enabled;
  const sentenceOn = sentenceContract.toggle.enabled;
  const wordAudioOn = wordAudioContract.toggle.enabled;

  const toggleAssistTranslation = useCallback(
    /*
     * [gpt-5.3-codex-spark:LEGACY-START]
     * Old calls toggled `assist`, which then needed alias handling.
     * Directly call canonical `assist_translation` for clearer, idempotent scope updates.
     * [gpt-5.3-codex-spark:LEGACY-END]
     */
    () => runToggle('assist_translation', 'assist+translation', () => hub.setControl('assist_translation', !assistTranslationOn)),
    [runToggle, assistTranslationOn, hub]);
  const toggleSentence = useCallback(
    () => runToggle('sentence_audio', 'sentence', () => hub.setControl('sentence_audio', !sentenceOn)),
    [runToggle, sentenceOn]);
  const toggleWordAudio = useCallback(
    () => runToggle('word_audio', 'wordAudio', () => hub.setControl('word_audio', !wordAudioOn)),
    [runToggle, wordAudioOn]);

  const [pycoreUp, setPycoreUp] = useState<boolean | null>(() => getPycoreHealth().up);
  useEffect(() => {
    const sync = () => setPycoreUp(getPycoreHealth().up);
    sync();
    window.addEventListener(PYCORE_HEALTH_EVENT, sync);
    return () => window.removeEventListener(PYCORE_HEALTH_EVENT, sync);
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PcQueueBumpToasts />
      {pycoreUp === false && (
        <section className="pc-glass p-3 text-xs text-rose-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t('queueCenter.overview.unavailable')}</span>
        </section>
      )}
      {toggleError && (
        <section className="pc-glass p-3 text-xs text-rose-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{toggleError}</span>
        </section>
      )}
      {hub.error && pycoreUp !== false && (
        <section className="pc-glass p-3 text-xs text-amber-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Queue Center partial snapshot: {hub.error}</span>
        </section>
      )}
      {endpointMismatch && (
        <section className="pc-glass p-3 text-xs text-amber-500 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {t('queueCenter.endpointMismatch')}
            <span className="ml-1 font-mono text-[10px] text-slate-500">
              ({hub.workerApiUrl} → {hub.laravelActiveEndpoint})
            </span>
          </span>
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
            onClick={() => setAuto(!auto)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${auto
              ? 'bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30'
              : 'pc-glass text-slate-500 hover:bg-slate-200/40 dark:hover:bg-white/5'
              }`}
            title={auto ? t('queueCenter.autoOnTitle', { sec: PYCORE_HTTP_DEFAULTS.fallbackPollMs / 1000 }) : t('queueCenter.autoOffTitle')}>
            <TimerReset className="w-3.5 h-3.5" />
            {t('queueCenter.auto')} {auto ? t('queueCenter.autoOn') : t('queueCenter.autoOff')}
          </button>
          <button
            onClick={() => { void hub.refreshHub(); }}
            disabled={hub.loading}
            className="p-2 rounded-xl pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50"
            title={t('queueCenter.refreshActive')}>
            <RefreshCw className={`w-4 h-4 ${hub.loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${drawerOpen
              ? 'bg-indigo-500/15 text-indigo-500 ring-1 ring-inset ring-indigo-500/30'
              : 'pc-glass text-slate-500 hover:bg-indigo-500/10 hover:text-indigo-500'
              }`}
            title={t('queueCenter.drawer.openTitle')}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {t('queueCenter.drawer.open')}
          </button>
        </div>
      </div>

      <QcSectionCard
        section="overview"
        count={overviewCount}
        highlight={highlight === 'overview'}
        toggle={{
          enabled: assistContract.toggle.enabled,
          lifecycle: assistContract.lifecycle,
          pausedByUser: assistContract.toggle.paused_by_user ?? false,
          gracefulStop: assistContract.toggle.graceful_stop,
          busy: busyScope.assist_translation === true,
          onToggle: toggleAssistTranslation,
          title: assistContract.toggle.enabled
            ? t('queueCenter.sectionsToggle.assistOff')
            : t('queueCenter.sectionsToggle.assistOn'),
        }}>
        <PcAssistStrip />
        <PcWorkerStatusStrip />
        <PcQueueOverviewPanel />
      </QcSectionCard>

      <QcSectionCard
        section="translation"
        count={translationCount}
        highlight={highlight === 'translation'}
        toggle={{
          enabled: translationContract.toggle.enabled,
          lifecycle: translationContract.lifecycle,
          pausedByUser: translationContract.toggle.paused_by_user ?? false,
          gracefulStop: translationContract.toggle.graceful_stop,
          busy: busyScope.assist_translation === true,
          onToggle: toggleAssistTranslation,
          title: translationContract.toggle.enabled ? t('queueCenter.sectionsToggle.workerOff') : t('queueCenter.sectionsToggle.workerOn'),
        }}>
        <PcTranslationQueuePanel />
      </QcSectionCard>

      <QcSectionCard
        section="wordAudio"
        count={wordPending}
        highlight={highlight === 'wordAudio'}
        toggle={{
          enabled: wordAudioContract.toggle.enabled,
          lifecycle: wordAudioContract.lifecycle,
          pausedByUser: wordAudioContract.toggle.paused_by_user ?? false,
          gracefulStop: wordAudioContract.toggle.graceful_stop,
          busy: busyScope.word_audio === true,
          onToggle: toggleWordAudio,
          title: wordAudioContract.toggle.enabled ? t('queueCenter.sectionsToggle.wordAudioOff') : t('queueCenter.sectionsToggle.wordAudioOn'),
        }}>
        <PcTtsEnginesStrip />
        <PcWordAudioPanel />
      </QcSectionCard>

      <QcSectionCard
        section="sentence"
        count={sentenceCount}
        highlight={highlight === 'sentence'}
        toggle={{
          enabled: sentenceContract.toggle.enabled,
          lifecycle: sentenceContract.lifecycle,
          pausedByUser: sentenceContract.toggle.paused_by_user ?? false,
          gracefulStop: sentenceContract.toggle.graceful_stop,
          busy: busyScope.sentence_audio === true,
          onToggle: toggleSentence,
          title: sentenceContract.toggle.enabled ? t('queueCenter.sectionsToggle.sentenceOff') : t('queueCenter.sectionsToggle.sentenceOn'),
        }}>
        <PcSentenceQueuePanel />
      </QcSectionCard>

      <QcSectionCard
        section="recent"
        count={null}
        highlight={highlight === 'recent'}>
        <PcRecentTasksPanel />
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
