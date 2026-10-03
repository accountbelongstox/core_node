/** Secure-vault visual kit shared by the crypto workbenches: panels, masked secrets, readouts, meters, batch lists. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Download, Eye, EyeOff, Laptop, Server, ShieldCheck, type LucideIcon } from 'lucide-react';
import { SegmentedControl, type SegmentOption } from '@/shared/ui/SegmentedControl';
import { Switch } from '@/shared/ui/Switch';
import { RangeField } from '@/shared/ui/RangeField';
import { SelectField, type SelectOption } from '@/shared/ui/SelectField';
import { TickBar } from '@/shared/ui/ProgressBar';
import { copyToClipboard, downloadAsFile } from '@/apps/laravel-manager/utils/exportResult';
import { toolUsageStore, type ToolUsageEntry } from '../toolUsageStore';

export const VAULT_FIELD = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-xs text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 dark:border-emerald-400/15 dark:bg-slate-950/70 dark:text-emerald-100 dark:placeholder:text-slate-600 dark:focus:border-emerald-400/60';
export const VAULT_BUTTON = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-600 px-3.5 py-2 font-mono text-xs font-bold text-white transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
export const VAULT_GHOST_BUTTON = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400/15 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10';
export const VAULT_SELECT = 'border border-slate-300 bg-white text-slate-800 dark:border-emerald-400/15 dark:bg-slate-950/70 dark:text-emerald-100';
export const VAULT_TAB_ACTIVE = 'bg-emerald-600 text-white shadow-sm';

const COPIED_FLASH_MS = 1400;
const MASK_CHAR = '•';
const MASK_LIMIT = 64;
const FINGERPRINT_SWATCHES = 8;
const METER_TONES = ['from-rose-500 to-rose-400', 'from-orange-500 to-amber-400', 'from-amber-400 to-yellow-300', 'from-lime-500 to-emerald-400', 'from-emerald-500 to-teal-300'];
const METER_THRESHOLDS = [28, 40, 60, 80];

export const useCopied = (): readonly [boolean, () => void] => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const flash = useCallback(() => {
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_FLASH_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [copied, flash];
};

/** History is written with settings only; secrets, keys and generated values never enter the usage store. */
export const useVaultRecorder = (toolId: string, variant: string): ((settings: Record<string, unknown>, summary?: Record<string, unknown>) => void) =>
  useCallback((settings, summary = {}) => toolUsageStore.record(toolId, variant, settings, summary), [toolId, variant]);

/** Merges the last recorded settings over the defaults, keeping only keys whose value type still matches. */
export const readSettings = <T extends object>(lastRun: ToolUsageEntry | undefined, defaults: T): T => {
  const saved = lastRun?.input;
  if (!saved || typeof saved !== 'object') return defaults;
  const base = defaults as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    if (key in base && typeof value === typeof base[key]) merged[key] = value;
  }
  return merged as T;
};

export const meterScore = (bits: number): number => METER_THRESHOLDS.filter((threshold) => bits >= threshold).length;

export const VaultPage: React.FC<{ server?: boolean; children: React.ReactNode }> = ({ server = false, children }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-full bg-gradient-to-b from-emerald-500/[0.05] via-transparent to-transparent">
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-2 py-0.5">
            {server ? <Server className="h-3 w-3" aria-hidden /> : <Laptop className="h-3 w-3" aria-hidden />}
            {t(server ? 'uiTools.workbench.server_badge' : 'uiTools.workbench.local_badge')}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
};

