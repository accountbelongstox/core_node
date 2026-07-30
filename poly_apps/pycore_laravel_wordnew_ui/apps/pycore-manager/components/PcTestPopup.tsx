/**
 * PcTestPopup - per-capability floating test windows (TTS / STT / AI / OCR).
 *
 * Each kind has its own visual theme, helper copy, and result layout. Form
 * fields are RENDERED DYNAMICALLY from per-engine profiles in
 * PcTestEngineProfiles.ts — no more hardcoded per-kind forms.
 *
 * Opened via usePcTestPopup().openTest() from pipeline engine "Test" chips.
 *
 * Timeout copy reflects each engine's class (qwen3tts is a class-C isolated-venv
 * HTTP server whose first start builds the venv + loads the model). Presentational
 * only — the lifecycle rules live in the spec, not here.
 * Ref: apps/pycore-manager/docs/TTS_STT_ENGINE_LIFECYCLE.md §3 and
 * development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Play, Loader2, Check, Copy, Upload, RefreshCw, Mic, AudioLines,
  ScanText, Cpu, Clock, Image as ImageIcon, AlertTriangle, ArrowRight,
} from 'lucide-react';
import Portal from '../../../components/shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';
import { pycoreApi, usePcEngineLoadStatus } from '../../../core/api-libs/pycore';
import { PcBlobAudio } from './PcBlobMedia';
import type {
  TtsTestResponse, SttTestResponse, OcrTestResponse, AiChatResponse,
  EngineLoadStatusEntry,
} from '../../../core/api-libs/pycore/pycoreTypes';
import {
  getTestEngineProfile, getTestFormFields,
  type PcTestFormField, type PcTestEngineProfile,
} from './PcTestEngineProfiles';

export type PcTestKind = 'tts' | 'stt' | 'ai' | 'ocr';

export interface PcTestPopupState {
  kind: PcTestKind;
  target: string;
  defaults?: {
    text?: string;
    language?: string;
    rate?: string;
    message?: string;
    model?: string;
    lang?: string;
    version?: string;
    note?: string;
    model_loaded?: boolean;
    /** Per-engine quota / status info from the capability panel. */
    quota?: { tier?: string; blocked?: boolean; note?: string };
    server_running?: boolean;
    cooldown_remaining?: number;
    live_available?: boolean;
  };
}

type Phase = 'idle' | 'run' | 'ok' | 'fail';
type AnyResult = TtsTestResponse | SttTestResponse | OcrTestResponse | AiChatResponse;

interface KindTheme {
  Icon: React.FC<{ className?: string }>;
  label: string;
  accent: string;
  accentBg: string;
  border: string;
  headerGrad: string;
  btn: string;
  ring: string;
  subtitle: string;
  route: (target: string) => string;
}

const KIND_THEME: Record<PcTestKind, KindTheme> = {
  tts: {
    Icon: AudioLines,
    label: 'TTS',
    accent: 'text-indigo-500',
    accentBg: 'bg-indigo-500/10',
    border: 'border-indigo-500/25',
    headerGrad: 'from-indigo-500/12 via-violet-500/6 to-transparent',
    btn: 'bg-indigo-500 hover:bg-indigo-600',
    ring: 'focus:ring-indigo-500/30 focus:border-indigo-400/50',
    subtitle: 'Synthesize speech with this engine. Output is an audio clip.',
    route: () => 'local.tts.test',
  },
  stt: {
    Icon: Mic,
    label: 'STT',
    accent: 'text-sky-500',
    accentBg: 'bg-sky-500/10',
    border: 'border-sky-500/25',
    headerGrad: 'from-sky-500/12 via-cyan-500/6 to-transparent',
    btn: 'bg-sky-500 hover:bg-sky-600',
    ring: 'focus:ring-sky-500/30 focus:border-sky-400/50',
    subtitle: 'Round-trip: synthesize your phrase, then recognize it with this engine.',
    route: () => 'local.stt.test',
  },
  ai: {
    Icon: Cpu,
    label: 'AI',
    accent: 'text-fuchsia-500',
    accentBg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/25',
    headerGrad: 'from-fuchsia-500/12 via-pink-500/6 to-transparent',
    btn: 'bg-fuchsia-500 hover:bg-fuchsia-600',
    ring: 'focus:ring-fuchsia-500/30 focus:border-fuchsia-400/50',
    subtitle: 'One chat turn to this provider (not TTS/STT).',
    route: (target) => target === 'auto'
      ? 'local.ai.chat (provider=auto)'
      : `local.ai.chat (${target})`,
  },
  ocr: {
    Icon: ScanText,
    label: 'OCR',
    accent: 'text-emerald-500',
    accentBg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    headerGrad: 'from-emerald-500/12 via-teal-500/6 to-transparent',
    btn: 'bg-emerald-500 hover:bg-emerald-600',
    ring: 'focus:ring-emerald-500/30 focus:border-emerald-400/50',
    subtitle: 'Recognize text from an uploaded image or rendered sample.',
    route: () => 'local.ocr.test',
  },
};

