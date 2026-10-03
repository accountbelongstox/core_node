/** Private visual kit of the media workbenches: lightbox stage, floating bars, sliders, segmented controls, compare slider. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ClipboardPaste, Cpu, ImagePlus, Minus, Plus, RefreshCw, Server } from 'lucide-react';
import { formatBytes } from './mediaFormat';

export type Tone = 'amber' | 'indigo' | 'red';

const CHECKER_LIGHT = 'bg-[linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_75%,#cbd5e1_75%),linear-gradient(45deg,#cbd5e1_25%,transparent_25%,transparent_75%,#cbd5e1_75%)]';
const CHECKER_DARK = 'dark:bg-[linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%),linear-gradient(45deg,#1e293b_25%,transparent_25%,transparent_75%,#1e293b_75%)]';
export const CHECKER_CLASS = `bg-slate-100 dark:bg-slate-950 ${CHECKER_LIGHT} ${CHECKER_DARK} bg-[length:20px_20px] bg-[position:0_0,10px_10px]`;

export const TONE: Record<Tone, { solid: string; soft: string; ring: string; text: string; accent: string; bar: string }> = {
  amber: {
    solid: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    soft: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/50 border-amber-500/60',
    text: 'text-amber-600 dark:text-amber-400',
    accent: 'accent-amber-500',
    bar: 'bg-amber-500',
  },
  indigo: {
    solid: 'bg-indigo-500 hover:bg-indigo-400 text-white',
    soft: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-500/50 border-indigo-500/60',
    text: 'text-indigo-600 dark:text-indigo-400',
    accent: 'accent-indigo-500',
    bar: 'bg-indigo-500',
  },
  red: {
    solid: 'bg-red-500 hover:bg-red-400 text-white',
    soft: 'bg-red-500/15 text-red-700 dark:text-red-300',
    ring: 'ring-red-500/50 border-red-500/60',
    text: 'text-red-600 dark:text-red-400',
    accent: 'accent-red-500',
    bar: 'bg-red-500',
  },
};

const FLASH_MS = 1200;
const COMPARE_STEP = 0.05;

/** Translation shortcut scoped to the toolsMedia namespace. */
export const useMediaT = () => {
  const { t } = useTranslation();
  return useCallback((key: string, options?: Record<string, unknown>): string => t(`toolsMedia.${key}`, options) as string, [t]);
};

export const RunBadge: React.FC<{ server?: boolean }> = ({ server = false }) => {
  const { t } = useTranslation();
  const Icon = server ? Server : Cpu;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-100 backdrop-blur">
      <Icon className="h-3 w-3" />{t(server ? 'uiTools.workbench.server_badge' : 'uiTools.workbench.local_badge')}
    </span>
  );
};

export const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) => (message ? (
  <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="min-w-0 break-words">{message}</span>
  </div>
) : null);

export const Notice: React.FC<{ tone?: 'info' | 'warn'; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tone === 'warn'
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300'}`}>
    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="min-w-0">{children}</span>
  </div>
);

export const Workspace: React.FC<{ stage: React.ReactNode; panel: React.ReactNode }> = ({ stage, panel }) => (
  <div className="mx-auto grid w-full max-w-[1500px] gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
    <div className="min-w-0">{stage}</div>
    <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-3">{panel}</aside>
  </div>
);

export const Panel: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <section className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700/60 dark:bg-slate-800/50 ${className}`}>
    {title && <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</h3>}
    {children}
  </section>
);

export const Field: React.FC<{ label: string; hint?: React.ReactNode; trailing?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, trailing, children }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {trailing}
    </div>
    {children}
    {hint && <span className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>}
  </div>
);

interface SegmentOption<V extends string> { value: V; label: React.ReactNode; disabled?: boolean; title?: string }

export function Segmented<V extends string>({ value, options, onChange, tone = 'amber', ariaLabel, className = '' }: {
  value: V; options: readonly SegmentOption<V>[]; onChange: (value: V) => void; tone?: Tone; ariaLabel?: string; className?: string;
}): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex w-full rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900/70 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={`min-w-0 flex-1 cursor-pointer truncate rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${option.value === value
            ? `${TONE[tone].soft} shadow-sm ring-1 ${TONE[tone].ring}`
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const Chip: React.FC<{ active?: boolean; tone?: Tone; onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }> = ({ active = false, tone = 'amber', onClick, children, title, disabled }) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    onClick={onClick}
    className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active
      ? `${TONE[tone].soft} ${TONE[tone].ring}`
      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500'}`}
  >
    {children}
  </button>
);

export const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; label: string; tone?: Tone; disabled?: boolean }> = ({ checked, onChange, label, tone = 'amber', disabled }) => (
  <label className={`flex cursor-pointer items-center justify-between gap-3 text-xs font-medium text-slate-700 dark:text-slate-300 ${disabled ? 'opacity-40' : ''}`}>
    <span className="min-w-0">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? TONE[tone].bar : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  </label>
);

