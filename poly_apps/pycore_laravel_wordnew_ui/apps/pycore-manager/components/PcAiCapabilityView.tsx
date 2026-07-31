/**
 * PcAiCapabilityView — the "Capability" sub-view of the unified AI page.
 *
 * The former PcAiStatusPage body, reorganized into the merged page (its own
 * sticky page chrome is dropped — PcAiPage owns the header). Adds two modern
 * interactions on top of the original:
 *   - provider cards are COLLAPSIBLE: the header (name/badges/latency) is always
 *     visible; clicking a card expands a drawer with the rate budget bars + the
 *     per-key rotation slots (with per-key "Reset cooldown" on a cooled chip).
 *   - each image-capable provider gets a "Test image" button that forces ONE
 *     generation on it (ignoring cooldown) and shows the result in a lightbox.
 *
 * Everything else (live meters, sort, per-provider availability test, OCR/TTS,
 * free libraries, constants & static dirs) is preserved from the original page.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BrainCircuit, RefreshCcw, CheckCircle2, AlertTriangle, MinusCircle, Timer, KeyRound,
  Snowflake, Cpu, MemoryStick, Zap, ScanText, Activity, Image as ImageIcon,
  Settings2, FolderOpen, Lock, FolderX, Gauge, ArrowUp, ArrowDown, Layers,
  ChevronDown, Wand2,
} from 'lucide-react';
import { pycoreApi, PYCORE_HTTP_DEFAULTS } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import { appendChatMessages } from '../../../shared/AiChatKit/aiChatHistory';
import type { AiChatMessage } from '../../../shell/shellTypes';
import type {
  AiProvider, AiProviderRate, AiKeySlot,
  SystemResourcesResponse, SystemInfo,
} from '@/apps/pycore-manager/api';
import { usePycoreCapability } from '@/apps/pycore-manager/api';
import { PcPipelineStatusPanels } from './PcPipelineStatusPanels';
import { PcRecordsPanel } from './PcRecordsPanel';
import { logInfo, logSuccess, logError } from '../../../core/logstore/logStore';
import { PcCollapse, PcImageLightbox } from './PcAiShared';
import { usePcTestPopup } from './PcTestPopupContext';
import { useTopicDrivenRefresh } from '../hooks/useTopicDrivenRefresh';

const LOG_SRC = 'pc-ai-capability';

const TIER_CLS: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-500',
  balance: 'bg-sky-500/15 text-sky-500',
  paid: 'bg-amber-500/15 text-amber-500',
};

type ProviderSortField = 'original' | 'name' | 'availability' | 'speed';
type ProviderSortDir = 'asc' | 'desc';

function availabilityRank(p: AiProvider): number {
  if (!p.configured) return 4;
  if (p.rate_limited) return 1;
  if (!p.tested) return 3;
  return p.available ? 0 : 2;
}

function formatProviderTestLog(p: AiProvider): AiChatMessage {
  const status = !p.configured
    ? 'Not configured'
    : p.rate_limited
      ? 'Rate limited'
      : !p.tested
        ? 'Not tested'
        : p.available
          ? `Available · ${Math.round(p.latency_ms ?? 0)} ms`
          : `Unavailable${p.error ? ` — ${p.error}` : ''}`;
  const lines = [
    `**Provider probe: ${p.name}**`,
    '',
    `Status: ${status}`,
    `Models: ${gatewayModelsLabel(p.models ?? [])}`,
  ];
  if (p.key_masked) lines.push(`Key: ${p.key_masked}`);
  if (p.limits) lines.push(`Limits: ${p.limits}`);
  return {
    role: 'assistant',
    content: lines.join('\n'),
    meta: {
      provider: p.name,
      nickname: `probe/${p.name}`,
      latency_ms: p.latency_ms ?? null,
    },
  };
}

function appendProviderTestLogs(providers: AiProvider[]): void {
  appendChatMessages('pycore', providers.map(formatProviderTestLog));
}

function gatewayModelsLabel(models: string[]): string {
  const n = models?.length ?? 0;
  if (n === 0) return '-';
  if (n === 1) return models[0];
  return `${models[0]} +${n - 1}`;
}

function modelsLabel(p: AiProvider): string {
  return gatewayModelsLabel(p.models ?? []);
}

/** Split registry limits string into display chips (semicolon-separated). */
const LimitChips: React.FC<{ limits: string }> = ({ limits }) => {
  const parts = limits.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {parts.map((part, i) => (
        <span
          key={i}
          title={part}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium
                     bg-indigo-500/8 border border-indigo-400/20 text-slate-500 dark:text-slate-400">
          <Gauge className="w-3 h-3 text-indigo-400/70 shrink-0" />
          <span className="leading-snug">{part}</span>
        </span>
      ))}
    </div>
  );
};

