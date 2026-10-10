/** Shared visual kit of the web workbenches: code-editor panes, controls and hooks in a cyan accent. */
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { copyToClipboard } from '@/apps/laravel-manager/utils/exportResult';
import { offerBlobFile } from '@/core/browser/FileDownload';
import { useToolRun } from '../../toolRunner';
import type { ToolUsageEntry } from '../../toolUsageStore';
import type { CodePaneProps } from './CodePane';

const LazyCodePane = lazy(() => import('./CodePane'));

const COPIED_MS = 1500;

export const WEB_INPUT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-600';
export const WEB_MONO_INPUT_CLASS = `${WEB_INPUT_CLASS} font-mono`;
export const WEB_LABEL_CLASS = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 2 : 1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

export const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

export const downloadBlob = (blob: Blob, filename: string): void => {
  offerBlobFile(filename, blob);
};

export const downloadText = (text: string, filename: string, mime: string): void => downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);

/** Tracks the app theme (the `dark` class on the document element). */
export function useIsDark(): boolean {
  const read = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Records one explicit action (copy, download, generate) of a live tool to the usage history. */
export function useToolRecord(toolId: string, variant: string): (input: unknown, output: unknown) => void {
  const { run } = useToolRun<unknown>(toolId, variant);
  return useCallback((input: unknown, output: unknown) => { void run(input, () => output); }, [run]);
}

interface CodeEditorProps extends Omit<CodePaneProps, 'dark'> {
  className?: string;
}

/** CodeMirror pane in the app theme; a plain textarea stands in while the editor chunk loads. */
export const CodeEditor: React.FC<CodeEditorProps> = ({ className = '', ...pane }) => {
  const dark = useIsDark();
  return (
    <div className={`min-h-0 overflow-hidden ${className}`}>
      <Suspense fallback={(
        <textarea
          value={pane.value}
          readOnly={pane.readOnly}
          onChange={(event) => pane.onChange?.(event.target.value)}
          placeholder={pane.placeholder}
          spellCheck={false}
          className="h-full w-full resize-none bg-transparent p-3 font-mono text-xs text-slate-800 outline-none dark:text-slate-200"
        />
      )}>
        <LazyCodePane {...pane} dark={dark} />
      </Suspense>
    </div>
  );
};

export const WebPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-[1500px] space-y-3 p-3 sm:p-5 ${className}`}>{children}</div>
);

interface PaneProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Editor-window card: title strip with a cyan marker, actions on the right. */
export const Pane: React.FC<PaneProps> = ({ title, icon: Icon, actions, footer, children, className = '', bodyClassName = '' }) => (
  <section className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60 ${className}`}>
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-500" aria-hidden /> : <span className="h-2 w-2 shrink-0 rounded-full bg-cyan-500" />}
      <h3 className="min-w-0 flex-1 truncate font-mono text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{title}</h3>
      {actions && <div className="flex flex-wrap items-center gap-1">{actions}</div>}
    </header>
    <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    {footer && <footer className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">{footer}</footer>}
  </section>
);

interface SegProps<T extends string | number> {
  value: T;
  options: ReadonlyArray<{ value: NoInfer<T>; label: React.ReactNode; title?: string }>;
  onChange: (value: NoInfer<T>) => void;
  ariaLabel?: string;
  className?: string;
}

/** Joined single-choice toggle that reads in light and dark. */
export function Seg<T extends string | number>({ value, options, onChange, ariaLabel, className = '' }: SegProps<T>): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex w-fit max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800 ${className}`}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-[11px] font-bold transition-colors ${selected ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface BtnProps {
  onClick?: () => void;
  icon?: LucideIcon;
  children?: React.ReactNode;
  title?: string;
  disabled?: boolean;
  tone?: 'ghost' | 'primary';
  className?: string;
}

export const Btn: React.FC<BtnProps> = ({ onClick, icon: Icon, children, title, disabled, tone = 'ghost', className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    disabled={disabled}
    className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone === 'primary' ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'text-slate-600 hover:bg-slate-200/70 hover:text-cyan-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-cyan-300'} ${className}`}
  >
    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
    {children}
  </button>
);

