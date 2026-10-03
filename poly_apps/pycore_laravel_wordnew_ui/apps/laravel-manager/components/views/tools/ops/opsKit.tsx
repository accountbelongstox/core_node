/** Visual kit of the ops workbenches: operations-console panels, status bar, gauges, sheets and controls. */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Check, CheckCircle2, Copy, Info, Loader2, Monitor, RefreshCw, Server, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ChipGroup } from '@/shared/ui/ChipGroup';
import type { ChipOption } from '@/shared/ui/ChipGroup';
import { ModalShell } from '@/shared/ui/ModalShell';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import { ProgressRing } from '@/shared/ui/ProgressRing';
import type { StatusTone } from '@/shared/ui/statusTone';
import { Switch } from '@/shared/ui/Switch';
import type { SwitchTone } from '@/shared/ui/Switch';
import { copyToClipboard } from '@/apps/laravel-manager/utils/exportResult';
import { useFlash } from './opsHooks';
import { formatTimestamp } from './opsLogic';
import type { LoadTone } from './opsLogic';

export type OpsAccent = 'fuchsia' | 'teal' | 'lime' | 'rose';

interface AccentSet {
  text: string;
  soft: string;
  solid: string;
  outline: string;
  ring: string;
  switchTone: SwitchTone;
  dot: string;
}

const ACCENTS: Record<OpsAccent, AccentSet> = {
  fuchsia: {
    text: 'text-fuchsia-600 dark:text-fuchsia-300',
    soft: 'bg-fuchsia-50 dark:bg-fuchsia-500/10',
    solid: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white',
    outline: 'border-fuchsia-300 dark:border-fuchsia-500/40',
    ring: 'focus:ring-fuchsia-500',
    switchTone: 'fuchsia',
    dot: 'bg-fuchsia-500',
  },
  teal: {
    text: 'text-teal-600 dark:text-teal-300',
    soft: 'bg-teal-50 dark:bg-teal-500/10',
    solid: 'bg-teal-600 hover:bg-teal-700 text-white',
    outline: 'border-teal-300 dark:border-teal-500/40',
    ring: 'focus:ring-teal-500',
    switchTone: 'emerald',
    dot: 'bg-teal-500',
  },
  lime: {
    text: 'text-lime-700 dark:text-lime-300',
    soft: 'bg-lime-50 dark:bg-lime-500/10',
    solid: 'bg-lime-600 hover:bg-lime-700 text-white',
    outline: 'border-lime-300 dark:border-lime-500/40',
    ring: 'focus:ring-lime-500',
    switchTone: 'emerald',
    dot: 'bg-lime-500',
  },
  rose: {
    text: 'text-rose-600 dark:text-rose-300',
    soft: 'bg-rose-50 dark:bg-rose-500/10',
    solid: 'bg-rose-600 hover:bg-rose-700 text-white',
    outline: 'border-rose-300 dark:border-rose-500/40',
    ring: 'focus:ring-rose-500',
    switchTone: 'rose',
    dot: 'bg-rose-500',
  },
};

const LOAD_STATUS_TONE: Record<LoadTone, StatusTone> = { ok: 'emerald', warn: 'amber', crit: 'rose' };
const LOAD_RING_COLOR: Record<LoadTone, string> = { ok: 'text-emerald-500', warn: 'text-amber-500', crit: 'text-rose-500' };
const LOAD_TEXT: Record<LoadTone, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  crit: 'text-rose-600 dark:text-rose-400',
};
const SURFACE = 'rounded-xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40';
const CONTROL_BASE = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 disabled:opacity-60';

export const accentOf = (accent: OpsAccent): AccentSet => ACCENTS[accent];
export const loadTextClass = (tone: LoadTone): string => LOAD_TEXT[tone];
export const controlClass = (accent: OpsAccent): string => `${CONTROL_BASE} ${ACCENTS[accent].ring}`;

export const OpsPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`mx-auto w-full max-w-6xl space-y-4 p-3 sm:p-5 ${className}`}>{children}</div>
);

interface OpsStatusBarProps {
  accent: OpsAccent;
  mode: 'server' | 'local';
  children?: React.ReactNode;
  updatedAt?: number | null;
  loading?: boolean;
  onRefresh?: () => void;
  auto?: { on: boolean; onChange: (on: boolean) => void; label?: string };
  trailing?: React.ReactNode;
}

