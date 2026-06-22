/**
 * Shared OCR / AI gateway / TTS pipeline status panels with loading + retry.
 * Used by PcVoiceSubtitlePage and PcAiStatusPage — data comes from usePcCapability().
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity, ScanText, Eye, Cpu, AudioLines, Loader2, RefreshCw, AlertTriangle,
  Languages, Mic, Play, Check, X,
} from 'lucide-react';
import { usePcCapability } from '../PcCapabilityContext';
import { pycoreApi } from '../../../core/api-libs/pycore';

type EngineTestResult = { success: boolean; latency_ms?: number; error?: string | null; text?: string };

/**
 * One-click live test for a single speech engine. Owns its own in-flight / result
 * state so each engine pill can be tested independently. On success it shows the
 * latency (+ recognized text for STT); on failure the error is in the tooltip.
 */
const EngineTestButton: React.FC<{ run: () => Promise<EngineTestResult>; disabled?: boolean }> = ({ run, disabled }) => {
  const [phase, setPhase] = React.useState<'idle' | 'run' | 'ok' | 'fail'>('idle');
  const [detail, setDetail] = React.useState('');
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhase('run');
    setDetail('');
    try {
      const r = await run();
      if (r.success) {
        setPhase('ok');
        setDetail(`${r.latency_ms ?? '?'}ms${r.text ? ` · "${(r.text || '').slice(0, 32)}"` : ''}`);
      } else {
        setPhase('fail');
        setDetail(r.error || 'failed');
      }
    } catch (err) {
      setPhase('fail');
      setDetail((err as Error)?.message || 'error');
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || phase === 'run'}
      title={detail || 'Run a live test'}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition disabled:opacity-40 ${
        phase === 'ok'
          ? 'bg-emerald-500/15 text-emerald-500'
          : phase === 'fail'
            ? 'bg-rose-500/15 text-rose-500'
            : 'pc-glass hover:bg-indigo-500/10 text-indigo-500'
      }`}>
      {phase === 'run' ? <Loader2 className="w-3 h-3 animate-spin" />
        : phase === 'ok' ? <Check className="w-3 h-3" />
          : phase === 'fail' ? <X className="w-3 h-3" />
            : <Play className="w-3 h-3" />}
      {phase === 'ok' && detail
        ? <span className="font-mono font-normal opacity-80">{detail}</span>
        : 'Test'}
    </button>
  );
};

const TIER_CLS: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-500',
  balance: 'bg-amber-500/15 text-amber-500',
  paid: 'bg-rose-500/15 text-rose-500',
};

const Dot: React.FC<{ ok: boolean; warn?: boolean }> = ({ ok, warn }) => (
  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
    warn ? 'bg-amber-500' : ok ? 'bg-emerald-500' : 'bg-slate-400/50'
  }`} />
);

