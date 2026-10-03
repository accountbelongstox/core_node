/** Private visual kit of the calc group: math instrument panel (orange) and network packet inspector (rose). */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Cpu, Server } from 'lucide-react';
import type { ToolDefinition } from '@/apps/laravel-manager/types';
import { copyToClipboard } from '@/apps/laravel-manager/utils/exportResult';
import { useToolRun } from '../toolRunner';
import type { ToolUsageEntry } from '../toolUsageStore';

export type Accent = 'math' | 'net';

interface AccentStyle {
  text: string;
  tint: string;
  border: string;
  solid: string;
  segActive: string;
  chipActive: string;
  range: string;
  focus: string;
  lcd: string;
  lcdRing: string;
  bar: string;
  cardEdge: string;
  cardTitle: string;
}

const ACCENTS: Record<Accent, AccentStyle> = {
  math: {
    text: 'text-orange-600 dark:text-orange-300',
    tint: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    solid: 'bg-orange-500 text-white hover:bg-orange-400',
    segActive: 'bg-orange-500 text-white shadow-sm',
    chipActive: 'border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-300',
    range: 'accent-orange-500',
    focus: 'focus:border-orange-500 focus:ring-2 focus:ring-orange-500/25',
    lcd: 'text-orange-300',
    lcdRing: 'ring-orange-500/25',
    bar: 'bg-orange-500',
    cardEdge: '',
    cardTitle: 'text-slate-700 dark:text-slate-200',
  },
  net: {
    text: 'text-rose-600 dark:text-rose-300',
    tint: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    solid: 'bg-rose-500 text-white hover:bg-rose-400',
    segActive: 'bg-rose-500 text-white shadow-sm',
    chipActive: 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300',
    range: 'accent-rose-500',
    focus: 'focus:border-rose-500 focus:ring-2 focus:ring-rose-500/25',
    lcd: 'text-rose-300',
    lcdRing: 'ring-rose-500/25',
    bar: 'bg-rose-500',
    cardEdge: 'border-l-4 border-l-rose-500',
    cardTitle: 'font-mono text-rose-700 dark:text-rose-200',
  },
};

const AccentContext = createContext<Accent>('math');
export const useAccent = (): AccentStyle => ACCENTS[useContext(AccentContext)];

export const FIELD_CLASS = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none transition placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100';
const MUTED = 'text-slate-500 dark:text-slate-400';
const COPIED_MS = 1200;
const AUTO_RECORD_MS = 1500;
const NUMBER_PATTERN = /^-?\d*\.?\d*$/;

export const MUTED_TEXT = MUTED;