/** Live status strip: where the tool runs, its current state, last update, auto-refresh and refresh. */
export const OpsStatusBar: React.FC<OpsStatusBarProps> = ({ accent, mode, children, updatedAt, loading = false, onRefresh, auto, trailing }) => {
  const { t, i18n } = useTranslation();
  const a = ACCENTS[accent];
  const ModeIcon = mode === 'server' ? Server : Monitor;
  return (
    <div className={`${SURFACE} flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2`}>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${a.soft} ${a.text}`}>
        <ModeIcon className="h-3.5 w-3.5" />
        {t(mode === 'server' ? 'uiTools.workbench.server_badge' : 'uiTools.workbench.local_badge')}
      </span>
      <div className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">{children}</div>
      {updatedAt !== undefined && (
        <span className="text-[11px] tabular-nums text-slate-400">{t('toolsOps.common.updated', { time: formatTimestamp(updatedAt, i18n.language) })}</span>
      )}
      {auto && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Switch on={auto.on} onChange={auto.onChange} tone={a.switchTone} label={auto.label ?? t('toolsOps.common.auto_refresh')} />
          <span>{auto.label ?? t('toolsOps.common.auto_refresh')}</span>
        </label>
      )}
      {trailing}
      {onRefresh && (
        <IconBtn icon={RefreshCw} spin={loading} title={t('toolsOps.common.refresh')} onClick={onRefresh} disabled={loading} />
      )}
    </div>
  );
};

interface PanelProps {
  title?: React.ReactNode;
  icon?: LucideIcon;
  accent?: OpsAccent;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ title, icon: Icon, accent = 'teal', actions, className = '', bodyClassName = 'p-4', children }) => (
  <section className={`${SURFACE} overflow-hidden ${className}`}>
    {(title || actions) && (
      <div className="flex min-h-[2.75rem] items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 dark:border-slate-700/50">
        <h3 className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {Icon && <Icon className={`h-4 w-4 shrink-0 ${ACCENTS[accent].text}`} />}
          <span className="truncate">{title}</span>
        </h3>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </section>
);

interface SegOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  title?: string;
  disabled?: boolean;
}

interface SegProps<T extends string | number> {
  value: T;
  options: readonly SegOption<T>[];
  onChange: (value: NoInfer<T>) => void;
  accent?: OpsAccent;
  block?: boolean;
  className?: string;
}

/** Joined single-choice toggle; the selected segment is a raised card in the accent colour. */
export function Seg<T extends string | number>({ value, options, onChange, accent = 'teal', block = false, className = '' }: SegProps<T>): React.ReactElement {
  return (
    <div role="radiogroup" className={`inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900/60 ${block ? 'flex w-full' : ''} ${className}`}>
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${block ? 'flex-1' : ''} ${
              selected ? `bg-white shadow-sm dark:bg-slate-700 ${ACCENTS[accent].text}` : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ChipsProps<T extends string | number | boolean> {
  value: T;
  options: readonly ChipOption<T>[];
  onChange: (value: NoInfer<T>) => void;
  accent?: OpsAccent;
  nowrap?: boolean;
  className?: string;
}

/** Filter / preset chips (shared ChipGroup with light and dark console colours). */
export function Chips<T extends string | number | boolean>({ value, options, onChange, accent = 'teal', nowrap = false, className = '' }: ChipsProps<T>): React.ReactElement {
  const a = ACCENTS[accent];
  return (
    <ChipGroup
      value={value}
      options={options}
      onChange={onChange}
      nowrap={nowrap}
      gapClassName="gap-1.5"
      className={className}
      chipClassName="rounded-full px-3 py-1 text-xs"
      selectedClassName={`${a.soft} ${a.text} ${a.outline}`}
      idleClassName="border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    />
  );
}

type BtnVariant = 'primary' | 'soft' | 'ghost' | 'danger' | 'dangerSoft';

interface BtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: BtnVariant;
  accent?: OpsAccent;
  icon?: LucideIcon;
  loading?: boolean;
  size?: 'sm' | 'md';
  children?: React.ReactNode;
}

const BTN_SIZE: Record<NonNullable<BtnProps['size']>, string> = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };

export const Btn: React.FC<BtnProps> = ({ variant = 'ghost', accent = 'teal', icon: Icon, loading = false, size = 'md', className = '', type = 'button', disabled, children, ...rest }) => {
  const a = ACCENTS[accent];
  const tone: Record<BtnVariant, string> = {
    primary: a.solid,
    soft: `${a.soft} ${a.text} hover:brightness-95`,
    ghost: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    dangerSoft: 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20',
  };
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${BTN_SIZE[size]} ${tone[variant]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
};

interface IconBtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'> {
  icon: LucideIcon;
  title: string;
  spin?: boolean;
  active?: boolean;
  accent?: OpsAccent;
}

export const IconBtn: React.FC<IconBtnProps> = ({ icon: Icon, title, spin = false, active = false, accent = 'teal', className = '', type = 'button', ...rest }) => (
  <button
    type={type}
    title={title}
    aria-label={title}
    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
      active ? `${ACCENTS[accent].soft} ${ACCENTS[accent].text} ${ACCENTS[accent].outline}` : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
    } ${className}`}
    {...rest}
  >
    <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />
  </button>
);