interface CopyBtnProps {
  getText: () => string;
  onCopied?: (text: string) => void;
  label?: string;
  disabled?: boolean;
  tone?: 'ghost' | 'primary';
}

export const CopyBtn: React.FC<CopyBtnProps> = ({ getText, onCopied, label, disabled, tone }) => {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const copy = async () => {
    const text = getText();
    if (!(await copyToClipboard(text))) return;
    onCopied?.(text);
    setDone(true);
    setTimeout(() => setDone(false), COPIED_MS);
  };
  return (
    <Btn onClick={copy} icon={done ? Check : Copy} disabled={disabled} tone={tone} title={t('uiTools.common.copy')}>
      {done ? t('uiTools.common.copied') : (label ?? t('uiTools.common.copy'))}
    </Btn>
  );
};

type NoticeTone = 'error' | 'warn' | 'ok' | 'info';

const NOTICE_TONE: Record<NoticeTone, string> = {
  error: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  warn: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  info: 'border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300',
};

export const Notice: React.FC<{ tone: NoticeTone; icon?: LucideIcon; children: React.ReactNode; className?: string }> = ({ tone, icon: Icon, children, className = '' }) => (
  <div role={tone === 'error' ? 'alert' : undefined} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${NOTICE_TONE[tone]} ${className}`}>
    {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
    <div className="min-w-0 flex-1 break-words">{children}</div>
  </div>
);

export const Metric: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone = 'text-slate-900 dark:text-slate-100' }) => (
  <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
    <div className={`truncate font-mono text-base font-black ${tone}`}>{value}</div>
    <div className="truncate font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
  </div>
);

export const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ label, hint, children, className = '' }) => (
  <label className={`block min-w-0 ${className}`}>
    <span className={WEB_LABEL_CLASS}>{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>}
  </label>
);

interface ToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

/** Compact labelled checkbox-switch row. */
export const Toggle: React.FC<ToggleProps> = ({ on, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className="inline-flex cursor-pointer items-center gap-2 text-left text-xs text-slate-700 dark:text-slate-300"
  >
    <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
      <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-3' : ''}`} />
    </span>
    {label}
  </button>
);

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  format?: (value: number) => string;
}

export const Slider: React.FC<SliderProps> = ({ value, min, max, step = 1, onChange, label, format }) => (
  <div className="min-w-0">
    <div className="mb-1 flex items-center justify-between">
      <span className={WEB_LABEL_CLASS + ' !mb-0'}>{label}</span>
      <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-300">{format ? format(value) : value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-200 accent-cyan-500 [color-scheme:light] dark:bg-slate-700 dark:[color-scheme:dark]"
    />
  </div>
);

export const CHECKER_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage: 'linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%), linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 8px 8px',
};

export type LastInput = Record<string, unknown>;

/** Reads the recorded input of the last run as a plain record for prefilling. */
export const lastInput = (lastRun?: ToolUsageEntry): LastInput => (lastRun?.input && typeof lastRun.input === 'object' ? lastRun.input as LastInput : {});

export const pickString = (source: LastInput, key: string, fallback: string): string => (typeof source[key] === 'string' ? source[key] as string : fallback);

export const pickNumber = (source: LastInput, key: string, fallback: number): number => (typeof source[key] === 'number' ? source[key] as number : fallback);

export const pickBool = (source: LastInput, key: string, fallback: boolean): boolean => (typeof source[key] === 'boolean' ? source[key] as boolean : fallback);

export const pickOption = <T extends string | number>(source: LastInput, key: string, allowed: readonly T[], fallback: T): T => (
  allowed.includes(source[key] as T) ? source[key] as T : fallback
);

/** Gzip size of a text through CompressionStream; null when the browser lacks it. */
export async function gzipSize(text: string): Promise<number | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return (await new Response(stream).arrayBuffer()).byteLength;
  } catch {
    return null;
  }
}