/** Local rate-budget bars for one provider (minute / day / month usage vs limit). */
const RateStatus: React.FC<{ rate?: AiProviderRate | null }> = ({ rate }) => {
  const { t } = useTranslation('pc');
  if (!rate) return null;
  if (!rate.enforced) {
    return <p className="text-[10px] font-mono text-slate-400 mt-2">{rate.note || 'no local rate limit'}</p>;
  }
  const lim = rate.limits;
  const use = rate.usage;
  const resetSecs = [rate.resets_in?.minute, rate.resets_in?.day, rate.resets_in?.month]
    .filter((s): s is number => typeof s === 'number' && s > 0);
  const soonestReset = resetSecs.length ? Math.min(...resetSecs) : null;
  const fmtReset = (s: number) =>
    s < 90 ? `${Math.ceil(s)}s`
      : s < 5400 ? `${Math.ceil(s / 60)}m`
        : s < 172800 ? `${Math.ceil(s / 3600)}h`
          : `${Math.ceil(s / 86400)}d`;
  const cell = (label: string, used?: number, max?: number | null) => {
    if (max == null || used == null) return null;
    const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
    const bar = pct >= 85 ? 'bg-rose-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
      <div key={label} className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
          <span className="uppercase tracking-wide">{label}</span><span>{used}/{max}</span>
        </div>
        <div className="h-1 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden mt-0.5">
          <div className={`h-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };
  const cells = [
    cell('min', use?.minute, lim?.rpm),
    cell('day', use?.day, lim?.rpd),
    cell('mo', use?.month, lim?.rpm_month),
  ].filter(Boolean);
  return (
    <div className="mt-2" title={`local rate budget · auto-resets by the AI rate window${rate.last_updated ? ` · limits verified ${rate.last_updated}` : ''}`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          <Gauge className="w-3 h-3 text-indigo-400/70" /> {t('aiStatus.rateBudget')}
        </span>
        {soonestReset != null && (
          <span className="text-[9px] font-mono text-slate-400" title="Time until the soonest budget reset (minute window / local midnight / 1st of month)">
            resets in {fmtReset(soonestReset)}
          </span>
        )}
      </div>
      {cells.length > 0
        ? <div className="flex gap-2">{cells}</div>
        : <p className="text-[10px] font-mono text-slate-400">{lim?.note || 'enforced'}</p>}
    </div>
  );
};

/**
 * Per-key rotation badges for one provider. Each slot is a KEY1/KEY2… chip with a
 * colored dot: green = ready/active, amber = cooling. A cooling chip also gets a
 * small "Reset cooldown" button (wired through onResetCooldown).
 */
const KeyRotation: React.FC<{
  slots?: AiKeySlot[];
  label: string;
  image?: boolean;
  resetting?: Set<string>;
  onResetCooldown?: (image: boolean, index: number) => void;
}> = ({ slots, label, image = false, resetting, onResetCooldown }) => {
  const { t } = useTranslation('pc');
  if (!slots || slots.length === 0) return null;
  const activeIdx = slots.findIndex((s) => s.cooldown_s <= 0);
  const fmtCooldown = (s: number) =>
    s < 90 ? `${s}s` : s < 5400 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s / 3600)}h`;
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1 mb-1">
        <KeyRound className="w-3 h-3 text-indigo-400/70" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-[9px] font-mono text-slate-400">×{slots.length}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {slots.map((s) => {
          const cooling = s.cooldown_s > 0;
          const active = !cooling && s.index === activeIdx;
          const busy = resetting?.has(`${image ? 'image' : 'text'}:${s.index}`) ?? false;
          return (
            <span
              key={`${label}-${s.index}`}
              title={[
                `${s.label} · ${s.masked || 'no key'}`,
                cooling ? `Cooling down ${fmtCooldown(s.cooldown_s)} (rotates to the next key)` : 'Ready',
                `ok ${s.ok} · failed ${s.failed}`,
                s.last_error ? `Last error: ${s.last_error}` : '',
              ].filter(Boolean).join('\n')}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono border ${
                cooling
                  ? 'bg-amber-500/10 border-amber-400/30 text-amber-600 dark:text-amber-400'
                  : active
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-500/8 border-slate-400/20 text-slate-500 dark:text-slate-400'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cooling ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span className="font-bold normal-case">{s.label}</span>
              <span className="opacity-80">{s.masked || '—'}</span>
              {cooling
                ? <span className="inline-flex items-center gap-0.5"><Snowflake className="w-2.5 h-2.5" />{fmtCooldown(s.cooldown_s)}</span>
                : (s.ok + s.failed > 0 && <span className="opacity-70">{s.ok}/{s.ok + s.failed}</span>)}
              {(!!s.minute_used || !!s.day_used) && (
                <span className="opacity-60 border-l border-current/20 pl-1">
                  {s.minute_used ?? 0}/min · {s.day_used ?? 0} today
                </span>
              )}
              {cooling && onResetCooldown && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onResetCooldown(image, s.index); }}
                  disabled={busy}
                  title={t('ai.resetCooldownTitle')}
                  className="ml-0.5 -mr-0.5 px-1 py-0.5 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition disabled:opacity-40 normal-case font-bold">
                  {busy ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : t('ai.resetCooldown')}
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// --- small presentational helpers ---------------------------------------- #
const Dot: React.FC<{ ok: boolean; warn?: boolean }> = ({ ok, warn }) => (
  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
    warn ? 'bg-amber-500' : ok ? 'bg-emerald-500' : 'bg-slate-400/50'
  }`} />
);

const Meter: React.FC<{ label: string; pct: number; sub?: string; Icon: React.FC<{ className?: string }> }> =
  ({ label, pct, sub, Icon }) => {
    const clamped = Math.max(0, Math.min(100, pct || 0));
    const bar = clamped >= 85 ? 'bg-rose-500' : clamped >= 60 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
      <div className="rounded-2xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-indigo-400" /> {label}
          </span>
          <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-200">{Math.round(clamped)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
          <div className={`h-full ${bar} transition-all`} style={{ width: `${clamped}%` }} />
        </div>
        {sub && <p className="mt-1.5 text-[10px] font-mono text-slate-400">{sub}</p>}
      </div>
    );
  };

interface ImageTestResult {
  provider: string;
  src: string;
  model: string;
  latency_ms: number | null;
}

const PcAiCapabilityView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');

  const [providers, setProviders] = useState<AiProvider[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [imageTesting, setImageTesting] = useState<Set<string>>(new Set());
  const [resetting, setResetting] = useState<Record<string, Set<string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<ImageTestResult | null>(null);
  const [sortField, setSortField] = useState<ProviderSortField>('original');
  const [sortDir, setSortDir] = useState<ProviderSortDir>('asc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { caps, retry: retryCapabilityStatus, refreshing: capabilityRefreshing } = usePycoreCapability();
  const { openTest } = usePcTestPopup();

  const [res, setRes] = useState<SystemResourcesResponse | null>(null);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openNotice, setOpenNotice] = useState<string | null>(null);

  const fetchResources = useCallback(async () => {
    try { const r = await pycoreApi.getSystemResources(); if (r && r.success !== false) setRes(r); } catch { /* keep last */ }
  }, []);

  const mergeKeyStatus = useCallback(async () => {
    try {
      const g = await pycoreApi.getAiGateway();
      const byName = new Map((g?.providers ?? []).map((p) => [p.name, p]));
      if (byName.size === 0) return;
      setProviders((prev) => {
        if (!prev) return prev;
        return prev.map((p) => {
          const gp = byName.get(p.name);
          return gp
            ? { ...p, key_count: gp.key_count, keys: gp.keys, image_keys: gp.image_keys }
            : p;
        });
      });
    } catch { /* keep last */ }
  }, []);

  const fetchSysInfo = useCallback(async () => {
    try { const s = await pycoreApi.getSystemInfo(); if (s?.success) setSysInfo(s); } catch { /* keep last */ }
  }, []);

  const handleOpenDir = useCallback(async (key: string, label: string) => {
    setOpening(key);
    setOpenNotice(null);
    try {
      const r = await pycoreApi.openStaticDir(key);
      setOpenNotice(r?.success ? t('aiStatus.openedDir', { label }) : (r?.error || t('aiStatus.openDirFailed', { label })));
    } catch (e: any) {
      setOpenNotice(e?.message || t('aiStatus.openDirFailed', { label }));
    } finally {
      setOpening(null);
    }
  }, [t]);

  const loadCatalog = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const r = await pycoreApi.getAiCatalog();
      if (Array.isArray(r?.providers)) {
        setProviders(r.providers);
        setError(r?.error ?? null);
        setUnreachable(false);
      } else {
        // getJSON does not throw on non-2xx, so a 404 from a STALE pycore (one
        // started before /api/local/ai/catalog existed) lands here as
        // {detail:"Not Found"}. Surface it instead of silently rendering an
        // empty capability grid.
        const detail = (r as any)?.detail || r?.error;
        setProviders(null);
        setError(detail
          ? `${detail} — AI catalog endpoint missing; restart pycore to load it.`
          : 'AI catalog endpoint returned no providers; restart pycore to load it.');
        setUnreachable(false);
      }
    } catch (e: any) {
      setUnreachable(true);
      setError(e?.message || 'pycore unreachable');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    fetchResources(); fetchSysInfo(); void mergeKeyStatus();
  }, [fetchResources, fetchSysInfo, mergeKeyStatus]);

  const mergeProvider = useCallback((rec: AiProvider) => {
    setProviders((prev) => {
      const list = prev ? [...prev] : [];
      const i = list.findIndex((p) => p.name === rec.name);
      if (i >= 0) list[i] = rec;
      else list.push(rec);
      return list;
    });
  }, []);

  const mergeProviders = useCallback((incoming: AiProvider[]) => {
    setProviders((prev) => {
      const order = prev ?? [];
      const byName = new Map(incoming.map((p) => [p.name, p]));
      const merged = order.map((p) => byName.get(p.name) ?? p);
      for (const p of incoming) {
        if (!order.some((op) => op.name === p.name)) merged.push(p);
      }
      return merged;
    });
  }, []);

  const testAll = useCallback(async () => {
    setTestingAll(true);
    try {
      const r = await pycoreApi.probeAi(true);
      if (Array.isArray(r?.providers)) {
        mergeProviders(r.providers);
        appendProviderTestLogs(r.providers);
      }
      setError(r?.error ?? null);
      setUnreachable(false);
    } catch (e: any) {
      setError(e?.message || 'probe failed');
    } finally {
      setTestingAll(false);
    }
  }, [mergeProviders]);

  // Force one image generation on a single provider (ignores cooldown), then
  // pop the result into the lightbox. New backend endpoint /ai/image/test.
  const testImage = useCallback(async (name: string) => {
    setImageTesting((s) => { const n = new Set(s); n.add(name); return n; });
    setNotice(null);
    logInfo(LOG_SRC, `Image test on ${name}…`);
    try {
      const r = await pycoreApi.testImageProvider({ provider: name, prompt: t('ai.imageTestPrompt') });
      if (r?.success && r.image_base64) {
        setImageResult({
          provider: r.provider || name,
          src: `data:${r.mime || 'image/png'};base64,${r.image_base64}`,
          model: r.model,
          latency_ms: r.latency_ms,
        });
        setNotice(t('ai.imageTestOk', { ms: Math.round(r.latency_ms ?? 0) }));
        logSuccess(LOG_SRC, `Image test passed on ${name} (${Math.round(r.latency_ms ?? 0)} ms).`);
        void mergeKeyStatus();
      } else {
        const msg = r?.error || t('ai.imageTestFailed');
        setNotice(`${t('ai.imageTestFailed')}: ${msg}`);
        logError(LOG_SRC, `Image test failed on ${name}: ${msg}`);
      }
    } catch (e: any) {
      const msg = e?.message || t('ai.imageTestFailed');
      setNotice(`${t('ai.imageTestFailed')}: ${msg}`);
      logError(LOG_SRC, `Image test failed on ${name}: ${msg}`);
    } finally {
      setImageTesting((s) => { const n = new Set(s); n.delete(name); return n; });
    }
  }, [t, mergeKeyStatus]);

  // Clear one key's cooldown so it can be used again. New backend endpoint
  // /ai/keys/reset-cooldown.
  const resetCooldown = useCallback(async (provider: string, image: boolean, index: number) => {
    const slotKey = `${image ? 'image' : 'text'}:${index}`;
    setResetting((prev) => {
      const next = { ...prev };
      next[provider] = new Set(next[provider] ?? []);
      next[provider].add(slotKey);
      return next;
    });
    setNotice(null);
    try {
      const r = await pycoreApi.resetKeyCooldown({ provider, index, image });
      if (r?.success) {
        setNotice(t('ai.cooldownReset'));
        logSuccess(LOG_SRC, `Cleared cooldown on ${provider} ${slotKey}.`);
        await mergeKeyStatus();
      } else {
        setNotice(r?.error || t('ai.cooldownResetFailed'));
        logError(LOG_SRC, r?.error || `Could not clear cooldown on ${provider} ${slotKey}.`);
      }
    } catch (e: any) {
      setNotice(e?.message || t('ai.cooldownResetFailed'));
      logError(LOG_SRC, e?.message || `Could not clear cooldown on ${provider} ${slotKey}.`);
    } finally {
      setResetting((prev) => {
        const next = { ...prev };
        const set = new Set(next[provider] ?? []);
        set.delete(slotKey);
        next[provider] = set;
        return next;
      });
    }
  }, [t, mergeKeyStatus]);

  const refreshRates = useCallback(async () => {
    try {
      const r = await pycoreApi.getAiRateLimits();
      const byName = new Map((r?.providers ?? []).map((rt) => [rt.provider, rt]));
      if (byName.size === 0) return;
      setProviders((prev) => {
        if (!prev) return prev;
        return prev.map((p) => {
          const rt = byName.get(p.name);
          return rt ? { ...p, rate: rt } : p;
        });
      });
    } catch { /* keep last */ }
  }, []);

  useEffect(() => { loadCatalog(false); }, [loadCatalog]);

  // External refresh signal from the page header (PcAiPage Refresh button).
  useEffect(() => {
    if (refreshSignal === undefined) return;
    loadCatalog(true);
    void retryCapabilityStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.operationChanged],
    async () => {
      fetchResources();
      await refreshRates();
      await mergeKeyStatus();
    },
    { fallbackMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs },
  );

  const toggleSort = useCallback((field: Exclude<ProviderSortField, 'original'>) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const toggleExpanded = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const badge = (p: AiProvider) => {
    let key: 'available' | 'unavailable' | 'unconfigured' | 'untested' | 'ratelimited';
    if (!p.configured) key = 'unconfigured';
    else if (p.rate_limited) key = 'ratelimited';
    else if (!p.tested) key = 'untested';
    else key = p.available ? 'available' : 'unavailable';
    const map = {
      available:    { cls: 'bg-emerald-500/15 text-emerald-500', Icon: CheckCircle2,  label: t('aiStatus.badge.available') },
      unavailable:  { cls: 'bg-amber-500/15 text-amber-500',     Icon: AlertTriangle, label: t('aiStatus.badge.unavailable') },
      unconfigured: { cls: 'bg-slate-500/15 text-slate-400',     Icon: MinusCircle,   label: t('aiStatus.badge.unconfigured') },
      untested:     { cls: 'bg-slate-500/10 text-slate-400',     Icon: MinusCircle,   label: t('aiStatus.badge.untested') },
      ratelimited:  { cls: 'bg-rose-500/15 text-rose-500',       Icon: Snowflake,     label: t('aiStatus.badge.ratelimited') },
    }[key];
    const { Icon } = map;
    return (
      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${map.cls}`}
            title={p.error || undefined}>
        <Icon className="w-3 h-3" /> {map.label}
      </span>
    );
  };

  const list = useMemo(() => {
    const base = providers ?? [];
    if (sortField === 'original') return base;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortField === 'name') return dir * a.name.localeCompare(b.name);
      if (sortField === 'availability') return dir * (availabilityRank(a) - availabilityRank(b));
      const la = a.tested && a.latency_ms != null ? a.latency_ms : Number.POSITIVE_INFINITY;
      const lb = b.tested && b.latency_ms != null ? b.latency_ms : Number.POSITIVE_INFINITY;
      return dir * (la - lb);
    });
  }, [providers, sortField, sortDir]);
  const cuda = caps?.cuda;
  const gpus = res?.gpus ?? [];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {(unreachable || error) && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">
            {unreachable ? t('aiStatus.unreachable') : t('aiStatus.probeError')}
            {error ? ` (${error})` : ''}
          </span>
        </div>
      )}
      {notice && <p className="text-[11px] text-indigo-500 break-words">{notice}</p>}

      {/* ===================== System & Compute ===================== */}
      <section className="pc-glass p-5">
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-4">
          <Cpu className="w-4 h-4 text-indigo-500" /> {t('aiStatus.systemCompute')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Meter label={t('aiStatus.cpu')} pct={res?.cpu_percent ?? 0} Icon={Cpu}
                 sub={res ? t('common.live') : t('common.noData')} />
          <Meter label={t('aiStatus.memory')} pct={res?.mem?.percent ?? 0} Icon={MemoryStick}
                 sub={res?.mem ? `${Math.round((res.mem.used_mb ?? 0) / 1024)} / ${Math.round((res.mem.total_mb ?? 0) / 1024)} GB` : t('common.noData')} />

          <div className="rounded-2xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" /> {t('aiStatus.cuda')}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                cuda?.available ? 'bg-emerald-500/15 text-emerald-500' : 'bg-slate-500/15 text-slate-400'
              }`}>
                {cuda?.available ? t('aiStatus.cudaReady') : caps ? t('aiStatus.cudaNoGpu') : '…'}
              </span>
            </div>
            <div className="space-y-1 text-[10px] font-mono text-slate-400">
              <div>driver {cuda?.driver_version ?? '-'} · cuda {cuda?.cuda_version ?? '-'}</div>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1"><Dot ok={!!cuda?.torch_installed} /> torch</span>
                <span className="inline-flex items-center gap-1"><Dot ok={!!cuda?.onnxruntime_installed} /> onnxruntime</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-3 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" /> {t('aiStatus.gpu')}
              </span>
              {gpus.length > 1 && <span className="text-[9px] font-mono text-slate-400">×{gpus.length}</span>}
            </div>
            {gpus.length === 0 ? (
              <p className="text-[10px] font-mono text-slate-400">
                {(cuda?.gpus?.[0]?.name) ?? t('aiStatus.noGpuDetected')}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate" title={gpus[0].name}>
                  {gpus[0].name}
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  {gpus[0].util_percent != null ? t('aiStatus.gpuUtil', { pct: Math.round(gpus[0].util_percent) }) : ''} ·{' '}
                  {Math.round((gpus[0].mem_used_mb ?? 0) / 1024)}/{Math.round((gpus[0].mem_total_mb ?? 0) / 1024)} GB
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================== AI Providers ===================== */}
      <section className="pc-glass p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> {t('aiStatus.aiProviders')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('aiStatus.aiProvidersHint')}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-0.5">{t('common.sort')}</span>
              {([
                { field: 'availability' as const, label: t('aiStatus.sortAvailability') },
                { field: 'name' as const, label: t('aiStatus.sortName') },
                { field: 'speed' as const, label: t('aiStatus.sortSpeed') },
              ]).map(({ field, label }) => {
                const active = sortField === field;
                const SortIcon = sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => toggleSort(field)}
                    title={`Sort by ${label.toLowerCase()} (${active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'ascending'})`}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition border ${
                      active
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-300'
                        : 'pc-glass border-transparent text-slate-500 hover:bg-indigo-500/10'
                    }`}>
                    {label}
                    {active && <SortIcon className="w-3 h-3" />}
                  </button>
                );
              })}
              {sortField !== 'original' && (
                <button
                  type="button"
                  onClick={() => { setSortField('original'); setSortDir('asc'); }}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition">
                  {t('common.resetOrder')}
                </button>
              )}
            </div>
          </div>
          <button
            onClick={testAll}
            disabled={testingAll || loading || list.length === 0}
            title={t('aiStatus.testAllTitle')}
            className="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
            <Activity className={`w-3.5 h-3.5 ${testingAll ? 'animate-pulse' : ''}`} /> {testingAll ? t('common.testing') : t('common.testAll')}
          </button>
        </div>

        <div className="mt-3 flex items-start gap-2 text-[11px] rounded-2xl p-3 border bg-indigo-500/8 border-indigo-400/20 text-slate-500 dark:text-slate-400">
          <Layers className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-semibold text-slate-600 dark:text-slate-300">{t('aiStatus.keysInfo.title')}</p>
            <p className="leading-snug">{t('aiStatus.keysInfo.body')}</p>
            <p className="leading-snug">{t('aiStatus.keysInfo.readonly')}</p>
          </div>
        </div>

        {loading && list.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> {t('aiStatus.loadingProviders')}
          </div>
        ) : list.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
            {t('aiStatus.noProviders')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
            {list.map((p) => {
              const imgBusy = imageTesting.has(p.name);
              const isOpen = expanded.has(p.name);
              return (
                <div key={p.name}
                     className={`rounded-2xl border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex flex-col ${!p.configured ? 'opacity-60' : ''}`}>
                  {/* clickable header toggles the detail drawer */}
                  <button
                    type="button"
                    onClick={() => toggleExpanded(p.name)}
                    className="text-left p-4 flex flex-col gap-2 w-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{p.name}</span>
                        {p.tier && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase ${TIER_CLS[p.tier] ?? ''}`}>{p.tier}</span>
                        )}
                        {p.vision && <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase bg-violet-500/15 text-violet-500">vision</span>}
                        {p.image && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase max-w-[160px] ${
                              p.image_ready
                                ? 'bg-pink-500/15 text-pink-500'
                                : 'border border-pink-400/40 text-pink-400/70'
                            }`}
                            title={`${p.image_ready
                              ? 'Image generation ready (API key present).'
                              : 'Image-capable, but no API key configured yet.'}${p.image_model ? ` Model: ${p.image_model}` : ''}`}>
                            <ImageIcon className="w-3 h-3 shrink-0" />
                            <span className="truncate normal-case">{p.image_model || 'image'}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {badge(p)}
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 font-mono truncate" title="API key (masked)">
                        <KeyRound className="w-3 h-3 shrink-0" />{p.key_masked || t('aiStatus.noKey')}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono truncate" title="Models">
                        <BrainCircuit className="w-3 h-3 shrink-0" />{modelsLabel(p)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono" title="Latency of the last availability test">
                        <Timer className="w-3 h-3 shrink-0" />{p.tested && p.latency_ms != null ? `${Math.round(p.latency_ms)} ms` : t('aiStatus.notTested')}
                      </span>
                    </div>
                  </button>

                  {/* collapsible detail drawer */}
                  <PcCollapse open={isOpen}>
                    <div className="px-4 pb-2 -mt-1 space-y-1">
                      {p.limits && <LimitChips limits={p.limits} />}
                      <RateStatus rate={p.rate} />
                      <KeyRotation
                        slots={p.keys}
                        label={t('aiStatus.keyRotation.textKeys')}
                        resetting={resetting[p.name]}
                        onResetCooldown={(image, index) => resetCooldown(p.name, image, index)}
                      />
                      {p.image && p.image_keys && p.image_keys.length > 0 && (
                        <KeyRotation
                          slots={p.image_keys}
                          label={t('aiStatus.keyRotation.imageKeys')}
                          image
                          resetting={resetting[p.name]}
                          onResetCooldown={(image, index) => resetCooldown(p.name, image, index)}
                        />
                      )}
                      {p.tested && p.configured && !p.available && p.error && (
                        <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 leading-snug flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span className="break-words">{p.error}</span>
                        </p>
                      )}
                    </div>
                  </PcCollapse>

                  {/* action row: availability test + image test */}
                  <div className="px-4 pb-4 pt-1 mt-auto flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openTest('ai', p.name)}
                      disabled={testingAll || !p.configured}
                      title={p.configured
                        ? (p.tested ? t('aiStatus.retestTitle') : t('aiStatus.testTitle'))
                        : t('aiStatus.noKeyConfigured')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        p.tested && p.available
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                          : p.tested && p.configured && !p.available
                            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                            : 'pc-glass hover:bg-indigo-500/10 text-indigo-500'
                      }`}>
                      <Activity className="w-3.5 h-3.5" />
                      {p.tested ? t('common.retest') : t('common.test')}
                    </button>
                    {p.image && (
                      <button
                        onClick={() => testImage(p.name)}
                        disabled={imgBusy || !p.image_ready}
                        title={p.image_ready ? t('ai.imageTestTitle') : t('aiStatus.noKeyConfigured')}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition pc-glass hover:bg-pink-500/10 text-pink-500 disabled:opacity-40 disabled:cursor-not-allowed">
                        {imgBusy ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        {imgBusy ? t('ai.imageTesting') : t('ai.imageTest')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============= Records (unified: AI usage + image + speech) ========= */}
      <PcRecordsPanel />

      {/* ===================== OCR / TTS pipelines ===================== */}
      <section className="pc-glass p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <ScanText className="w-4 h-4 text-indigo-500" /> {t('aiStatus.pipelines')}
          </h2>
          <button
            type="button"
            onClick={() => { void retryCapabilityStatus(); }}
            disabled={capabilityRefreshing}
            title={t('aiStatus.pipelinesRefreshTitle')}
            className="p-1.5 rounded-lg pc-glass hover:bg-indigo-500/10 text-indigo-500 transition disabled:opacity-50">
            <RefreshCcw className={`w-3.5 h-3.5 ${capabilityRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <PcPipelineStatusPanels variant="status" />
      </section>

      {/* ===================== Constants & static directories ===================== */}
      <section className="pc-glass p-5">
        <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200 mb-1">
          <Settings2 className="w-4 h-4 text-indigo-500" /> {t('aiStatus.constantsDirs')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> {t('aiStatus.constantsDirsHint')}
        </p>
        {openNotice && <p className="mb-3 text-[11px] text-indigo-500">{openNotice}</p>}

        {!sysInfo ? (
          <p className="text-[11px] italic text-slate-400">{t('aiStatus.systemInfoUnavailable')}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aiStatus.constants')}</h3>
              <ul className="space-y-1.5">
                {sysInfo.constants.map((c) => (
                  <li key={c.key}
                      className="rounded-xl px-3 py-2 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5"
                      title={c.note}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-mono text-slate-500">{c.key}</span>
                      <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 text-right truncate" title={c.value}>
                        {c.value}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{c.note}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{t('aiStatus.staticDirs')}</h3>
              <ul className="space-y-1.5">
                {sysInfo.directories.map((d) => (
                  <li key={d.key}
                      className="rounded-xl px-3 py-2 border bg-white/40 dark:bg-white/5 border-slate-300/35 dark:border-white/5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{d.label}</span>
                        {!d.exists && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-amber-500">
                            <FolderX className="w-3 h-3" /> {t('aiStatus.missing')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-slate-400 truncate" title={d.path}>{d.path}</p>
                    </div>
                    <button
                      onClick={() => handleOpenDir(d.key, d.label)}
                      disabled={!d.exists || opening === d.key}
                      title={d.exists ? t('aiStatus.openDirTitle', { label: d.label }) : t('aiStatus.dirMissing')}
                      className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition pc-glass hover:bg-indigo-500/10 text-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed">
                      {opening === d.key ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                      {t('common.open')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* image-test result popup */}
      <PcImageLightbox
        open={!!imageResult}
        src={imageResult?.src ?? null}
        alt={imageResult?.provider}
        closeLabel={t('aiImage.close')}
        onClose={() => setImageResult(null)}
        caption={imageResult && (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-pink-500/15 text-pink-500">
              {imageResult.provider}
            </span>
            <span className="text-[11px] font-mono text-slate-500 truncate">
              {imageResult.model}
              {imageResult.latency_ms != null ? ` · ${Math.round(imageResult.latency_ms)} ms` : ''}
            </span>
          </div>
        )}
      />
    </div>
  );
};

export default PcAiCapabilityView;
