/** Writer's-desk visual kit shared by the text workbenches: paper cards, editor surfaces, toggles, copy and input helpers. */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '@/apps/laravel-manager/utils/exportResult';
import { useToolRun } from '../toolRunner';
import type { ToolUsageEntry } from '../toolUsageStore';

const COPIED_RESET_MS = 1400;

export const FOCUS_RING = 'focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/25';
const SURFACE = 'border border-stone-200 bg-[#fffdf8] text-slate-800 placeholder-slate-400 dark:border-slate-700/70 dark:bg-slate-950/50 dark:text-slate-100 dark:placeholder-slate-500';

const BARE_SURFACE = 'border border-transparent bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500';

export const Desk: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide = false }) => (
  <div className="min-h-full bg-gradient-to-b from-violet-50/70 via-transparent to-transparent dark:from-violet-950/20">
    <div className={`mx-auto w-full space-y-4 p-3 sm:p-6 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>{children}</div>
  </div>
);

interface PaperProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}

export const Paper: React.FC<PaperProps> = ({ title, actions, children, className = '', flush = false }) => (
  <section className={`min-w-0 rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60 ${className}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-2.5 dark:border-slate-800">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">{title}</h3>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
    )}
    <div className={flush ? '' : 'p-4'}>{children}</div>
  </section>
);

export const FieldLabel: React.FC<{ children: React.ReactNode; hint?: React.ReactNode; htmlFor?: string }> = ({ children, hint, htmlFor }) => (
  <div className="mb-1 flex items-baseline justify-between gap-2">
    <label htmlFor={htmlFor} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{children}</label>
    {hint && <span className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>}
  </div>
);

interface PaperInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  ariaLabel?: string;
  id?: string;
  className?: string;
  invalid?: boolean;
  inputMode?: 'text' | 'numeric' | 'url' | 'email' | 'tel';
}

export const PaperInput: React.FC<PaperInputProps> = ({ value, onChange, placeholder, mono = true, ariaLabel, id, className = '', invalid = false, inputMode }) => (
  <input
    id={id}
    value={value}
    inputMode={inputMode}
    aria-label={ariaLabel}
    placeholder={placeholder}
    spellCheck={false}
    autoComplete="off"
    onChange={(event) => onChange(event.target.value)}
    className={`w-full min-w-0 rounded-xl px-3 py-2 text-sm ${mono ? 'font-mono' : ''} ${SURFACE} ${FOCUS_RING} ${invalid ? 'border-rose-400 dark:border-rose-500/70' : ''} ${className}`}
  />
);

interface PaperTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  serif?: boolean;
  ariaLabel?: string;
  id?: string;
  className?: string;
  readOnly?: boolean;
  autoGrow?: boolean;
  wrap?: boolean;
  bare?: boolean;
}

export const PaperTextarea: React.FC<PaperTextareaProps> = ({
  value, onChange, placeholder, rows = 6, mono = false, serif = false, ariaLabel, id, className = '', readOnly = false, autoGrow = false, wrap = true, bare = false,
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!autoGrow || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [autoGrow, value]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      value={value}
      readOnly={readOnly}
      aria-label={ariaLabel}
      placeholder={placeholder}
      spellCheck={false}
      wrap={wrap ? 'soft' : 'off'}
      onChange={(event) => onChange(event.target.value)}
      className={`block w-full min-w-0 rounded-xl px-3.5 py-3 text-sm leading-relaxed ${mono ? 'font-mono' : serif ? 'font-serif text-base' : ''} ${autoGrow ? 'resize-none overflow-hidden' : 'resize-y'} ${bare ? BARE_SURFACE : `${SURFACE} ${FOCUS_RING}`} ${className}`}
    />
  );
};

interface SegmentedProps<T extends string | number> {
  value: T;
  options: ReadonlyArray<{ value: NoInfer<T>; label: React.ReactNode; title?: string }>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, ariaLabel, className = '' }: SegmentedProps<T>): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex max-w-full overflow-x-auto rounded-xl border border-stone-200 bg-stone-100/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/70 ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:text-violet-700 dark:text-slate-300 dark:hover:text-violet-300'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
  mono?: boolean;
}

