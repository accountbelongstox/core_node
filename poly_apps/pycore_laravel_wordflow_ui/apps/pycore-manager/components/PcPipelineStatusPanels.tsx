/**
 * Shared OCR / AI gateway / TTS pipeline status panels with loading + retry.
 * Used by PcVoiceSubtitlePage and PcAiStatusPage — data comes from usePcCapability().
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity, ScanText, Eye, Cpu, AudioLines, Loader2, RefreshCw, AlertTriangle,
  Languages, Mic, Play,
} from 'lucide-react';
import { usePycoreCapability, ttsEngineUiState } from '../../../core/api-libs/pycore';
import { PcTtsServerControls } from './PcTtsServerControls';
import { usePcTestPopup } from './PcTestPopupContext';
import type { PcTestKind, PcTestPopupState } from './PcTestPopup';

/**
 * "Test" pill: opens the unified floating test popup (PcTestPopup) for one
 * engine/provider. Replaces the old one-click silent run - the popup owns the
 * editable inputs, the live timer, and the result rendering.
 */
const TestChip: React.FC<{
  kind: PcTestKind;
  target: string;
  defaults?: PcTestPopupState['defaults'];
  disabled?: boolean;
}> = ({ kind, target, defaults, disabled }) => {
  const { openTest } = usePcTestPopup();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); openTest(kind, target, defaults); }}
      title="Open the test popup"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition disabled:opacity-40 pc-glass hover:bg-indigo-500/10 text-indigo-500"
    >
      <Play className="w-3 h-3" /> Test
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
  model?: string; installed?: boolean;
}> = ({ ok, label, version, extra, title, model, installed }) => {
  const uiState = ttsEngineUiState(installed ?? ok, ok);
  const pillClass =
    uiState === 'ready'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
      : uiState === 'setup'
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
        : 'bg-slate-500/5 border-slate-400/15 text-slate-400 dark:text-slate-500';
  const dotOk = uiState === 'ready';
  return (
  <span
    title={title}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${pillClass}`}>
    <Dot ok={dotOk} />
    {label}
    {version && <span className="opacity-60 font-mono">v{version}</span>}
    {model && <span className="opacity-50 font-mono">{model}</span>}
    {uiState === 'setup' && <span className="text-[9px] font-bold uppercase opacity-70">setup</span>}
    {extra}
  </span>
  );
};

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
    ocr, tts, stt, aiGateway, caps, loading, refreshing, initialized, errors, retry,
  } = usePycoreCapability();

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
                  {e.version && <span className="opacity-60 font-mono">v{e.version}</span>}
                  <span className="opacity-50 font-mono">#{e.priority}</span>
                  {isBest && <span className="text-[9px] font-bold uppercase">{t('pipeline.active')}</span>}
                  <TestChip kind="ocr" target={e.name} disabled={!e.available}
                    defaults={{ version: e.version ?? undefined, note: e.note ?? undefined }} />
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
              <Pill key={e.name} ok={e.available} label={e.name} version={e.version ?? undefined} title={e.note}
                    extra={<><span className="opacity-50 font-mono">#{e.priority}</span>{ocr?.best === e.name && <span className="text-[9px] font-bold uppercase">active</span>}<TestChip kind="ocr" target={e.name} disabled={!e.available} defaults={{ version: e.version ?? undefined, note: e.note ?? undefined }} /></>} />
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
        {tts && (
          <span className="text-[10px] font-mono text-slate-400">
            {t('pipeline.best')}: <span className="text-emerald-500">{tts.best ?? '—'}</span>
            {tts.active && tts.active !== tts.best && (
              <> · {t('pipeline.active')}: <span className="text-emerald-500">{tts.active}</span></>
            )}
          </span>
        )}
      </div>
      <PcTtsServerControls engines={tts?.engines ?? []} onChanged={retryOne} />
      <div className="flex flex-wrap gap-2 items-center">
        {(tts?.engines ?? []).map((e) => {
          const cd = Math.round(e.cooldown_remaining ?? 0);
          const isActive = tts?.active === e.name;
          const isEdge = e.name === 'edge';
          const uiState = ttsEngineUiState(e.installed, e.available);
          const edgeTitle = isEdge
            ? [e.note, e.probe_error ? `probe: ${e.probe_error}` : null].filter(Boolean).join(' · ')
            : [e.note, e.disabled_reason].filter(Boolean).join(' — ') || e.note;
          const chipClass =
            isActive
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : uiState === 'ready'
                ? 'bg-slate-500/5 border-slate-400/20 text-slate-600 dark:text-slate-300'
                : uiState === 'setup'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-500/5 border-slate-400/10 text-slate-400 dark:text-slate-500';
          const dotWarn = cd > 0 || (isEdge && e.live_available === false);
          const dotOk = uiState === 'ready' && !dotWarn;
          return (
            <span
              key={e.name}
              title={edgeTitle}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${chipClass}`}>
              <Dot ok={dotOk} warn={uiState === 'setup' || dotWarn} />
              {e.name}
              {e.version && <span className="opacity-60 font-mono">v{e.version}</span>}
              {e.model && <span className="opacity-50 font-mono">{e.model}</span>}
              <span className="opacity-50 font-mono">#{e.priority}</span>
              {uiState === 'setup' && (
                <span className="text-[9px] font-bold uppercase opacity-80">setup</span>
              )}
              {uiState === 'missing' && (
                <span className="text-[9px] font-bold uppercase opacity-60">missing</span>
              )}
              {e.server_engine && e.server_running && (
                <span className="text-[9px] font-bold uppercase text-emerald-500/90">
                  {e.server_managed ? 'svc' : 'up'}
                </span>
              )}
              {!e.server_engine && e.model_loaded && (
                <span className="text-[9px] font-bold uppercase text-emerald-500/90">
                  {t('pipeline.ttsModelLoaded')}
                </span>
              )}
              {!e.server_engine && e.model_loaded && typeof e.model_idle_remaining_s === 'number' && (
                <span className="font-mono text-amber-600">{Math.ceil(e.model_idle_remaining_s)}s</span>
              )}
              {isEdge && e.proxy && (
                <span className="text-[9px] font-bold uppercase opacity-70">proxy</span>
              )}
              {isEdge && e.probe_pending && (
                <Loader2 className="w-3 h-3 animate-spin opacity-60" />
              )}
              {isEdge && e.live_available === true && (
                <span className="text-[9px] font-bold uppercase text-emerald-500">up</span>
              )}
              {isEdge && e.live_available === false && !e.probe_pending && (
                <span className="text-[9px] font-bold uppercase text-rose-500">down</span>
              )}
              {cd > 0 && <span className="text-amber-500 font-mono">{cd}s</span>}
              {isActive && <span className="text-[9px] font-bold uppercase">{t('pipeline.active')}</span>}
              <TestChip
                kind="tts"
                target={e.name}
                disabled={!(e.available || (e.server_engine && e.installed && e.server_enabled !== false))}
                defaults={{
                  model: e.model ?? undefined,
                  version: e.version ?? undefined,
                  note: e.note ?? undefined,
                  model_loaded: e.model_loaded,
                  cooldown_remaining: cd > 0 ? cd : undefined,
                  live_available: isEdge ? e.live_available : undefined,
                  server_running: e.server_running,
                }}
              />
            </span>
          );
        })}
        {tts?.engines?.some((e) => e.name === 'edge' && e.probe_error?.includes('403')) && (
          <span className="text-[10px] text-rose-500/80 self-center">
            edge 403 — rate-limit / region block; set EDGE_TTS_PROXY{variant === 'subtitle' ? ' or wait out the cooldown' : ''}.
          </span>
        )}
        <PanelStatus data={tts} loading={loading} refreshing={refreshing}
                     initialized={initialized} error={errors.tts} onRetry={retryOne} label="TTS" />
      </div>
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
              {e.version && <span className="opacity-60 font-mono">v{e.version}</span>}
              {e.model && <span className="opacity-50 font-mono">{e.model}</span>}
              <span className="opacity-50 font-mono">#{e.priority}</span>
              {e.quota && (
                <span className={`px-1 rounded text-[9px] font-bold uppercase ${
                  quotaBlocked ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'
                }`}>
                  {quotaBlocked ? 'quota' : 'free F0'}
                </span>
              )}
              {e.model_loaded && (
                <span className="text-[9px] font-bold uppercase text-emerald-500/90">
                  {t('pipeline.ttsModelLoaded')}
                </span>
              )}
              {e.model_loaded && typeof e.model_idle_remaining_s === 'number' && (
                <span className="font-mono text-amber-600">{Math.ceil(e.model_idle_remaining_s)}s</span>
              )}
              <TestChip kind="stt" target={e.name} disabled={!e.available}
                defaults={{
                  model: e.model ?? undefined,
                  version: e.version ?? undefined,
                  note: e.note ?? undefined,
                  model_loaded: e.model_loaded,
                  quota: e.quota ? { tier: 'free F0', blocked: e.quota.blocked, note: e.quota.note } : undefined,
                }} />
            </span>
          );
        })}
        <PanelStatus data={stt} loading={loading} refreshing={refreshing}
                     initialized={initialized} error={errors.stt} onRetry={retryOne} label="STT" />
      </div>
    </div>
  );

  const LIB_CAT_META: Record<string, { label: string; Icon: React.FC<{ className?: string }> }> = {
    translate: { label: t('pipeline.translate'), Icon: Languages },
    stt: { label: t('pipeline.stt'), Icon: Mic },
    tts: { label: t('pipeline.tts'), Icon: AudioLines },
    ocr: { label: t('pipeline.ocr'), Icon: ScanText },
  };
  const LIB_CAT_ORDER = ['translate', 'stt', 'tts', 'ocr'];

  const librariesBody = caps ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Languages className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {t('pipeline.libraries')}
        </span>
        <span className="text-[10px] text-slate-400">{t('pipeline.librariesHint')}</span>
      </div>
      {LIB_CAT_ORDER.map((cat) => {
        const libs = caps.libraries.filter((l) => l.category === cat);
        if (libs.length === 0) return null;
        const meta = LIB_CAT_META[cat] ?? { label: cat, Icon: Languages };
        const { Icon } = meta;
        return (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <Icon className="w-3.5 h-3.5 text-indigo-400" /> {meta.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {libs.map((l) => {
                const tierTitle = [
                  l.note,
                  l.model_active && `${t('pipeline.modelTier')}: ${l.model_active}`,
                  l.model_gpu && `GPU: ${l.model_gpu}`,
                  l.model_cpu && `CPU: ${l.model_cpu}`,
                  l.env && l.env,
                ].filter(Boolean).join(' · ');
                return (
                  <Pill
                    key={`${cat}-${l.name}`}
                    ok={l.available}
                    installed={l.installed}
                    label={l.name}
                    version={l.version ?? undefined}
                    model={l.model_active ?? undefined}
                    title={tierTitle}
                    extra={l.kind === 'api' ? (
                      <span className="text-[9px] font-bold uppercase opacity-60">api</span>
                    ) : undefined}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <PanelStatus data={caps} loading={loading} refreshing={refreshing}
                 initialized={initialized} error={errors.caps} onRetry={retryOne} label="Libraries" />
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
        {librariesBody}
        {ttsBody}
        {sttBody}
      </section>
    );
  }

  return (
    <>
      {ocrBody}
      {librariesBody}
      {ttsBody}
      {sttBody}
    </>
  );
};
