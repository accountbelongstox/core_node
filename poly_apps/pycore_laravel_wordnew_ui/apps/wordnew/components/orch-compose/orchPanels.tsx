/**
 * Building blocks every orchestration panel is made of: the bordered card, its icon chip + header, the
 * icon / text buttons, the dashed empty box and the "composition not available" state.
 */
import React from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { TONE_TEXT, type StatusTone } from '@/shared/ui/statusTone';
import type { ElementTheme } from '../../WfNewThemes';
import { WfNewLoadingDots } from '../WfNewLoadingDots';

type Trans = (key: string, replacements?: Record<string, string | number>) => string;

const PANEL_CLASS = 'rounded-2xl border border-slate-200 dark:border-white/5 p-3';
const BUTTON_BASE = 'inline-flex shrink-0 items-center justify-center gap-1 rounded-lg transition-colors disabled:opacity-40';
const BUTTON_VARIANT = {
  ghost: 'text-zinc-500 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-200',
  outline: 'border border-slate-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-white/10',
} as const;

interface OrchPanelProps {
  theme: ElementTheme;
  as?: 'section' | 'div' | 'li';
  label?: string;
  live?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** The bordered card of the orchestration pages (progress, assist, player, history, list rows). */
export const OrchPanel: React.FC<OrchPanelProps> = ({ theme, as: Tag = 'section', label, live = false, className = '', children }) => (
  <Tag className={`${PANEL_CLASS} ${theme.cardClass} ${className}`} aria-label={label} aria-live={live ? 'polite' : undefined}>{children}</Tag>
);

/** Theme-accent square holding an icon (panel and section headers). */
export const OrchIconChip: React.FC<{ icon: LucideIcon; theme: ElementTheme }> = ({ icon: Icon, theme }) => (
  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${theme.accentBg}`}>
    <Icon className="h-3.5 w-3.5" aria-hidden />
  </span>
);

/** Icon chip + title; extra children (counters, actions) follow on the same row. */
export const OrchPanelHeader: React.FC<{ icon: LucideIcon; title: string; theme: ElementTheme; children?: React.ReactNode }> = ({ icon, title, theme, children }) => (
  <div className="flex items-center gap-2">
    <OrchIconChip icon={icon} theme={theme} />
    <span className={`text-xs font-bold ${theme.textPrimaryClass}`}>{title}</span>
    {children}
  </div>
);

interface OrchButtonProps {
  icon?: LucideIcon;
  /** Accessible name and tooltip (icon-only buttons need it). */
  label?: string;
  variant?: keyof typeof BUTTON_VARIANT;
  tone?: StatusTone;
  spin?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}

/** The one small button of the orchestration pages: icon only (square) or icon + text. */
export const OrchButton: React.FC<OrchButtonProps> = ({ icon: Icon, label, variant = 'outline', tone = 'neutral', spin = false, disabled, onClick, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${tone === 'neutral' ? '' : TONE_TEXT[tone]} ${children ? 'px-2 py-1 text-[11px] font-bold' : 'p-1.5'} ${className}`}
  >
    {Icon && <Icon className={`${children ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${spin ? 'animate-spin' : ''}`} aria-hidden />}
    {children}
  </button>
);

/** Back to the compositions list. */
export const OrchBackButton: React.FC<{ trans: Trans; onBack: () => void; variant?: OrchButtonProps['variant']; showLabel?: boolean }> = ({ trans, onBack, variant = 'ghost', showLabel = false }) => (
  <OrchButton icon={ArrowLeft} label={trans('orchAudio.backToList')} variant={variant} onClick={onBack}>
    {showLabel ? trans('orchAudio.backToList') : null}
  </OrchButton>
);

/** Dashed placeholder box (empty list, nothing to play). */
export const OrchEmptyBox: React.FC<{ icon?: LucideIcon; children: React.ReactNode; className?: string }> = ({ icon: Icon, children, className = 'p-8' }) => (
  <div className={`rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-center ${className}`}>
    {Icon && <Icon className="mx-auto mb-2 h-6 w-6 text-zinc-600" aria-hidden />}
    <p className="text-xs font-mono text-zinc-500">{children}</p>
  </div>
);

/** A composition that is still loading (`undefined`) or does not exist (`null`). */
export const OrchTaskUnavailable: React.FC<{ missing: boolean; trans: Trans; onBack: () => void }> = ({ missing, trans, onBack }) => {
  if (!missing) return <WfNewLoadingDots className="text-indigo-600 dark:text-indigo-300" label={trans('content.loading')} />;
  return (
    <div className="space-y-4">
      <OrchBackButton trans={trans} onBack={onBack} showLabel />
      <p className="text-xs font-mono text-zinc-500">{trans('orchCompose.notFound')}</p>
    </div>
  );
};
