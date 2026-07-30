import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * EmptyState — centered icon + message + optional action, dark-mode aware.
 * Consolidates the ~49 inline "No X yet/found" blocks (generalizes AiToolEmpty).
 */
export const EmptyState: React.FC<{
  icon?: LucideIcon;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, message, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center gap-2 py-10 px-4 text-slate-500 dark:text-slate-400 ${className}`}>
    {Icon ? <Icon className="w-10 h-10 opacity-30 mb-1" /> : null}
    {title ? <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p> : null}
    {message ? <p className="text-xs opacity-80 max-w-xs">{message}</p> : null}
    {action ? <div className="mt-3">{action}</div> : null}
  </div>
);

export default EmptyState;