// ---- OCR helpers -----------------------------------------------------------

function renderTextToPng(text: string): string {
  if (typeof document === 'undefined') return '';
  const W = 520, H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111111';
  ctx.font = '30px sans-serif';
  ctx.textBaseline = 'top';
  text.split('\n').forEach((ln, i) => ctx.fillText(ln, 18, 16 + i * 40));
  return canvas.toDataURL('image/png');
}

// ---- Dynamic form renderer -------------------------------------------------

function fieldDefault(field: PcTestFormField, defaults: PcTestPopupState['defaults']): string {
  // Map known defaults keys to form field keys.
  const DEFAULT_MAP: Record<string, string | undefined> = {
    text: defaults?.text,
    language: defaults?.language,
    rate: defaults?.rate,
    model: defaults?.model,
    lang: defaults?.lang,
    message: defaults?.message,
  };
  if (DEFAULT_MAP[field.key] !== undefined) return DEFAULT_MAP[field.key]!;
  return field.defaultValue ?? '';
}

const DynamicTestForm: React.FC<{
  fields: PcTestFormField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  inputCls: string;
  kind: PcTestKind;
  ocrThumb: string;
  ocrOverride: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  resetOcrSample: () => void;
  t: (key: string) => string;
}> = ({ fields, values, onChange, inputCls, kind, ocrThumb, ocrOverride, fileInputRef, onFile, resetOcrSample, t }) => (
  <div className="space-y-3">
    {fields.map((field) => {
      const val = values[field.key] ?? '';
      if (field.type === 'textarea') {
        return (
          <Field key={field.key} label={field.label} hint={field.hint}>
            <textarea value={val} onChange={(e) => onChange(field.key, e.target.value)}
              rows={field.rows ?? 3} className={inputCls} placeholder={field.placeholder} />
          </Field>
        );
      }
      if (field.type === 'select' && field.options) {
        return (
          <Field key={field.key} label={field.label} hint={field.hint}>
            <select value={val} onChange={(e) => onChange(field.key, e.target.value)} className={inputCls}>
              {field.options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>
        );
      }
      if (field.type === 'number') {
        return (
          <Field key={field.key} label={field.label} hint={field.hint}>
            <input type="number" value={val} onChange={(e) => onChange(field.key, e.target.value)}
              min={field.min} max={field.max} step={field.step}
              placeholder={field.placeholder} className={inputCls} />
          </Field>
        );
      }
      // Default: text input
      return (
        <Field key={field.key} label={field.label} hint={field.hint}>
          <input value={val} onChange={(e) => onChange(field.key, e.target.value)}
            placeholder={field.placeholder} className={inputCls} />
        </Field>
      );
    })}
    {/* OCR-specific image controls below the form fields */}
    {kind === 'ocr' && (
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold pc-glass hover:bg-emerald-500/10 text-emerald-500 inline-flex items-center gap-1">
          <Upload className="w-3.5 h-3.5" /> {t('testPopup.upload')}
        </button>
        {ocrOverride && (
          <button type="button" onClick={resetOcrSample}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold pc-glass hover:bg-slate-500/10 text-slate-500 inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> {t('testPopup.resetSample')}
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
    )}
    {/* OCR preview image */}
    {kind === 'ocr' && ocrThumb && (
      <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-white flex items-center justify-center min-h-[80px]">
        <img src={ocrThumb} alt="OCR input" className="block max-h-48 w-auto" />
      </div>
    )}
  </div>
);

// ---- Main popup ------------------------------------------------------------

interface PcTestPopupProps {
  state: PcTestPopupState;
  onClose: () => void;
}

export const PcTestPopup: React.FC<PcTestPopupProps> = ({ state, onClose }) => {
  const { t } = useTranslation('pc');
  const { kind, target, defaults } = state;
  const baseTheme = KIND_THEME[kind];
  const engineProfile = getTestEngineProfile(kind, target);
  const theme: KindTheme = engineProfile
    ? { ...baseTheme, ...engineProfile }
    : baseTheme;
  const { Icon } = theme;

  // Dynamic form fields from the engine profile.
  const formFields = useMemo(
    () => getTestFormFields(kind, target),
    [kind, target],
  );

  // Form values keyed by field.key.
  const buildInitialValues = useCallback((): Record<string, string> => {
    const vals: Record<string, string> = {};
    for (const f of formFields) {
      vals[f.key] = fieldDefault(f, defaults);
    }
    return vals;
  }, [formFields, defaults]);
  const [formValues, setFormValues] = useState<Record<string, string>>(buildInitialValues);

  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<AnyResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [latencyS, setLatencyS] = useState<number | null>(null);
  const t0Ref = useRef(0);

  // Live model-load progress for this engine while a test runs. Only class-B/-C
  // speech engines (TTS/STT) report a load; cloud/CLI (AI/OCR-vision) never do, so
  // gate polling to those kinds and fall back to the static wait copy otherwise.
  const engineLoadRelevant = (kind === 'tts' || kind === 'stt') && phase === 'run';
  const { getEngine } = usePcEngineLoadStatus(engineLoadRelevant);
  const loadStatus = (kind === 'tts' || kind === 'stt') ? getEngine(target) : null;

  // OCR-specific state (image data is separate from form values).
  const [ocrThumb, setOcrThumb] = useState<string>(() =>
    renderTextToPng(formValues.ocrText ?? 'Hello OCR 123\n你好世界'));
  const [ocrOverride, setOcrOverride] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const inputCls = `w-full rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 ${theme.ring}`;

  // Reset form when kind/target changes.
  useEffect(() => {
    const vals = buildInitialValues();
    setFormValues(vals);
    const ocrText = vals.ocrText ?? 'Hello OCR 123\n你好世界';
    setOcrOverride(null);
    setOcrThumb(renderTextToPng(ocrText));
    setPhase('idle');
    setResult(null);
    setRunError(null);
    setLatencyS(null);
    setElapsed(0);
  }, [kind, target, defaults?.text, defaults?.language, defaults?.rate, defaults?.message, defaults?.model, defaults?.lang, buildInitialValues]);

  // Live timer.
  useEffect(() => {
    if (phase !== 'run') return;
    t0Ref.current = performance.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed((performance.now() - t0Ref.current) / 1000);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  // Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Update OCR thumbnail when ocrText changes (unless user uploaded an override).
  useEffect(() => {
    if (kind !== 'ocr' || ocrOverride) return;
    setOcrThumb(renderTextToPng(formValues.ocrText ?? 'Hello OCR 123\n你好世界'));
  }, [kind, formValues.ocrText, ocrOverride]);

  const audioUrl = useCallback((recordId?: string): string => {
    if (!recordId) return '';
    return pycoreApi.speechHistoryFileUrl(recordId);
  }, []);

  // Build HTTP controller parameters from form values and OCR data.
  const buildParams = useCallback((): Record<string, unknown> => {
    const params: Record<string, unknown> = { engine: target };
    for (const f of formFields) {
      const v = formValues[f.key];
      if (v !== undefined && v !== '' && v !== null) {
        params[f.key] = v;
      }
    }
    // OCR: add image data.
    if (kind === 'ocr') {
      params.image_data = ocrOverride ?? renderTextToPng(formValues.ocrText ?? 'Hello OCR 123\n你好世界');
    }
    return params;
  }, [kind, target, formFields, formValues, ocrOverride]);

  const run = useCallback(async () => {
    setPhase('run');
    setResult(null);
    setRunError(null);
    setLatencyS(null);
    try {
      let res: AnyResult;
      if (kind === 'tts') {
        res = await pycoreApi.testTts(buildParams());
      } else if (kind === 'stt') {
        res = await pycoreApi.testStt(buildParams() as { engine?: string; language?: string; text?: string; model?: string });
      } else if (kind === 'ai') {
        const params = buildParams();
        const provider = String(params.engine || target);
        const msgs = [{ role: 'user' as const, content: String(params.message || 'Reply with one short sentence introducing yourself.') }];
        res = await pycoreApi.testAiChat({ provider, messages: msgs, model: params.model as string | undefined });
      } else {
        // OCR: update thumbnail before sending.
        const imageData = ocrOverride ?? renderTextToPng(formValues.ocrText ?? 'Hello OCR 123\n你好世界');
        setOcrThumb(imageData);
        const ocrParams = buildParams();
        ocrParams.image_data = imageData;
        res = await pycoreApi.testOcr(ocrParams as { engine?: string; image_data?: string; lang?: string; model_type?: string });
      }
      setResult(res);
      const lat = typeof res.latency_ms === 'number' ? res.latency_ms / 1000 : null;
      setLatencyS(lat);
      if (res?.success) {
        setPhase('ok');
      } else {
        setPhase('fail');
        setRunError((res as AnyResult)?.error || 'test failed');
      }
    } catch (e: unknown) {
      setPhase('fail');
      const raw = e instanceof Error ? e.message : 'request failed';
      const timedOut = /abort|timeout|timed out/i.test(raw);
      setRunError(timedOut
        ? `${raw} — server engines (e.g. qwen3tts) build an isolated venv and load the model on first start, which can take minutes; wait or retry.`
        : raw);
    }
  }, [kind, target, formValues, ocrOverride, buildParams]);

  const onFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      setOcrOverride(data);
      setOcrThumb(data);
    };
    reader.readAsDataURL(file);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    if (kind !== 'ocr') return;
    const files = e.clipboardData?.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f && f.type.startsWith('image/')) { e.preventDefault(); onFile(f); return; }
    }
  }, [kind, onFile]);

  const resetOcrSample = useCallback(() => {
    setOcrOverride(null);
    setOcrThumb(renderTextToPng(formValues.ocrText ?? 'Hello OCR 123\n你好世界'));
  }, [formValues.ocrText]);

  const displayedTime = phase === 'run' ? elapsed : latencyS;
  const timeLabel = displayedTime == null ? '—' : `${displayedTime.toFixed(1)}s`;
  const apiRoute = (result && typeof (result as { route?: string }).route === 'string'
    ? (result as { route?: string }).route
    : null) || theme.route(target);

  // Engine status chips for the header.
  const statusChips: { label: string; color: string }[] = [];
  if (defaults?.quota?.tier) {
    statusChips.push({
      label: defaults.quota.blocked ? `${defaults.quota.tier} (blocked)` : defaults.quota.tier,
      color: defaults.quota.blocked ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500',
    });
  }
  if (defaults?.server_running) {
    statusChips.push({ label: 'up', color: 'bg-emerald-500/15 text-emerald-500' });
  }
  if (defaults?.model_loaded) {
    statusChips.push({ label: 'loaded', color: 'bg-emerald-500/15 text-emerald-500' });
  }
  if (defaults?.cooldown_remaining != null && defaults.cooldown_remaining > 0) {
    statusChips.push({ label: `${defaults.cooldown_remaining}s cd`, color: 'bg-amber-500/15 text-amber-500' });
  }

  return (
    <Portal>
      <div
        className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP} animate-in fade-in duration-200`}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onPaste={onPaste}
      >
        <div className={`relative w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/30 border ${theme.border} flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200`}>
          {/* Header — per-kind gradient + route badge + engine status */}
          <div className={`shrink-0 flex items-center gap-3 px-5 py-3.5 border-b ${theme.border} bg-gradient-to-r ${theme.headerGrad}`}>
            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${theme.accentBg} ${theme.accent}`}>
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                <span className={theme.accent}>{theme.label}</span>
                <span className="text-slate-400 font-normal">engine test</span>
                <span className={`px-1.5 py-0.5 rounded-md ${theme.accentBg} text-[10px] font-mono text-slate-600 dark:text-slate-300`}>
                  {target}
                </span>
                {statusChips.map((chip) => (
                  <span key={chip.label} className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${chip.color}`}>
                    {chip.label}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{theme.subtitle}</p>
              {(defaults?.model || defaults?.version) && (
                <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                  {defaults?.version ? `v${defaults.version}` : null}
                  {defaults?.version && defaults?.model ? ' · ' : null}
                  {defaults?.model ?? null}
                  {defaults?.model_loaded === false && kind === 'tts' && (
                    <span className="text-amber-500"> · model not loaded</span>
                  )}
                </p>
              )}
              <p className="text-[10px] font-mono text-slate-400/90 truncate mt-0.5" title={apiRoute}>{apiRoute}</p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-500/10 text-slate-400" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
            {engineProfile?.hint && (
              <div className={`rounded-lg border ${theme.border} ${theme.accentBg} px-3 py-2 text-[11px] ${theme.accent}`}>
                {engineProfile.hint}
              </div>
            )}
            {/* STT round-trip pipeline note */}
            {kind === 'stt' && (
              <div className={`rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2 text-[11px] ${theme.accent} flex items-center gap-2 flex-wrap`}>
                <span className="font-mono text-slate-500">phrase</span>
                <ArrowRight className="w-3 h-3 opacity-60" />
                <span className="font-mono text-slate-500">TTS sample</span>
                <ArrowRight className="w-3 h-3 opacity-60" />
                <span className="font-mono text-slate-500">STT recognize</span>
              </div>
            )}
            {/* AI provider note */}
            {kind === 'ai' && (
              <div className={`rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5 px-3 py-2 text-[11px] text-fuchsia-600 dark:text-fuchsia-300`}>
                Provider: <span className="font-mono font-semibold">{target}</span> — text reply only (not speech).
              </div>
            )}

            {/* Dynamic form from engine profile */}
            <DynamicTestForm
              fields={formFields}
              values={formValues}
              onChange={(key, val) => setFormValues((prev) => ({ ...prev, [key]: val }))}
              inputCls={inputCls}
              kind={kind}
              ocrThumb={ocrThumb}
              ocrOverride={ocrOverride}
              fileInputRef={fileInputRef}
              onFile={onFile}
              resetOcrSample={resetOcrSample}
              t={t}
            />

            {phase !== 'idle' && (
              <ResultPanel kind={kind} phase={phase} result={result} runError={runError}
                audioUrl={audioUrl} ocrThumb={ocrThumb} theme={theme} longWait={engineProfile?.longWait}
                loadStatus={loadStatus} t={t} />
            )}
          </div>

          <div className={`shrink-0 flex items-center gap-3 px-5 py-3 border-t ${theme.border}`}>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {timeLabel}
            </div>
            <button type="button" onClick={run} disabled={phase === 'run'}
              className={`ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white ${theme.btn} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}>
              {phase === 'run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {phase === 'run' ? t('testPopup.running') : t('testPopup.run')}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

// ---- Field helper ----------------------------------------------------------

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block">
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
  </label>
);

// ---- Live model-load progress (streams while an engine loads) --------------

const ENGINE_LOAD_BADGE: Record<
  string,
  { cls: string; Icon: React.FC<{ className?: string }>; spin?: boolean }
> = {
  loading: { cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', Icon: Loader2, spin: true },
  loaded: { cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', Icon: Check },
  error: { cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', Icon: AlertTriangle },
};

/**
 * Live view of one engine's model-load progress while a test runs: a state badge
 * (loading / loaded / error), an elapsed timer, and the streaming log tail so the
 * user sees the model actually loading instead of a frozen spinner.
 */
const EngineLoadLive: React.FC<{ entry: EngineLoadStatusEntry; t: (key: string) => string }> = ({ entry, t }) => {
  const logRef = useRef<HTMLPreElement | null>(null);
  const lines = entry.log_tail ?? [];
  const badge = ENGINE_LOAD_BADGE[entry.state] ?? ENGINE_LOAD_BADGE.loading;
  const { Icon } = badge;
  const elapsedS = Math.max(0, entry.elapsed_ms / 1000);
  const stateLabel = entry.state === 'loaded'
    ? t('engineLoad.loaded')
    : entry.state === 'error'
      ? t('engineLoad.error')
      : t('engineLoad.loading');

  // Keep the newest line in view as the tail streams.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold uppercase ${badge.cls}`}>
          <Icon className={`w-3 h-3 ${badge.spin ? 'animate-spin' : ''}`} />
          {stateLabel}
        </span>
        <span className="font-mono text-slate-400">{t('engineLoad.elapsed')} {elapsedS.toFixed(1)}s</span>
        {entry.device && <span className="font-mono text-slate-400 opacity-70">{entry.device}</span>}
        {entry.message && <span className="text-slate-500 truncate min-w-0">{entry.message}</span>}
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
          {t('engineLoad.liveLog')}
        </div>
        <pre ref={logRef}
          className="whitespace-pre-wrap break-words font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 rounded-lg p-2 max-h-44 overflow-auto">
          {lines.length
            ? lines.join('\n')
            : <span className="text-slate-400 italic">{t('engineLoad.waitingOutput')}</span>}
        </pre>
      </div>
    </div>
  );
};

// ---- Result panel (unchanged from before) ----------------------------------

const ResultPanel: React.FC<{
  kind: PcTestKind;
  phase: Phase;
  result: AnyResult | null;
  runError: string | null;
  audioUrl: (id?: string) => string;
  ocrThumb: string;
  theme: KindTheme;
  longWait?: boolean;
  loadStatus?: EngineLoadStatusEntry | null;
  t: (key: string) => string;
}> = ({ kind, phase, result, runError, audioUrl, ocrThumb, theme, longWait, loadStatus, t }) => {
  const [copied, setCopied] = useState(false);
  const copy = (txt: string) => {
    if (!txt) return;
    navigator.clipboard?.writeText(txt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard unavailable */ });
  };

  const running = phase === 'run';
  const ok = phase === 'ok' && result?.success;

  let bannerLabel = t('testPopup.running');
  let bannerCls = 'text-slate-500';
  let BannerIcon = Loader2;
  if (!running) {
    if (ok) {
      bannerLabel = t('testPopup.success');
      bannerCls = 'text-emerald-500';
      BannerIcon = Check;
    } else {
      bannerLabel = runError || t('testPopup.failed');
      bannerCls = 'text-rose-500';
      BannerIcon = AlertTriangle;
    }
  }

  let extra: React.ReactNode = null;
  if (running) {
    // While the model actually loads, show a LIVE view of its load-status (state
    // badge + elapsed + streaming log tail). Falls back to the static wait copy
    // for engines that don't report a load (cloud/CLI) or before the first signal.
    extra = (loadStatus && loadStatus.state !== 'idle')
      ? <EngineLoadLive entry={loadStatus} t={t} />
      : (
        <p className="text-[11px] text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {longWait
            ? 'Waiting for backend… first model load can take several minutes — keep this window open.'
            : 'Waiting for backend…'}
        </p>
      );
  } else if (result) {
    if (kind === 'tts') {
      const r = result as TtsTestResponse;
      extra = (
        <div className="space-y-2">
          {!ok && r.error && <ErrorBox error={r.error} meta={`${r.engine ?? '?'} · ${r.bytes ?? 0} bytes · ${r.latency_ms ?? 0} ms`} />}
          {r.record_id && <PcBlobAudio controls path={audioUrl(r.record_id)} className="w-full" />}
          {ok && <CopyRow label="Spoken text" value={r.text || ''} copied={copied} onCopy={copy} />}
        </div>
      );
    } else if (kind === 'stt') {
      const r = result as SttTestResponse;
      extra = (
        <div className="space-y-2">
          {!ok && r.error && <ErrorBox error={r.error} meta={r.engine ?? undefined} />}
          {r.phrase && (
            <div className="text-[11px] text-slate-400">
              Input phrase: <span className="font-mono text-slate-600 dark:text-slate-300">{r.phrase}</span>
            </div>
          )}
          <CopyRow label="Recognized" value={r.text || ''} copied={copied} onCopy={copy} />
          {r.record_id && <PcBlobAudio controls path={audioUrl(r.record_id)} className="w-full" />}
        </div>
      );
    } else if (kind === 'ai') {
      const r = result as AiChatResponse;
      extra = (
        <div className="space-y-2">
          {!ok && r.error && <ErrorBox error={r.error} meta={r.provider} />}
          <div className="text-[11px] text-slate-400">
            Provider: <span className="font-mono">{r.provider}</span>{r.model ? <> · {r.model}</> : null}
          </div>
          <CopyRow label="Output" value={r.text || ''} copied={copied} onCopy={copy} multiline />
        </div>
      );
    } else {
      const r = result as OcrTestResponse;
      extra = (
        <div className="space-y-2">
          {!ok && r.error && <ErrorBox error={r.error} meta={r.engine ?? undefined} />}
          {ocrThumb && (
            <div className="rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-700/60 bg-white w-fit">
              <img src={ocrThumb} alt="OCR input" className="block max-h-32 w-auto" />
            </div>
          )}
          <CopyRow label="Recognized" value={r.text || ''} copied={copied} onCopy={copy} multiline />
        </div>
      );
    }
  } else if (!running && runError) {
    extra = <ErrorBox error={runError} />;
  }

  return (
    <div className={`rounded-xl border ${theme.border} bg-slate-500/5 p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 text-[11px] font-semibold min-w-0 ${bannerCls}`}>
          <BannerIcon className={`w-3.5 h-3.5 shrink-0 ${running ? 'animate-spin' : ''}`} />
          <span className="break-words">{bannerLabel}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">{t('testPopup.result')}</span>
      </div>
      {extra}
    </div>
  );
};

const ErrorBox: React.FC<{ error: string; meta?: string }> = ({ error, meta }) => (
  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 space-y-1">
    {meta && <div className="text-[10px] font-mono text-slate-400">{meta}</div>}
    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-rose-600 dark:text-rose-400 max-h-40 overflow-auto">{error}</pre>
  </div>
);

const CopyRow: React.FC<{
  label: string; value: string; copied: boolean; onCopy: (v: string) => void; multiline?: boolean;
}> = ({ label, value, copied, onCopy, multiline }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <button type="button" onClick={() => onCopy(value)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold pc-glass hover:bg-indigo-500/10 text-indigo-500">
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
    {multiline ? (
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 rounded-lg p-2 max-h-56 overflow-auto">{value || <span className="text-slate-400 italic">—</span>}</pre>
    ) : (
      <div className="font-mono text-[12px] text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 rounded-lg p-2 break-words">{value || <span className="text-slate-400 italic">—</span>}</div>
    )}
  </div>
);

export default PcTestPopup;
