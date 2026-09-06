import React from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge, KeyRound, RefreshCcw, Snowflake } from 'lucide-react';
import { appendChatMessages } from '../../../shared/AiChatKit/aiChatHistory';
import type { AiChatUiMessage } from '../../../core/contracts/ai';
import type { AiGatewayStatus, AiKeySlot, AiProvider, AiProviderRate } from '@/apps/pycore-manager/api';

export const TIER_CLS: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-500',
  balance: 'bg-sky-500/15 text-sky-500',
  paid: 'bg-amber-500/15 text-amber-500',
};

export type ProviderSortField = 'original' | 'name' | 'availability' | 'speed';
export type ProviderSortDir = 'asc' | 'desc';

export function mergeGatewayKeyStatus(
  providers: AiProvider[],
  gateway: AiGatewayStatus | null,
): AiProvider[] {
  const gatewayProviders = Array.isArray(gateway?.providers)
    ? gateway.providers as Array<Pick<
        AiProvider,
        'name' | 'key_count' | 'keys' | 'image_keys'
      >>
    : [];
  const byName = new Map(gatewayProviders.map((provider) => [provider.name, provider]));
  if (byName.size === 0) return providers;
  return providers.map((provider) => {
    const gatewayProvider = byName.get(provider.name);
    return gatewayProvider
      ? {
          ...provider,
          key_count: gatewayProvider.key_count,
          keys: gatewayProvider.keys,
          image_keys: gatewayProvider.image_keys,
        }
      : provider;
  });
}

export function availabilityRank(p: AiProvider): number {
  if (!p.configured) return 4;
  if (p.rate_limited) return 1;
  if (!p.tested) return 3;
  return p.available ? 0 : 2;
}

function formatProviderTestLog(p: AiProvider): AiChatUiMessage {
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

export function appendProviderTestLogs(providers: AiProvider[]): void {
  appendChatMessages('pycore', providers.map(formatProviderTestLog));
}

function gatewayModelsLabel(models: string[]): string {
  const n = models?.length ?? 0;
  if (n === 0) return '-';
  if (n === 1) return models[0];
  return `${models[0]} +${n - 1}`;
}

export function modelsLabel(p: AiProvider): string {
  return gatewayModelsLabel(p.models ?? []);
}

/** Split registry limits string into display chips (semicolon-separated). */
export const LimitChips: React.FC<{ limits: string }> = ({ limits }) => {
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
export const RateStatus: React.FC<{ rate?: AiProviderRate | null }> = ({ rate }) => {
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
export const KeyRotation: React.FC<{
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
export const Dot: React.FC<{ ok: boolean; warn?: boolean }> = ({ ok, warn }) => (
  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
    warn ? 'bg-amber-500' : ok ? 'bg-emerald-500' : 'bg-slate-400/50'
  }`} />
);

export const Meter: React.FC<{ label: string; pct: number; sub?: string; Icon: React.FC<{ className?: string }> }> =
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

export interface ImageTestResult {
  provider: string;
  src: string;
  model: string;
  latency_ms: number | null;
}


