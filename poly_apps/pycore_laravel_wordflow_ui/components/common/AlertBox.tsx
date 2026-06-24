import React from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, LucideIcon } from 'lucide-react';

export type AlertVariant = 'error' | 'warning' | 'info' | 'success';

const TOKENS: Record<AlertVariant, { box: string; icon: LucideIcon; iconColor: string }> = {
  error:   { box: 'bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-800/40 text-red-700 dark:text-red-300', icon: XCircle, iconColor: 'text-red-500' },
  warning: { box: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/40 text-amber-700 dark:text-amber-300', icon: AlertTriangle, iconColor: 'text-amber-500' },
  info:    { box: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200/60 dark:border-sky-800/40 text-sky-700 dark:text-sky-300', icon: Info, iconColor: 'text-sky-500' },
  success: { box: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300', icon: CheckCircle, iconColor: 'text-emerald-500' },
};

/**
 * AlertBox — one colored alert/info/warning/success box, dark-mode aware, with an
 * icon + a11y role. Consolidates ~82 inline bg-*-50/border-*-200 alert divs
 * (generalizes AiToolAlert).
 */
export const AlertBox: React.FC<{
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
  icon?: boolean;
}> = ({ variant = 'error', children, className = '', icon = true }) => {
  const t = TOKENS[variant];
  const Icon = t.icon;
  return (
    <div
      className={`px-4 py-3 rounded-xl border flex items-start gap-3 text-sm ${t.box} ${className}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      {icon ? <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${t.iconColor}`} /> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export default AlertBox;