export const ToggleChip: React.FC<ToggleChipProps> = ({ active, onClick, children, title, mono = false }) => (
  <button
    type="button"
    aria-pressed={active}
    title={title}
    onClick={onClick}
    className={`cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${mono ? 'font-mono' : ''} ${active
      ? 'border-violet-500 bg-violet-600 text-white'
      : 'border-stone-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-violet-500/60'}`}
  >
    {children}
  </button>
);

export const SoftButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ icon, children, className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-violet-500/60 dark:hover:text-violet-300 ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }> = ({ icon, children, className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

export interface CopyControl {
  copiedKey: string | null;
  copy: (text: string, key?: string) => Promise<boolean>;
}

export const useCopy = (): CopyControl => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (text: string, key = 'default'): Promise<boolean> => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedKey(null), COPIED_RESET_MS);
    }
    return ok;
  }, []);
  return { copiedKey, copy };
};

interface CopyButtonProps {
  text: string;
  onCopied?: () => void;
  label?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, onCopied, label, iconOnly = false, disabled = false, className = '' }) => {
  const { t } = useTranslation();
  const { copiedKey, copy } = useCopy();
  const done = copiedKey !== null;
  const name = done ? t('uiTools.common.copied') : label ?? t('uiTools.common.copy');
  return (
    <SoftButton
      disabled={disabled || !text}
      title={name}
      aria-label={name}
      className={className}
      icon={done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      onClick={() => { void copy(text).then((ok) => { if (ok) onCopied?.(); }); }}
    >
      {!iconOnly && name}
    </SoftButton>
  );
};

type NoticeTone = 'error' | 'warn' | 'ok' | 'info';

const NOTICE_TONE: Record<NoticeTone, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  info: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
};

export const Notice: React.FC<{ tone?: NoticeTone; children: React.ReactNode; className?: string }> = ({ tone = 'info', children, className = '' }) => (
  <div role={tone === 'error' ? 'alert' : undefined} className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${NOTICE_TONE[tone]} ${className}`}>{children}</div>
);

export const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean }> = ({ label, value, hint, accent = false }) => (
  <div className={`min-w-0 rounded-2xl border px-3.5 py-3 ${accent ? 'border-violet-300 bg-violet-600 text-white dark:border-violet-500/50' : 'border-stone-200 bg-white dark:border-slate-700/60 dark:bg-slate-900/60'}`}>
    <p className={`truncate font-mono text-xl font-black tabular-nums sm:text-2xl ${accent ? '' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    <p className={`mt-0.5 truncate text-[10px] font-bold uppercase tracking-wider ${accent ? 'text-violet-100' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
    {hint && <p className={`mt-1 truncate text-[10px] ${accent ? 'text-violet-100/80' : 'text-slate-400'}`}>{hint}</p>}
  </div>
);

export const useDebounced = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

/** History recorder for live tools: records one entry per explicit action. */
export const useToolRecord = (toolId: string, variant: string): ((input: unknown, output: unknown) => void) => {
  const { run } = useToolRun<unknown>(toolId, variant);
  return useCallback((input: unknown, output: unknown) => { void run(input, () => output); }, [run]);
};

type PrefillRecord = Record<string, unknown>;

const asRecord = (lastRun?: ToolUsageEntry): PrefillRecord => (lastRun && lastRun.input && typeof lastRun.input === 'object' ? lastRun.input as PrefillRecord : {});

export const prefillString = (lastRun: ToolUsageEntry | undefined, key: string, fallback: string): string => {
  const value = asRecord(lastRun)[key];
  return typeof value === 'string' ? value : fallback;
};

export const prefillNumber = (lastRun: ToolUsageEntry | undefined, key: string, fallback: number): number => {
  const value = asRecord(lastRun)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

export const prefillBool = (lastRun: ToolUsageEntry | undefined, key: string, fallback: boolean): boolean => {
  const value = asRecord(lastRun)[key];
  return typeof value === 'boolean' ? value : fallback;
};

export const prefillOneOf = <T extends string>(lastRun: ToolUsageEntry | undefined, key: string, allowed: readonly T[], fallback: T): T => {
  const value = asRecord(lastRun)[key];
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
};