/** Copy-to-clipboard button with its own "copied" confirmation. */
export const CopyBtn: React.FC<{ text: string; accent?: OpsAccent; size?: 'sm' | 'md'; disabled?: boolean }> = ({ text, accent = 'teal', size = 'sm', disabled = false }) => {
  const { t } = useTranslation();
  const [copied, flash] = useFlash();
  const copy = async (): Promise<void> => {
    if (await copyToClipboard(text)) flash();
  };
  return (
    <Btn variant="soft" accent={accent} size={size} icon={copied ? Check : Copy} onClick={() => void copy()} disabled={disabled || !text}>
      {copied ? t('uiTools.common.copied') : t('uiTools.common.copy')}
    </Btn>
  );
};

export const Field: React.FC<{ label: React.ReactNode; hint?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ label, hint, className = '', children }) => (
  <div className={`space-y-1.5 ${className}`}>
    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
    {children}
    {hint && <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">{hint}</p>}
  </div>
);

type NoticeTone = 'error' | 'warn' | 'info' | 'ok';

const NOTICE: Record<NoticeTone, { icon: LucideIcon; cls: string }> = {
  error: { icon: XCircle, cls: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300' },
  warn: { icon: AlertTriangle, cls: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300' },
  info: { icon: Info, cls: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300' },
  ok: { icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' },
};

export const Notice: React.FC<{ tone?: NoticeTone; children: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ tone = 'info', children, action, className = '' }) => {
  const { icon: Icon, cls } = NOTICE[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${cls} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {action}
    </div>
  );
};

export const Metric: React.FC<{ label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; valueClassName?: string; icon?: LucideIcon }> = ({ label, value, hint, valueClassName = 'text-slate-900 dark:text-white', icon: Icon }) => (
  <div className={`${SURFACE} px-3.5 py-3`}>
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />}
    </div>
    <p className={`mt-1 truncate text-xl font-semibold tabular-nums ${valueClassName}`}>{value}</p>
    {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
  </div>
);

/** Circular gauge whose colour follows the load tone (green, amber, red). */
export const Gauge: React.FC<{ percent: number; tone: LoadTone; label: React.ReactNode; detail?: React.ReactNode }> = ({ percent, tone, label, detail }) => (
  <div className={`${SURFACE} flex items-center gap-4 px-4 py-3.5`}>
    <ProgressRing progress={percent / 100} sizeClass="h-20 w-20" colorClass={LOAD_RING_COLOR[tone]} trackClassName="text-slate-200 dark:text-white/10" strokeWidth={9}>
      <span className={`text-lg font-semibold tabular-nums ${LOAD_TEXT[tone]}`}>{Math.round(percent)}%</span>
    </ProgressRing>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      {detail && <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{detail}</p>}
    </div>
  </div>
);

/** Thin usage bar in the load tone. */
export const ToneBar: React.FC<{ percent: number; tone: LoadTone; label?: string }> = ({ percent, tone, label }) => (
  <ProgressBar done={percent} total={100} tone={LOAD_STATUS_TONE[tone]} label={label} className="h-1.5" />
);

export const StatusDot: React.FC<{ on: boolean; title?: string }> = ({ on, title }) => (
  <span title={title} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${on ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-slate-300 dark:bg-slate-600'}`} />
);

/** Dark terminal block for command output and logs. */
export const Console: React.FC<{ children: React.ReactNode; tone?: 'out' | 'err'; className?: string }> = ({ children, tone = 'out', className = '' }) => (
  <pre className={`max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed ${tone === 'err' ? 'text-rose-300' : 'text-emerald-300'} ${className}`}>{children}</pre>
);

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => <Loader2 className={`animate-spin ${className}`} />;

export const EmptyBlock: React.FC<{ icon: LucideIcon; children: React.ReactNode; className?: string }> = ({ icon: Icon, children, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500 ${className}`}>
    <Icon className="h-8 w-8 opacity-60" />
    <p className="max-w-sm">{children}</p>
  </div>
);

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Side sheet on wide screens, bottom sheet on phones; closes on Escape and backdrop click. */
export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, subtitle, footer, children }) => {
  const { t } = useTranslation();
  return (
    <ModalShell open={open} onClose={onClose} cardClassName={null}>
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col self-end rounded-2xl bg-white text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-slate-100 sm:ml-auto sm:max-h-full sm:self-stretch">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{t('toolsOps.common.close')}</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">{footer}</div>}
      </div>
    </ModalShell>
  );
};

/** Compact numbered pager used by the paginated lists. */
export const Pager: React.FC<{ page: number; pages: number; onChange: (page: number) => void; accent?: OpsAccent; summary?: React.ReactNode }> = ({ page, pages, onChange, accent = 'teal', summary }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="tabular-nums">{summary}</span>
      <div className="flex items-center gap-1.5">
        <Btn size="sm" accent={accent} onClick={() => onChange(page - 1)} disabled={page <= 1}>{t('toolsOps.common.prev')}</Btn>
        <span className="min-w-[4.5rem] text-center tabular-nums">{page} / {pages}</span>
        <Btn size="sm" accent={accent} onClick={() => onChange(page + 1)} disabled={page >= pages}>{t('toolsOps.common.next')}</Btn>
      </div>
    </div>
  );
};
