/** Visual kit of the converter group: live dual-pane layout, sky chips, copy/record helpers. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeftRight, Check, Copy, Info, Trash2, Upload } from 'lucide-react';
import { ChipGroup, type ChipOption } from '@/shared/ui/ChipGroup';
import { Switch } from '@/shared/ui/Switch';
import { copyToClipboard } from '@/apps/laravel-manager/utils/exportResult';
import { useToolRun } from '../toolRunner';
import type { ToolUsageEntry } from '../toolUsageStore';
import { ConvertError } from './convertCodecs';

export type ConvertT = (key: string, options?: Record<string, unknown>) => string;

const COPIED_MS = 1600;
const RECORD_DELAY_MS = 1500;

export const INPUT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
export const MONO_CLASS = 'font-mono text-[13px] leading-relaxed';
export const PANEL_CLASS = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40';
export const LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';
export const ICON_BUTTON_CLASS = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-sky-600 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-sky-300';
export const PRIMARY_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40';

const SKY_CHIP = {
  chipClassName: 'rounded-lg px-2.5 py-1 text-xs',
  selectedClassName: 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300',
  idleClassName: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10',
};

const NOTICE_TONES = {
  error: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  warning: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  info: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
};

export const useConvertT = (): ConvertT => {
  const { t } = useTranslation();
  return useCallback((key, options) => String(t(`toolsConvert.${key}`, options)), [t]);
};

export const useUiLocale = (): string => {
  const { i18n } = useTranslation();
  return i18n.language || 'en';
};

export const errorMessage = (tc: ConvertT, error: unknown): string => {
  if (error instanceof ConvertError) {
    const base = tc(`errors.${error.code}`, { defaultValue: error.code });
    return error.detail ? `${base} (${error.detail})` : base;
  }
  return tc('errors.unknown');
};

export const prefillOf = <T extends object>(lastRun: ToolUsageEntry | undefined): Partial<T> => (
  lastRun && typeof lastRun.input === 'object' && lastRun.input !== null ? (lastRun.input as Partial<T>) : {}
);

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
};

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Records one history entry per explicit call. */
export const useRecorder = (toolId: string, variant: string): ((input: unknown, output: unknown) => void) => {
  const { run } = useToolRun<unknown>(toolId, variant);
  return useCallback((input, output) => {
    void run(input, () => output);
  }, [run]);
};

/** Records a live-as-you-type run once the input has been idle for a moment. */
export const useDebouncedRecord = (toolId: string, variant: string, input: unknown, output: unknown, enabled: boolean): void => {
  const record = useRecorder(toolId, variant);
  const latest = useRef({ input, output });
  latest.current = { input, output };
  const key = enabled ? JSON.stringify([input, output]) : '';
  useEffect(() => {
    if (!key) return undefined;
    const timer = setTimeout(() => record(latest.current.input, latest.current.output), RECORD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key, record]);
};

export const useCopy = (): { copied: string | null; copy: (text: string, id?: string) => Promise<boolean> } => {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = useCallback(async (text: string, id = 'default') => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), COPIED_MS);
    }
    return ok;
  }, []);
  return { copied, copy };
};

export const attempt = (job: () => string): { value: string; error: unknown } => {
  try {
    return { value: job(), error: null };
  } catch (error) {
    return { value: '', error };
  }
};

export const ConvertPage: React.FC<{ children: React.ReactNode; wide?: boolean }> = ({ children, wide = false }) => (
  <div className={`mx-auto w-full space-y-3 p-3 sm:p-5 ${wide ? 'max-w-7xl' : 'max-w-6xl'}`}>{children}</div>
);

export const Panel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`${PANEL_CLASS} ${className}`}>{children}</div>
);

export const Toolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={`${PANEL_CLASS} flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5`}>{children}</div>
);

export const ToolbarGroup: React.FC<{ label?: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-2">
    {label && <span className={LABEL_CLASS}>{label}</span>}
    {children}
  </div>
);

interface SkyChipsProps<T extends string | number | boolean> {
  value: T;
  options: readonly ChipOption<NoInfer<T>>[];
  onChange: (value: NoInfer<T>) => void;
  label?: string;
  className?: string;
}

export function SkyChips<T extends string | number | boolean>({ value, options, onChange, label, className }: SkyChipsProps<T>): React.ReactElement {
  return <ChipGroup value={value} options={options} onChange={onChange} label={label} className={className} gapClassName="gap-1.5" {...SKY_CHIP} />;
}