export const Slider: React.FC<{
  value: number; min: number; max: number; step?: number; onChange: (value: number) => void; tone?: Tone;
  format?: (value: number) => string; ariaLabel?: string; nudge?: number;
}> = ({ value, min, max, step = 1, onChange, tone = 'amber', format, ariaLabel, nudge }) => {
  const bump = (direction: number) => onChange(Math.min(max, Math.max(min, Math.round((value + direction * (nudge ?? step)) * 1000) / 1000)));
  return (
    <div className="flex items-center gap-2">
      {nudge !== undefined && (
        <button type="button" aria-label="-" onClick={() => bump(-1)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Minus className="h-3.5 w-3.5" /></button>
      )}
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-1.5 min-w-0 flex-1 cursor-pointer ${TONE[tone].accent}`}
      />
      {nudge !== undefined && (
        <button type="button" aria-label="+" onClick={() => bump(1)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><Plus className="h-3.5 w-3.5" /></button>
      )}
      <span className="w-14 shrink-0 text-right font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{format ? format(value) : value}</span>
    </div>
  );
};

export const NumberField: React.FC<{
  value: number; onChange: (value: number) => void; min?: number; max?: number; suffix?: string; ariaLabel?: string; className?: string;
}> = ({ value, onChange, min = 0, max, suffix, ariaLabel, className = '' }) => (
  <div className={`flex min-w-0 items-center rounded-lg border border-slate-200 bg-white px-2 focus-within:border-amber-500 dark:border-slate-700 dark:bg-slate-900 ${className}`}>
    <input
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : ''}
      onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
      className="w-full min-w-0 bg-transparent py-1.5 font-mono text-xs text-slate-900 outline-none dark:text-slate-100"
    />
    {suffix && <span className="shrink-0 pl-1 text-[10px] text-slate-400">{suffix}</span>}
  </div>
);

export const ActionButton: React.FC<{
  onClick: () => void; children: React.ReactNode; tone?: Tone; variant?: 'solid' | 'ghost'; disabled?: boolean; busy?: boolean; icon?: React.ReactNode; className?: string; title?: string;
}> = ({ onClick, children, tone = 'amber', variant = 'solid', disabled, busy, icon, className = '', title }) => (
  <button
    type="button"
    title={title}
    disabled={disabled || busy}
    onClick={onClick}
    className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variant === 'solid'
      ? TONE[tone].solid
      : 'border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'} ${className}`}
  >
    {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : icon}{children}
  </button>
);

export const StatTile: React.FC<{ label: string; value: React.ReactNode; tone?: 'plain' | 'good' | 'bad' }> = ({ label, value, tone = 'plain' }) => (
  <div className="min-w-0 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/60">
    <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
    <div className={`truncate font-mono text-sm font-bold ${tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
  </div>
);

export const FloatingBar: React.FC<{ position?: 'top' | 'bottom'; children: React.ReactNode }> = ({ position = 'top', children }) => (
  <div className={`pointer-events-none absolute inset-x-2 z-10 flex flex-wrap items-center justify-between gap-2 ${position === 'top' ? 'top-2' : 'bottom-2'}`}>
    {children}
  </div>
);

export const FloatingPill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`pointer-events-auto inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-100 shadow-lg backdrop-blur ${className}`}>{children}</div>
);

export const FloatingButton: React.FC<{ onClick: () => void; children: React.ReactNode; title?: string }> = ({ onClick, children, title }) => (
  <button type="button" title={title} onClick={onClick} className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-slate-100 shadow-lg backdrop-blur hover:bg-slate-800">
    {children}
  </button>
);

/** Square-ish lightbox: checkerboard backdrop sized for the image, with room for floating bars. */
export const Stage: React.FC<{ children: React.ReactNode; className?: string; minHeight?: string }> = ({ children, className = '', minHeight = 'min-h-[320px] sm:min-h-[460px]' }) => (
  <div className={`relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 p-3 pb-16 pt-20 sm:pb-12 sm:pt-12 dark:border-slate-700/60 ${CHECKER_CLASS} ${minHeight} ${className}`}>
    {children}
  </div>
);

interface DropZoneProps {
  accept: string;
  multiple?: boolean;
  tone?: Tone;
  title: string;
  hint: string;
  pickLabel: string;
  pasteLabel?: string;
  icon?: React.ReactNode;
  onFiles: (files: File[]) => void;
  onPaste?: () => void;
  /** Existing content to wrap (receives the picker opener); omitted for the empty drop target. */
  children?: React.ReactNode | ((openPicker: () => void) => React.ReactNode);
  compact?: boolean;
  className?: string;
}

/** Drag-and-drop target with a file picker; wraps existing content so drops also replace it. */
export const DropZone: React.FC<DropZoneProps> = ({ accept, multiple = false, tone = 'amber', title, hint, pickLabel, pasteLabel, icon, onFiles, onPaste, children, compact = false, className = '' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const takeFiles = (list: FileList | null) => {
    if (list && list.length > 0) onFiles(Array.from(list));
  };
  const openPicker = () => inputRef.current?.click();
  const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes('Files');
  const content = typeof children === 'function' ? children(openPicker) : children;
  return (
    <div
      className={`relative ${className}`}
      onDragOver={(event) => { if (hasFiles(event)) { event.preventDefault(); setOver(true); } }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setOver(false); }}
      onDrop={(event) => { if (!hasFiles(event)) return; event.preventDefault(); setOver(false); takeFiles(event.dataTransfer.files); }}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden" onChange={(event) => { takeFiles(event.target.files); event.target.value = ''; }} />
      {content ?? (
        <div className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 text-center ${compact ? 'py-6' : 'py-16 sm:py-24'} ${over ? `${TONE[tone].ring} ${TONE[tone].soft}` : 'border-slate-300 dark:border-slate-600'}`}>
          <div className={`rounded-2xl p-3 ${TONE[tone].soft}`}>{icon ?? <ImagePlus className="h-7 w-7" />}</div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <ActionButton tone={tone} onClick={openPicker} icon={<ImagePlus className="h-4 w-4" />}>{pickLabel}</ActionButton>
            {onPaste && pasteLabel && <ActionButton tone={tone} variant="ghost" onClick={onPaste} icon={<ClipboardPaste className="h-4 w-4" />}>{pasteLabel}</ActionButton>}
          </div>
        </div>
      )}
      {content && over && <div className={`pointer-events-none absolute inset-0 z-20 rounded-2xl border-2 border-dashed ${TONE[tone].ring} ${TONE[tone].soft} backdrop-blur-sm`} />}
    </div>
  );
};

