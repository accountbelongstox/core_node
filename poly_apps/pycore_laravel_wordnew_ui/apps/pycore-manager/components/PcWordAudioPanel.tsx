/**
 * Unified Word Audio panel. The Queue Center section switch is the only
 * worker control; this panel owns engine priority, concurrency and live logs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { pycoreApi, ttsConcurrencyAnnotation, ttsEngineUiState } from '@/apps/pycore-manager/api';
import type { TtsEngine, TtsStatus } from '@/apps/pycore-manager/api';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';
import { PcWordAudioLog, type PcWordAudioLogRow } from './PcWordAudioLog';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
const LOG_LIMIT = 1000;

export function PcWordAudioPanel(): JSX.Element {
  const hub = useQueueCenterHub();
  const [expanded, setExpanded] = useState(() => StorageManager.getRaw(StorageKeys.PYCORE_WORD_AUDIO_EXPANDED) === '1');
  const [engine, setEngine] = useState(() => StorageManager.getRaw(StorageKeys.PYCORE_WORD_AUDIO_ENGINE) || 'edge');
  const [concurrencyInput, setConcurrencyInput] = useState(
    () => StorageManager.getRaw(StorageKeys.PYCORE_WORD_TTS_CONCURRENCY) ?? '',
  );
  const [logClearedAt, setLogClearedAt] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const ttsRaw = hub.tts as TtsStatus | null;
  const engines: TtsEngine[] = Array.isArray(ttsRaw?.engines) ? ttsRaw.engines : [];
  const engineNames = useMemo(() => {
    const names = engines.map((item) => item.name);
    return names.includes('edge') ? names : ['edge', ...names];
  }, [engines]);
  const selected = engines.find((item) => item.name === engine) ?? null;
  const uiState = selected
    ? ttsEngineUiState(selected.installed, selected.available)
    : ttsRaw ? 'missing' : null;
  const serial = (selected?.concurrency ?? (engine === 'edge' ? 'serial' : undefined)) === 'serial';
  const concurrencyLabel = ttsConcurrencyAnnotation(selected?.concurrency, engine);
  /*
   * [gpt-5.3-codex-spark:LEGACY-START]
   * Old behavior read worker status from hub.controls.word_audio?.running and showed
   * worker state from `auto_start` + controls signals.
   * New behavior uses sectionContracts.word_audio for contract-aligned status.
   * // const workerOn = hub.voiceWord?.auto_start === true;
   // const workerRunning = hub.controls.word_audio?.running === true;
   // const heartbeatOn = worker?.heartbeat_enabled ?? hub.voiceWord?.heartbeat_enabled ?? false;
   * [gpt-5.3-codex-spark:LEGACY-END]
   */
  const wordSection = hub.sectionContracts.word_audio;
  const worker = hub.voiceWord?.worker;
  const workerOn = wordSection.toggle.enabled;
  const workerRunning = wordSection.lifecycle === 'on';
  const workerConfigured = workerOn && wordSection.lifecycle !== 'off';
  const heartbeatOn = wordSection.worker.online || worker?.heartbeat_enabled || false;
  const pending = hub.voiceWord?.laravel?.pending;
  const leased = hub.voiceWord?.laravel?.leased;
  const effectiveConcurrency = hub.voiceWord?.concurrency;
  const recommendedConcurrency = hub.voiceWord?.concurrency_recommended;

  const sectionWorkerLabel = workerOn
    ? (wordSection.lifecycle === 'starting' ? 'starting' : workerRunning ? 'running' : workerConfigured ? 'configured' : 'off')
    : 'off';

  useEffect(() => {
    if (engineNames.includes(engine)) return;
    const next = ttsRaw?.active && engineNames.includes(ttsRaw.active) ? ttsRaw.active : engineNames[0];
    if (!next) return;
    setEngine(next);
    StorageManager.setRaw(StorageKeys.PYCORE_WORD_AUDIO_ENGINE, next);
  }, [engine, engineNames, ttsRaw?.active]);

  const toggleExpanded = useCallback(() => {
    setExpanded((current) => {
      const next = !current;
      StorageManager.setRaw(StorageKeys.PYCORE_WORD_AUDIO_EXPANDED, next ? '1' : '0');
      return next;
    });
  }, []);

  const saveEngine = useCallback(async (next: string) => {
    setEngine(next);
    StorageManager.setRaw(StorageKeys.PYCORE_WORD_AUDIO_ENGINE, next);
    setActionError(null);
    try {
      const remaining = engines.map((item) => item.name).filter((name) => name !== next);
      await pycoreApi.saveCapabilitySettings('word_tts', { priority: [next, ...remaining] });
      await hub.refreshHub();
    } catch (error: any) {
      setActionError(error?.message || 'Engine priority save failed');
    }
  }, [engines, hub]);

  const saveConcurrency = useCallback((raw: string) => {
    setConcurrencyInput(raw);
    StorageManager.setRaw(StorageKeys.PYCORE_WORD_TTS_CONCURRENCY, raw);
    const value = Math.min(8, Math.max(0, Number.parseInt(raw, 10) || 0));
    setActionError(null);
    pycoreApi.setWordTtsConcurrency(value, workerOn)
      .then(() => hub.refreshHub())
      .catch((error: any) => setActionError(error?.message || 'Concurrency save failed'));
  }, [hub, workerOn]);

  const rows = useMemo<PcWordAudioLogRow[]>(() => (worker?.events ?? [])
    .map((event) => ({
      at: (event.at ?? 0) * 1000,
      kind: event.kind || 'event',
      text: event.text_preview || '',
      detail: event.detail,
      lang: event.language,
      playable: Boolean(event.text_preview && event.language && event.kind === 'ok'),
    }))
    .filter((row) => row.at > logClearedAt)
    .sort((left, right) => right.at - left.at)
    .slice(0, LOG_LIMIT), [logClearedAt, worker?.events]);

  const playRow = useCallback(async (row: PcWordAudioLogRow) => {
    if (!row.text || !row.lang) return;
    setActionError(null);
    try {
      const source = await pycoreApi.getWordAudioMediaDataUrl(row.text, row.lang);
      await new Audio(source).play();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'Word audio playback failed');
    }
  }, []);

  return (
    <div className="mb-3 rounded-lg border border-slate-700 bg-slate-900/80">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm font-semibold text-sky-300">🔊 Word Audio</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/20 text-violet-400">
          {engine}
        </span>
        <span className={`text-[10px] font-bold ${workerOn ? 'text-emerald-400' : 'text-slate-500'}`}>
          {workerOn ? `● worker · ${sectionWorkerLabel}` : 'worker · off'}
        </span>
        <span className="text-[10px] text-slate-500 truncate flex-1 min-w-0">
          Laravel pending {pending ?? '—'} · leased {leased ?? '—'}
        </span>
        <button type="button" onClick={toggleExpanded}
          className="shrink-0 rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-600">
          {expanded ? '▲ collapse' : '▼ expand'}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-700/60 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Engine</span>
            <select value={engine} onChange={(event) => void saveEngine(event.target.value)}
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200">
              {engineNames.map((name) => {
                const item = engines.find((candidate) => candidate.name === name);
                const annotation = ttsConcurrencyAnnotation(item?.concurrency, name);
                return <option key={name} value={name}>{name}{annotation ? ` — ${annotation}` : ''}</option>;
              })}
            </select>
            {uiState && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                uiState === 'ready'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : uiState === 'setup'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-600/40 text-slate-400'}`}>
                {uiState}
              </span>
            )}
            {selected?.server_engine && selected.server_running && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400">svc</span>
            )}
            {concurrencyLabel && <span className="text-[10px] font-mono text-slate-500">{concurrencyLabel}</span>}
            <label className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              concurrency
              <input type="text"
                value={serial ? '1' : concurrencyInput || (effectiveConcurrency ? String(effectiveConcurrency) : '')}
                placeholder={recommendedConcurrency ? String(recommendedConcurrency) : 'auto'}
                onChange={(event) => saveConcurrency(event.target.value)}
                disabled={serial}
                title={serial ? 'Serial engine — concurrency is fixed at 1' : '0 or empty uses the engine recommendation'}
                className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-200 disabled:opacity-50" />
            </label>
          </div>

        <div className="rounded border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-500 flex gap-2 flex-wrap">
          <span>pycore worker</span>
          <span className={heartbeatOn ? 'text-emerald-400' : 'text-slate-500'}>
            heartbeat {heartbeatOn ? 'on' : 'off'}
          </span>
          <span className="font-mono">
              claimed {wordSection.worker.claimed ?? 0} · ok {wordSection.worker.ok ?? 0} · fail {wordSection.worker.fail ?? 0}
          </span>
        </div>

          <p className="rounded border border-sky-700/40 bg-sky-950/20 px-2 py-1 text-[10px] text-sky-300/90">
            One Pycore worker claims canonical missing-audio rows from Laravel. Engine priority and concurrency apply to
            that worker; the section ON/OFF switch is its only lifecycle control.
          </p>
          {actionError && <p className="text-[10px] text-rose-400">{actionError}</p>}
          <PcWordAudioLog rows={rows} onClear={() => setLogClearedAt(Date.now())} onPlay={playRow} />
        </div>
      )}
    </div>
  );
}