const Pill: React.FC<{
  ok: boolean; label: string; version?: string; extra?: React.ReactNode; title?: string;
}> = ({ ok, label, version, extra, title }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
      ok
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
        : 'bg-slate-500/5 border-slate-400/15 text-slate-400 dark:text-slate-500'
    }`}>
    <Dot ok={ok} />
    {label}
    {version && <span className="opacity-60 font-mono">v{version}</span>}
    {extra}
  </span>
);

/** Inline loading / unavailable / retry for one pipeline row. */
const PanelStatus: React.FC<{
  data: unknown;
  loading: boolean;
  refreshing: boolean;
  initialized: boolean;
  error?: string;
  onRetry: () => void;
  label: string;
}> = ({ data, loading, refreshing, initialized, error, onRetry, label }) => {
  const { t } = useTranslation('pc');
  if (data) return null;
  if (!initialized || loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
        {t('pipeline.loading', { label })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1 text-[11px] italic text-slate-400">
        {refreshing
          ? <><Loader2 className="w-3 h-3 animate-spin" /> {t('pipeline.retrying')}</>
          : <><AlertTriangle className="w-3 h-3 text-amber-500/80" /> {t('pipeline.statusUnavailable', { label })}</>}
        {error && <span className="font-mono not-italic opacity-70">({error})</span>}
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={refreshing}
        title={t('pipeline.retryProbe', { label })}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold
                   pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        {t('common.retry')}
      </button>
    </span>
  );
};

export interface PcPipelineStatusPanelsProps {
  /** 'subtitle' — full Auto-Subtitle section with AI gateway; 'status' — OCR + TTS only. */
  variant: 'subtitle' | 'status';
  /** Screenshot interval shown in the subtitle header. */
  shotInterval?: number;
}

export const PcPipelineStatusPanels: React.FC<PcPipelineStatusPanelsProps> = ({
  variant,
  shotInterval = 60,
}) => {
  const { t } = useTranslation('pc');
  const {
    ocr, tts, stt, aiGateway, loading, refreshing, initialized, errors, retry,
  } = usePcCapability();

  const retryOne = () => { void retry(); };

  const ocrBody = (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ScanText className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('pipeline.ocrEngines')}</span>
        {ocr && (
          <span className="text-[10px] font-mono text-slate-400">
            {t('pipeline.best')}: <span className="text-emerald-500">{ocr.best ?? (variant === 'status' ? 'ai-vision' : 'ai-vision (fallback)')}</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {variant === 'subtitle' ? (
          <>
            {(ocr?.engines ?? []).map((e) => {
              const isBest = ocr?.best === e.name;
              return (
                <span
                  key={e.name}
                  title={e.note}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                    isBest
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : e.available
                        ? 'bg-slate-500/5 border-slate-400/20 text-slate-600 dark:text-slate-300'
                        : 'bg-slate-500/5 border-slate-400/10 text-slate-400 dark:text-slate-500'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${e.available ? 'bg-emerald-500' : 'bg-slate-400/50'}`} />
                  {e.name}
                  <span className="opacity-50 font-mono">#{e.priority}</span>
                  {isBest && <span className="text-[9px] font-bold uppercase">{t('pipeline.active')}</span>}
                </span>
              );
            })}
            <span
              title="Fallback: transcribe the screenshot with a vision AI provider when no local engine yields text."
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border bg-violet-500/5 border-violet-500/20 text-violet-500">
              <Eye className="w-3 h-3" /> ai-vision
              <span className="opacity-50 font-mono">{t('pipeline.fallback')}</span>
            </span>
          </>
        ) : (
          <>
            {(ocr?.engines ?? []).map((e) => (
              <Pill key={e.name} ok={e.available} label={e.name} title={e.note}
                    extra={<><span className="opacity-50 font-mono">#{e.priority}</span>{ocr?.best === e.name && <span className="text-[9px] font-bold uppercase">active</span>}</>} />
            ))}
            <Pill ok label="ai-vision" title={t('pipeline.aiVisionFallbackTitle')}
                  extra={<><Eye className="w-3 h-3" /><span className="opacity-50 font-mono">{t('pipeline.fallback')}</span></>} />
          </>
        )}
        <PanelStatus data={ocr} loading={loading} refreshing={refreshing}
                     initialized={initialized} error={errors.ocr} onRetry={retryOne} label="OCR" />
      </div>
    </div>
  );

  const aiBody = variant === 'subtitle' ? (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">AI providers</span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {(aiGateway?.providers ?? []).map((p) => {
          const cd = Math.round(p.cooldown_s);
          return (
            <span
              key={p.name}
              title={p.last_error ? `last error: ${p.last_error}` : (p.configured ? 'configured' : 'no API key')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                p.available
                  ? 'bg-slate-500/5 border-slate-400/20 text-slate-600 dark:text-slate-300'
                  : 'bg-slate-500/5 border-slate-400/10 text-slate-400 dark:text-slate-500'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                cd > 0 ? 'bg-amber-500' : p.available ? 'bg-emerald-500' : p.configured ? 'bg-rose-500' : 'bg-slate-400/50'
              }`} />
              {p.name}
              <span className={`px-1 rounded text-[9px] font-bold uppercase ${TIER_CLS[p.tier] ?? 'bg-slate-500/15 text-slate-500'}`}>
                {p.tier}
              </span>
              {p.vision && <Eye className="w-3 h-3 opacity-60" />}
              {cd > 0 && <span className="text-amber-500 font-mono">{cd}s</span>}
              {p.calls > 0 && <span className="opacity-50 font-mono">{p.ok}/{p.calls}</span>}
            </span>
          );
        })}
        <PanelStatus data={aiGateway} loading={loading} refreshing={refreshing}
                     initialized={initialized} error={errors.aiGateway} onRetry={retryOne} label="AI gateway" />
      </div>
    </div>
  ) : null;

  const ttsBody = (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <AudioLines className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {variant === 'status' ? t('pipeline.tts') : 'TTS engine'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {(tts?.providers ?? []).map((p) => (
          <span
            key={p.name}
            title={p.error ? `error: ${p.error}` : (p.available ? 'synthesis OK' : 'unknown')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
              p.available
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.available ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {p.name}-tts
            {p.version && <span className="opacity-60 font-mono">v{p.version}</span>}
            {p.proxy && <span className="text-[9px] font-bold uppercase opacity-70">proxy</span>}
            <span className="text-[9px] font-bold uppercase">{p.available ? 'up' : 'down'}</span>
          </span>
        ))}
        {tts && tts.providers.some((p) => !p.available && p.error?.includes('403')) && (
          <span className="text-[10px] text-rose-500/80 self-center">
            edge 403 — rate-limit / region block; set EDGE_TTS_PROXY{variant === 'subtitle' ? ' or wait out the cooldown' : ''}.
          </span>
        )}
        <PanelStatus data={tts} loading={loading} refreshing={refreshing}
                     initialized={initialized} error={errors.tts} onRetry={retryOne} label="TTS" />
      </div>
      {/* Full fallback chain with a per-engine live synth test. */}
      {(tts?.engines?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2 items-center mt-2">
          {(tts?.engines ?? []).map((e) => {
            const cd = Math.round(e.cooldown_remaining ?? 0);
            const isBest = tts?.best === e.name;
            return (
              <span
                key={e.name}
                title={e.note}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                  isBest
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : e.available
                      ? 'bg-slate-500/5 border-slate-400/20 text-slate-600 dark:text-slate-300'
                      : 'bg-slate-500/5 border-slate-400/10 text-slate-400 dark:text-slate-500'
                }`}>
                <Dot ok={e.available} warn={cd > 0} />
                {e.name}
                <span className="opacity-50 font-mono">#{e.priority}</span>
                {cd > 0 && <span className="text-amber-500 font-mono">{cd}s</span>}
                <EngineTestButton
                  disabled={!e.available}
                  run={() => pycoreApi.testTts({ engine: e.name }).then((r) => ({
                    success: r.success, latency_ms: r.latency_ms, error: r.error,
                  }))}
                />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );

  const sttBody = (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Mic className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {t('pipeline.sttEngines')}
        </span>
        {stt && (
          <span className="text-[10px] font-mono text-slate-400">
            {t('pipeline.best')}: <span className="text-emerald-500">{stt.best ?? '—'}</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {(stt?.engines ?? []).map((e) => {
          const isBest = stt?.best === e.name;
          const quotaBlocked = e.quota?.blocked;
          return (
            <span
              key={e.name}
              title={e.quota ? `${e.note} · ${e.quota.note}${quotaBlocked ? ' (quota exhausted)' : ''}` : e.note}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${
                isBest
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : e.available
                    ? 'bg-slate-500/5 border-slate-400/20 text-slate-600 dark:text-slate-300'
                    : 'bg-slate-500/5 border-slate-400/10 text-slate-400 dark:text-slate-500'
              }`}>
              <Dot ok={e.available} warn={quotaBlocked} />
              {e.name}
              <span className="opacity-50 font-mono">#{e.priority}</span>
              {e.quota && (
                <span className={`px-1 rounded text-[9px] font-bold uppercase ${
                  quotaBlocked ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'
                }`}>
                  {quotaBlocked ? 'quota' : 'free F0'}
                </span>
              )}
              <EngineTestButton
                disabled={!e.available}
                run={() => pycoreApi.testStt({ engine: e.name }).then((r) => ({
                  success: r.success, latency_ms: r.latency_ms, error: r.error, text: r.text,
                }))}
              />
            </span>
          );
        })}
        <PanelStatus data={stt} loading={loading} refreshing={refreshing}
                     initialized={initialized} error={errors.stt} onRetry={retryOne} label="STT" />
      </div>
    </div>
  );

  if (variant === 'subtitle') {
    return (
      <section className="pc-glass p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Activity className="w-4 h-4 text-indigo-500" /> Auto-Subtitle Pipeline
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">
              screenshot OCR → AI translate · every {shotInterval}s
            </span>
            <button
              type="button"
              onClick={retryOne}
              disabled={refreshing}
              title="Refresh pipeline status (forces fresh TTS probe)"
              className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {ocrBody}
        {aiBody}
        {ttsBody}
        {sttBody}
      </section>
    );
  }

  return (
    <>
      {ocrBody}
      {ttsBody}
      {sttBody}
    </>
  );
};

/** Free-library panel for Capability Status page — uses shared caps snapshot. */
export const PcFreeLibrariesPanel: React.FC = () => {
  const { t } = useTranslation('pc');
  const { caps, loading, refreshing, initialized, errors, retry } = usePcCapability();

  const CAT_META: Record<string, { label: string; Icon: React.FC<{ className?: string }> }> = {
    translate: { label: t('pipeline.translate'), Icon: Languages },
    tts: { label: t('pipeline.tts'), Icon: AudioLines },
    ocr: { label: t('pipeline.ocr'), Icon: ScanText },
    stt: { label: t('pipeline.stt'), Icon: Mic },
  };
  const CAT_ORDER = ['translate', 'tts', 'ocr', 'stt'];

  if (!caps) {
    if (!initialized || loading) {
      return (
        <p className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-indigo-400" /> {t('pipeline.loadingLibraries')}
        </p>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 flex-wrap">
        <span className="text-[11px] italic text-slate-400 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500/80" />
          {t('pipeline.librariesUnavailable')}
          {errors.caps && <span className="font-mono not-italic opacity-70">({errors.caps})</span>}
        </span>
        <button
          type="button"
          onClick={() => { void retry(); }}
          disabled={refreshing}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold
                     pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {CAT_ORDER.map((cat) => {
        const libs = caps.libraries.filter((l) => l.category === cat);
        if (libs.length === 0) return null;
        const meta = CAT_META[cat] ?? { label: cat, Icon: Languages };
        const { Icon } = meta;
        return (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Icon className="w-3.5 h-3.5 text-indigo-400" /> {meta.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {libs.map((l) => (
                <Pill key={l.name} ok={l.available} label={l.name}
                      version={l.version ?? undefined} title={l.note} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