/** Page frame shared by every calc workbench; sets the accent and the runs-where badge. */
export const Bench: React.FC<{ accent: Accent; server?: boolean; children: React.ReactNode }> = ({ accent, server = false, children }) => {
  const { t } = useTranslation();
  const Icon = server ? Server : Cpu;
  return (
    <AccentContext.Provider value={accent}>
      <div className="mx-auto w-full max-w-5xl space-y-4 p-3 sm:p-5">
        <div className={`flex items-center justify-end gap-1.5 text-[11px] ${MUTED}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {t(server ? 'uiTools.workbench.server_badge' : 'uiTools.workbench.local_badge')}
        </div>
        {children}
      </div>
    </AccentContext.Provider>
  );
};

interface CardProps {
  title?: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, icon, aside, className = '', children }) => {
  const a = useAccent();
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 ${a.cardEdge} ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${a.cardTitle}`}>{icon}{title}</h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
};

export const FieldLabel: React.FC<{ children: React.ReactNode; htmlFor?: string; className?: string }> = ({ children, htmlFor, className = '' }) => (
  <label htmlFor={htmlFor} className={`mb-1 block text-[11px] font-bold uppercase tracking-wider ${MUTED} ${className}`}>{children}</label>
);

interface SegProps<T extends string | number> {
  value: T;
  options: ReadonlyArray<{ value: T; label: React.ReactNode; title?: string }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Seg<T extends string | number>({ value, options, onChange, ariaLabel, className = '' }: SegProps<T>): React.ReactElement {
  const a = useAccent();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800 ${className}`}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={`shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${option.value === value ? a.segActive : `${MUTED} hover:text-slate-900 dark:hover:text-white`}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface ChipsProps<T extends string | number> {
  value: T | null;
  options: ReadonlyArray<{ value: T; label: React.ReactNode; title?: string }>;
  onChange: (value: T) => void;
  className?: string;
}

export function Chips<T extends string | number>({ value, options, onChange, className = '' }: ChipsProps<T>): React.ReactElement {
  const a = useAccent();
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded-full border px-3 py-1 font-mono text-xs font-bold transition ${option.value === value ? a.chipActive : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface NumFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  negative?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  suffix?: string;
  className?: string;
  inputClassName?: string;
}

const formatNum = (n: number): string => (Number.isFinite(n) ? String(n) : '');

/** Typed number input that emits NaN while empty and clamps to min..max on blur. */
export const NumField: React.FC<NumFieldProps> = ({ value, onChange, min, max, negative = false, ariaLabel, placeholder, suffix, className = '', inputClassName = '' }) => {
  const a = useAccent();
  const [text, setText] = useState(formatNum(value));

  useEffect(() => {
    const parsed = text.trim() === '' ? NaN : Number(text);
    if (!(parsed === value || (Number.isNaN(parsed) && Number.isNaN(value)))) setText(formatNum(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (raw: string): void => {
    const cleaned = raw.replace(/,/g, '');
    if (!(negative ? NUMBER_PATTERN : /^\d*\.?\d*$/).test(cleaned)) return;
    setText(cleaned);
    const parsed = cleaned === '' || cleaned === '-' || cleaned === '.' ? NaN : Number(cleaned);
    onChange(parsed);
  };

  const handleBlur = (): void => {
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || text.trim() === '') return;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    if (clamped !== parsed) { setText(String(clamped)); onChange(clamped); }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode={negative ? 'text' : 'decimal'}
        value={text}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        className={`${FIELD_CLASS} ${a.focus} ${suffix ? 'pr-10' : ''} ${inputClassName}`}
      />
      {suffix && <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs ${MUTED}`}>{suffix}</span>}
    </div>
  );
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix?: string;
  format?: (value: number) => string;
}

/** Labelled slider with a typed readout beside it. */
export const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, onChange, suffix, format }) => {
  const a = useAccent();
  const safe = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <FieldLabel className="mb-0">{label}</FieldLabel>
        {format
          ? <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">{format(value)}{suffix}</span>
          : <NumField value={value} onChange={onChange} min={min} max={max} ariaLabel={label} suffix={suffix} className="w-32" inputClassName="py-1 text-right" />}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={safe}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-2 w-full cursor-pointer rounded-lg bg-slate-200 dark:bg-slate-700 ${a.range}`}
      />
    </div>
  );
};

export const CopyButton: React.FC<{ text: string | (() => string); label: string; onCopied?: () => void; className?: string; children?: React.ReactNode }> = ({ text, label, onCopied, className = '', children }) => {
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (): Promise<void> => {
    const ok = await copyToClipboard(typeof text === 'function' ? text() : text);
    if (!ok) return;
    setDone(true);
    onCopied?.();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), COPIED_MS);
  };
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => { void copy(); }}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
};

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'solid' | 'ghost'; icon?: React.ReactNode }> = ({ variant = 'solid', icon, className = '', children, ...rest }) => {
  const a = useAccent();
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${variant === 'solid' ? a.solid : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'} ${className}`}
    >
      {icon}{children}
    </button>
  );
};

/** Dark instrument display: LCD (math) or packet-capture (network) panel. */
export const Lcd: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => {
  const a = useAccent();
  return <div className={`rounded-xl bg-slate-950 px-4 py-3 font-mono tabular-nums shadow-inner ring-1 ring-inset ${a.lcdRing} ${a.lcd} ${className}`}>{children}</div>;
};

export const Notice: React.FC<{ tone?: 'error' | 'info'; children: React.ReactNode }> = ({ tone = 'error', children }) => (
  <p className={`rounded-xl border px-3 py-2 text-xs ${tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300' : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300'}`}>{children}</p>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string; valueClassName?: string }> = ({ label, value, hint, className = '', valueClassName = '' }) => (
  <div className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/40 ${className}`}>
    <p className={`truncate text-[10px] font-bold uppercase tracking-wider ${MUTED}`}>{label}</p>
    <p className={`mt-0.5 break-all font-mono text-base font-bold text-slate-900 dark:text-slate-100 ${valueClassName}`}>{value}</p>
    {hint && <p className={`mt-0.5 text-[11px] ${MUTED}`}>{hint}</p>}
  </div>
);

export const Switch2: React.FC<{ on: boolean; onChange: (on: boolean) => void; label: string }> = ({ on, onChange, label }) => {
  const a = useAccent();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? a.bar : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
      </button>
      {label}
    </label>
  );
};

/** Ticking clock for live counters. */
export function useNow(intervalMs: number, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}

/** Records one meaningful run (copy, generate, save) to the shared tool history. */
export function useRecordUse(tool: ToolDefinition, variant: string): (input: unknown, output: unknown) => void {
  const { run } = useToolRun<unknown>(tool.id, variant);
  return useCallback((input: unknown, output: unknown) => { void run(input, () => output); }, [run]);
}

/** Records the settled state of a live tool once it stops changing for `delay` ms (never the untouched initial state). */
export function useAutoRecord(record: (input: unknown, output: unknown) => void, input: unknown, output: unknown, enabled: boolean, delay = AUTO_RECORD_MS): void {
  const key = JSON.stringify(input);
  const initialKey = useRef(key);
  const latest = useRef({ input, output });
  latest.current = { input, output };
  useEffect(() => {
    if (!enabled || key === initialKey.current) return undefined;
    const id = window.setTimeout(() => record(latest.current.input, latest.current.output), delay);
    return () => window.clearTimeout(id);
  }, [key, enabled, delay, record]);
}

/** Merges the last recorded input into the defaults, keeping only keys whose type matches. */
export function prefillInput<T extends object>(lastRun: ToolUsageEntry | undefined, defaults: T): T {
  const stored = lastRun?.input;
  if (!stored || typeof stored !== 'object') return defaults;
  const source = stored as Record<string, unknown>;
  const out: Record<string, unknown> = { ...defaults };
  (Object.keys(defaults) as Array<keyof T & string>).forEach((key) => {
    if (typeof source[key] === typeof defaults[key]) out[key] = source[key];
  });
  return out as T;
}

export const formatFixed = (value: number, digits: number, locale?: string): string => (
  Number.isFinite(value) ? new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value) : '—'
);

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CNY', 'JPY'] as const;
export type CurrencyCode = typeof CURRENCIES[number];

export const asCurrency = (value: unknown): CurrencyCode => (CURRENCIES.includes(value as CurrencyCode) ? (value as CurrencyCode) : 'USD');

export const CurrencySelect: React.FC<{ value: CurrencyCode; onChange: (code: CurrencyCode) => void; label: string }> = ({ value, onChange, label }) => {
  const a = useAccent();
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as CurrencyCode)} aria-label={label} className={`${FIELD_CLASS} ${a.focus} w-auto py-1 text-xs`}>
      {CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}
    </select>
  );
};

export const moneyFormat = (locale: string, currency: CurrencyCode): Intl.NumberFormat => (
  new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'JPY' ? 0 : 2 })
);

export const pad2 = (n: number): string => String(n).padStart(2, '0');