/** Hosts a canvas element produced by an image operation without copying its pixels. */
export const CanvasView: React.FC<{ canvas: HTMLCanvasElement | null; className?: string; maxHeight?: string }> = ({ canvas, className = '', maxHeight = '62vh' }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    if (!canvas) return;
    canvas.style.cssText = `display:block;max-width:100%;max-height:${maxHeight};width:auto;height:auto;object-fit:contain`;
    host.appendChild(canvas);
  }, [canvas, maxHeight]);
  return <div ref={hostRef} className={`flex max-w-full items-center justify-center ${className}`} />;
};

/** Before/after reveal: the "after" layer is clipped by a draggable divider. */
export const CompareSlider: React.FC<{
  beforeSrc: string; afterSrc: string; width: number; height: number; beforeLabel: string; afterLabel: string; ariaLabel: string;
}> = ({ beforeSrc, afterSrc, width, height, beforeLabel, afterLabel, ariaLabel }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0.5);
  const dragging = useRef(false);
  const move = (clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setPosition(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };
  return (
    <div
      ref={frameRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position * 100)}
      onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); move(event.clientX); }}
      onPointerMove={(event) => { if (dragging.current) move(event.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - COMPARE_STEP));
        if (event.key === 'ArrowRight') setPosition((p) => Math.min(1, p + COMPARE_STEP));
      }}
      className="relative max-h-[62vh] max-w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-lg shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(62vh * ${width / height}))` }}
    >
      <img src={beforeSrc} alt="" draggable={false} className="absolute inset-0 h-full w-full object-fill" />
      <img src={afterSrc} alt="" draggable={false} className="absolute inset-0 h-full w-full object-fill" style={{ clipPath: `inset(0 0 0 ${position * 100}%)` }} />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)]" style={{ left: `${position * 100}%` }}>
        <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-700 shadow-lg">&lt;&gt;</div>
      </div>
      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] font-bold text-white">{beforeLabel}</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">{afterLabel}</span>
    </div>
  );
};

/** Short-lived "copied" flag keyed by what was copied. */
export const useFlash = (): [string | null, (key: string) => void] => {
  const [flashed, setFlashed] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const flash = useCallback((key: string) => {
    setFlashed(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlashed(null), FLASH_MS);
  }, []);
  return [flashed, flash];
};

export const FileMeta: React.FC<{ name: string; width?: number; height?: number; bytes: number }> = ({ name, width, height, bytes }) => (
  <FloatingPill>
    <span className="max-w-[40vw] truncate sm:max-w-[260px]">{name}</span>
    {width !== undefined && height !== undefined && <span className="font-mono opacity-80">{width}x{height}</span>}
    <span className="font-mono opacity-80">{formatBytes(bytes)}</span>
  </FloatingPill>
);
