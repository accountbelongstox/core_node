import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import BentoCard from './BentoCard';

export type AiAccent = 'cyan' | 'emerald' | 'amber' | 'violet' | 'indigo';

export const AI_BODY = 'space-y-4 sm:space-y-5';
export const AI_GRID_2 = 'grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5';
export const AI_GRID_3 = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5';

/** BentoCard with standard AI Tools body padding. */
export const AiBentoCard: React.FC<React.ComponentProps<typeof BentoCard>> = (props) => (
  <BentoCard {...props} padded />
);

const TIPS_GRADIENT: Record<AiAccent, string> = {
  cyan: 'bg-gradient-to-br from-cyan-50/90 to-sky-50/90 dark:from-cyan-950/30 dark:to-sky-950/20',
  emerald: 'bg-gradient-to-br from-emerald-50/90 to-teal-50/90 dark:from-emerald-950/30 dark:to-teal-950/20',
  amber: 'bg-gradient-to-br from-amber-50/90 to-orange-50/90 dark:from-amber-950/30 dark:to-orange-950/20',
  violet: 'bg-gradient-to-br from-violet-50/90 to-fuchsia-50/90 dark:from-violet-950/30 dark:to-fuchsia-950/20',
  indigo: 'bg-gradient-to-br from-indigo-50/90 to-violet-50/90 dark:from-indigo-950/30 dark:to-violet-950/20',
};

const TIPS_ICON: Record<AiAccent, string> = {
  cyan: 'text-cyan-600 dark:text-cyan-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  violet: 'text-violet-600 dark:text-violet-400',
  indigo: 'text-indigo-600 dark:text-indigo-400',
};

interface AiToolActionsProps {
  children: ReactNode;
  className?: string;
}

export const AiToolActions: React.FC<AiToolActionsProps> = ({ children, className = '' }) => (
  <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
    {children}
  </div>
);

interface AiToolAlertProps {
  children: ReactNode;
  variant?: 'error' | 'warning' | 'info';
}

export const AiToolAlert: React.FC<AiToolAlertProps> = ({ children, variant = 'error' }) => {
  const styles = {
    error: 'bg-red-50/90 dark:bg-red-950/25 border-red-200/80 dark:border-red-800/60 text-red-600 dark:text-red-400',
    warning: 'bg-amber-50/90 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-800/60 text-amber-700 dark:text-amber-400',
    info: 'bg-sky-50/90 dark:bg-sky-950/25 border-sky-200/80 dark:border-sky-800/60 text-sky-700 dark:text-sky-400',
  };

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[variant]}`}>
      {children}
    </div>
  );
};

interface AiToolFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}

export const AiToolField: React.FC<AiToolFieldProps> = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
      {label}
    </label>
    {children}
    {hint && (
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{hint}</p>
    )}
  </div>
);

interface AiToolSegmentOption {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface AiToolSegmentProps {
  options: AiToolSegmentOption[];
  value: string;
  onChange: (id: string) => void;
}

export const AiToolSegment: React.FC<AiToolSegmentProps> = ({ options, value, onChange }) => (
  <div className="inline-flex p-1 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.04] ring-1 ring-slate-200/70 dark:ring-white/5">
    {options.map((opt) => {
      const Icon = opt.icon;
      const active = value === opt.id;
      return (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${active
              ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/60 dark:ring-white/10'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          {Icon && <Icon className="w-4 h-4" />}
          {opt.label}
        </button>
      );
    })}
  </div>
);

interface AiToolRangeProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  minLabel: string;
  maxLabel: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  accent?: AiAccent;
}

export const AiToolRange: React.FC<AiToolRangeProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  minLabel,
  maxLabel,
  onChange,
  disabled = false,
  accent = 'emerald',
}) => {
  const accentRing: Record<AiAccent, string> = {
    cyan: 'accent-cyan-500',
    emerald: 'accent-emerald-500',
    amber: 'accent-amber-500',
    violet: 'accent-violet-500',
    indigo: 'accent-indigo-500',
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer ${accentRing[accent]} disabled:opacity-50`}
        disabled={disabled}
      />
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
};

interface AiToolStatRowProps {
  left: ReactNode;
  right?: ReactNode;
}

export const AiToolStatRow: React.FC<AiToolStatRowProps> = ({ left, right }) => (
  <div className="flex items-center justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
    <span>{left}</span>
    {right != null && <span>{right}</span>}
  </div>
);

interface AiToolTipsProps {
  accent: AiAccent;
  items: { icon: LucideIcon; text: string }[];
}

export const AiToolTips: React.FC<AiToolTipsProps> = ({ accent, items }) => (
  <AiBentoCard title="Tips" className={TIPS_GRADIENT[accent]}>
    <ul className="text-sm space-y-2.5 text-slate-700 dark:text-slate-300">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.text} className="flex items-start gap-2.5">
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${TIPS_ICON[accent]}`} />
            <span>{item.text}</span>
          </li>
        );
      })}
    </ul>
  </AiBentoCard>
);

interface AiToolEmptyProps {
  icon: LucideIcon;
  message: string;
}

export const AiToolEmpty: React.FC<AiToolEmptyProps> = ({ icon: Icon, message }) => (
  <div className="col-span-full text-center py-12">
    <Icon className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
    <p className="text-slate-500 dark:text-slate-400">{message}</p>
  </div>
);
