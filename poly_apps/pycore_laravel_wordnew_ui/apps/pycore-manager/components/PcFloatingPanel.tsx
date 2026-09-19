import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Global reusable floating panel (modal). One implementation for every
 * paged drill-down surface in pycore-manager: overlay click + Esc close,
 * propagation-safe body, optional footer slot (pager). Visual language
 * matches the agent-history dashboards.
 */
const PcFloatingPanel: React.FC<{
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  closeLabel: string;
  footer?: React.ReactNode;
  widthClass?: string;
  children: React.ReactNode;
}> = ({ open, title, subtitle, onClose, closeLabel, footer, widthClass, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
      onMouseDown={onClose}
    >
      <div
        className={`w-full ${widthClass || 'max-w-4xl'} max-h-[88vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl flex flex-col`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
        {footer && (
          <footer className="border-t border-slate-200 dark:border-white/10 px-4 py-2">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};

export default PcFloatingPanel;