interface VaultPanelProps {
  title?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  /** Always-dark surface (readouts) regardless of the theme. */
  vault?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const VaultPanel: React.FC<VaultPanelProps> = ({ title, icon: Icon, actions, vault = false, className = '', children }) => (
  <section className={`rounded-2xl border p-4 ${vault ? 'border-emerald-500/20 bg-slate-950 text-emerald-200 shadow-lg shadow-emerald-950/20' : 'border-slate-200 bg-white dark:border-emerald-400/10 dark:bg-slate-900/60'} ${className}`}>
    {(title || actions) && (
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {title && (
          <h3 className={`flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${vault ? 'text-emerald-400' : 'text-slate-500 dark:text-emerald-400/80'}`}>
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {title}
          </h3>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
    )}
    {children}
  </section>
);

export const FieldLabel: React.FC<{ children: React.ReactNode; htmlFor?: string; trailing?: React.ReactNode }> = ({ children, htmlFor, trailing }) => (
  <div className="mb-1.5 flex items-center justify-between gap-2">
    <label htmlFor={htmlFor} className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{children}</label>
    {trailing}
  </div>
);

export const Hint: React.FC<{ children: React.ReactNode; tone?: 'muted' | 'warn' | 'error' }> = ({ children, tone = 'muted' }) => (
  <p className={`font-mono text-[11px] leading-relaxed ${tone === 'error' ? 'text-rose-500' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>{children}</p>
);

export const ToggleRow: React.FC<{ label: string; on: boolean; onChange: (next: boolean) => void; hint?: string }> = ({ label, on, onChange, hint }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="min-w-0">
      <span className="block font-mono text-xs text-slate-700 dark:text-slate-200">{label}</span>
      {hint && <span className="block font-mono text-[10px] text-slate-400">{hint}</span>}
    </span>
    <Switch on={on} onChange={onChange} tone="emerald" label={label} />
  </div>
);

export function ModeTabs<T extends string | number>({ value, options, onChange, label }: { value: T; options: readonly SegmentOption<NoInfer<T>>[]; onChange: (value: NoInfer<T>) => void; label?: string }): React.ReactElement {
  return (
    <div className="max-w-full overflow-x-auto">
      <SegmentedControl value={value} options={options} onChange={onChange} ariaLabel={label} activeClassName={VAULT_TAB_ACTIVE}
        className="!border-slate-200 !bg-slate-100 dark:!border-emerald-400/10 dark:!bg-white/5 [&_button:not([aria-checked=true])]:!text-slate-500 dark:[&_button:not([aria-checked=true])]:!text-slate-400" />
    </div>
  );
}

interface CopyButtonProps {
  value: string;
  label?: string;
  onCopied?: () => void;
  className?: string;
  /** Show the localized caption next to the icon. */
  caption?: boolean;
  dark?: boolean;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ value, label, onCopied, className = '', caption = false, dark = false }) => {
  const { t } = useTranslation();
  const [copied, flash] = useCopied();
  const text = copied ? t('uiTools.common.copied') : label ?? t('uiTools.common.copy');
  const copy = async (): Promise<void> => {
    if (!(await copyToClipboard(value))) return;
    flash();
    onCopied?.();
  };
  return (
    <button type="button" onClick={copy} disabled={!value} title={text} aria-label={text}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${dark ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20' : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:border-emerald-400/15 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10'} ${copied ? '!border-emerald-500/50 !text-emerald-500' : ''} ${className}`}>
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {caption && <span>{text}</span>}
    </button>
  );
};

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  id?: string;
  placeholder?: string;
  trailing?: React.ReactNode;
  autoFocus?: boolean;
}

/** Single-line secret field: masked by default with a reveal toggle; never autofilled or spell-checked. */
export const SecretInput: React.FC<SecretInputProps> = ({ value, onChange, label, id, placeholder, trailing, autoFocus }) => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const toggle = t(revealed ? 'toolsCrypto.common.hide' : 'toolsCrypto.common.reveal');
  return (
    <div>
      <FieldLabel htmlFor={id} trailing={trailing}>{label}</FieldLabel>
      <div className="relative">
        <input id={id} type={revealed ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoFocus={autoFocus} className={`${VAULT_FIELD} pr-10`} />
        <button type="button" onClick={() => setRevealed((prev) => !prev)} title={toggle} aria-label={toggle} aria-pressed={revealed}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-slate-400 hover:text-emerald-500">
          {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
};

interface ReadoutProps {
  value: string;
  label?: string;
  /** Hide the value behind bullets until the reveal toggle is used. */
  masked?: boolean;
  onCopied?: () => void;
  className?: string;
  valueClassName?: string;
  emptyText?: string;
}

/** Dark monospace result box with a copy button and optional masking. */
export const Readout: React.FC<ReadoutProps> = ({ value, label, masked = false, onCopied, className = '', valueClassName = 'text-sm', emptyText }) => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const hidden = masked && !revealed && value !== '';
  const shown = hidden ? MASK_CHAR.repeat(Math.min(value.length, MASK_LIMIT)) : value;
  const toggle = t(revealed ? 'toolsCrypto.common.hide' : 'toolsCrypto.common.reveal');
  return (
    <div className={`rounded-xl border border-emerald-500/20 bg-slate-950 p-3 ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">{label}</span>
        <span className="flex items-center gap-1.5">
          {masked && (
            <button type="button" onClick={() => setRevealed((prev) => !prev)} title={toggle} aria-label={toggle} aria-pressed={revealed}
              className="cursor-pointer rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-1.5 text-emerald-300 hover:bg-emerald-400/20">
              {revealed ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            </button>
          )}
          <CopyButton value={value} onCopied={onCopied} dark />
        </span>
      </div>
      <p className={`break-all font-mono leading-relaxed text-emerald-300 ${valueClassName}`}>
        {shown || <span className="text-emerald-500/40">{emptyText ?? '—'}</span>}
      </p>
    </div>
  );
};

interface EntropyMeterProps {
  bits: number;
  max?: number;
  caption?: string;
}

export const EntropyMeter: React.FC<EntropyMeterProps> = ({ bits, max = 128, caption }) => {
  const { t } = useTranslation();
  const tone = METER_TONES[meterScore(bits)];
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 font-mono">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{caption ?? t('toolsCrypto.common.entropy')}</span>
        <span className="text-sm font-black text-emerald-600 dark:text-emerald-300">{bits.toFixed(1)} <span className="text-[10px] font-bold text-slate-400">{t('toolsCrypto.common.bits')}</span></span>
      </div>
      <TickBar done={Math.min(bits, max)} total={max} ticks={32} className="h-3" fillClassName={`bg-gradient-to-t ${tone}`} label={caption ?? t('toolsCrypto.common.entropy')} />
    </div>
  );
};

export const FingerprintChip: React.FC<{ hex: string; label?: string; onCopied?: () => void }> = ({ hex, label, onCopied }) => {
  const groups = useMemo(() => (hex.match(/.{1,2}/g) ?? []).slice(0, 8).join(':'), [hex]);
  const swatches = useMemo(() => (hex.match(/.{1,2}/g) ?? []).slice(0, FINGERPRINT_SWATCHES).map((byte) => parseInt(byte, 16)), [hex]);
  return (
    <div className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-emerald-500/20 bg-slate-950 px-2.5 py-1.5 font-mono">
      <span className="flex shrink-0 overflow-hidden rounded-md">
        {swatches.map((byte, index) => <span key={index} className="h-5 w-2.5" style={{ backgroundColor: `hsl(${Math.round(byte * 1.4)} 65% 55%)` }} />)}
      </span>
      <span className="min-w-0">
        {label && <span className="block text-[9px] font-bold uppercase tracking-widest text-emerald-500/70">{label}</span>}
        <span className="block truncate text-[11px] text-emerald-200" title={hex}>{groups}</span>
      </span>
      <CopyButton value={hex} onCopied={onCopied} dark />
    </div>
  );
};

interface BatchListProps {
  items: readonly string[];
  filename: string;
  onCopied?: (scope: 'item' | 'all') => void;
  onDownloaded?: () => void;
  itemClassName?: string;
}

/** Dark list of generated values with per-item copy, copy-all and download. */
export const BatchList: React.FC<BatchListProps> = ({ items, filename, onCopied, onDownloaded, itemClassName = 'text-xs' }) => {
  const { t } = useTranslation();
  const joined = items.join('\n');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">{t('toolsCrypto.common.items', { count: items.length })}</span>
        <span className="flex items-center gap-1.5">
          <CopyButton value={joined} label={t('toolsCrypto.common.copy_all')} caption dark onCopied={() => onCopied?.('all')} />
          <button type="button" disabled={items.length === 0} onClick={() => { downloadAsFile(joined, filename, 'text/plain'); onDownloaded?.(); }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 font-mono text-[11px] font-bold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40">
            <Download className="h-3.5 w-3.5" aria-hidden />{t('uiTools.common.download')}
          </button>
        </span>
      </div>
      <ol className="divide-y divide-emerald-500/10 overflow-hidden rounded-xl border border-emerald-500/20 bg-slate-950">
        {items.map((item, index) => (
          <li key={`${index}:${item}`} className="flex items-center gap-2 px-3 py-2">
            <span className="w-6 shrink-0 text-right font-mono text-[10px] text-emerald-500/50">{index + 1}</span>
            <span className={`min-w-0 flex-1 break-all font-mono text-emerald-300 ${itemClassName}`}>{item}</span>
            <CopyButton value={item} dark onCopied={() => onCopied?.('item')} />
          </li>
        ))}
      </ol>
    </div>
  );
};

export const formatDuration = (t: (key: string, options?: Record<string, unknown>) => string, unit: string, value: number): string =>
  t(`toolsCrypto.durations.${unit}`, { count: value });

interface VaultRangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export const VaultRange: React.FC<VaultRangeProps> = ({ label, value, min, max, step = 1, suffix = '', onChange }) => (
  <div>
    <FieldLabel trailing={<span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-300">{value}{suffix}</span>}>{label}</FieldLabel>
    <RangeField value={value} min={min} max={max} step={step} onChange={onChange} className="[&_input]:accent-emerald-500" />
  </div>
);

export function VaultSelect<T extends string | number>({ value, options, onChange, label }: { value: T; options: readonly SelectOption<NoInfer<T>>[]; onChange: (value: NoInfer<T>) => void; label: string }): React.ReactElement {
  return <SelectField value={value} options={options} onChange={onChange} label={label} inputClassName={VAULT_SELECT} />;
}