export const ToggleField: React.FC<{ label: string; on: boolean; onChange: (next: boolean) => void }> = ({ label, on, onChange }) => (
  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
    <Switch on={on} onChange={onChange} tone="sky" label={label} />
    <span className="cursor-pointer select-none" onClick={() => onChange(!on)}>{label}</span>
  </div>
);

export const Notice: React.FC<{ tone?: keyof typeof NOTICE_TONES; children: React.ReactNode }> = ({ tone = 'error', children }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${NOTICE_TONES[tone]}`}>
    {tone === 'info' ? <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
    <span className="min-w-0 break-words">{children}</span>
  </div>
);

export const StatChip: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <span title={title} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] text-sky-700 dark:text-sky-300">{children}</span>
);

export const CopyButton: React.FC<{ text: string; onCopied?: () => void; label?: string; className?: string }> = ({ text, onCopied, label, className = ICON_BUTTON_CLASS }) => {
  const tc = useConvertT();
  const { copied, copy } = useCopy();
  const done = copied !== null;
  return (
    <button
      type="button"
      disabled={!text}
      title={tc('common.copy')}
      aria-label={tc('common.copy')}
      onClick={async () => {
        if (await copy(text)) onCopied?.();
      }}
      className={className}
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {label !== undefined ? label : done ? tc('common.copied') : null}
    </button>
  );
};

interface TextPaneProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  invalid?: boolean;
  onCopied?: () => void;
  rows?: number;
  wrap?: boolean;
}

/** One side of a dual-pane: labelled mono textarea with copy/clear actions and a stats footer. */
export const TextPane: React.FC<TextPaneProps> = ({ label, value, onChange, placeholder, actions, footer, invalid = false, onCopied, rows = 10, wrap = true }) => {
  const tc = useConvertT();
  const readOnly = !onChange;
  return (
    <section className={`${PANEL_CLASS} flex min-w-0 flex-col overflow-hidden ${invalid ? 'ring-1 ring-rose-400/60' : ''}`}>
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-slate-700/50">
        <span className={LABEL_CLASS}>{label}</span>
        <div className="flex items-center gap-0.5">
          {actions}
          {onChange && (
            <button type="button" disabled={!value} onClick={() => onChange('')} title={tc('common.clear')} aria-label={tc('common.clear')} className={ICON_BUTTON_CLASS}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <CopyButton text={value} onCopied={onCopied} />
        </div>
      </header>
      <textarea
        value={value}
        readOnly={readOnly}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={placeholder}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        wrap={wrap ? 'soft' : 'off'}
        className={`${MONO_CLASS} min-h-[10rem] w-full flex-1 resize-y bg-transparent px-3 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100 lg:min-h-[16rem] ${readOnly ? 'cursor-text' : ''}`}
      />
      {footer && <footer className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 px-3 py-1.5 dark:border-slate-700/50">{footer}</footer>}
    </section>
  );
};

export const SwapButton: React.FC<{ onClick: () => void; disabled?: boolean; title: string }> = ({ onClick, disabled, title }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    className="flex h-10 w-10 shrink-0 rotate-90 items-center justify-center rounded-full border border-sky-300 bg-sky-50 text-sky-600 shadow-sm transition hover:bg-sky-100 active:scale-95 disabled:opacity-40 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20 lg:rotate-0"
  >
    <ArrowLeftRight className="h-4 w-4" />
  </button>
);

export const DualPane: React.FC<{ left: React.ReactNode; right: React.ReactNode; center: React.ReactNode }> = ({ left, right, center }) => (
  <div className="grid grid-cols-1 items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-3">
    {left}
    <div className="flex items-center justify-center">{center}</div>
    {right}
  </div>
);

interface DropZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  title: string;
  hint: string;
  busy?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFile, accept, title, hint, busy = false }) => {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') input.current?.click();
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${over ? 'border-sky-500 bg-sky-500/10' : 'border-slate-300 bg-white/60 hover:border-sky-400 hover:bg-sky-50/60 dark:border-slate-600 dark:bg-slate-800/30 dark:hover:bg-sky-500/5'} ${busy ? 'opacity-60' : ''}`}
    >
      <Upload className="h-8 w-8 text-sky-500" />
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </div>
  );
};
