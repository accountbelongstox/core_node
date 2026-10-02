import React from 'react';
import { X } from 'lucide-react';

interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  closeLabel?: string;
  /** Draw the divider under the header (sheets with a scrolling body). */
  bordered?: boolean;
  className?: string;
}

/** The one modal header: icon + title (+ subtitle) on the left, close button on the right. */
export const ModalHeader: React.FC<ModalHeaderProps> = ({ title, subtitle, icon, onClose, closeDisabled = false, closeLabel, bordered = false, className = '' }) => (
  <div className={`flex shrink-0 items-center justify-between gap-3 ${bordered ? 'border-b border-white/10 p-5' : ''} ${className}`}>
    <div className="min-w-0">
      <h3 className="flex items-center gap-2 truncate text-sm font-black text-slate-100">
        {icon}
        {title}
      </h3>
      {subtitle && <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">{subtitle}</p>}
    </div>
    {onClose && (
      <button type="button" onClick={onClose} disabled={closeDisabled} title={closeLabel} aria-label={closeLabel} className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-white/10 disabled:opacity-40">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

interface ModalFooterProps {
  children: React.ReactNode;
  bordered?: boolean;
  className?: string;
}

/** The one modal action row, right-aligned. */
export const ModalFooter: React.FC<ModalFooterProps> = ({ children, bordered = false, className = '' }) => (
  <div className={`flex shrink-0 justify-end gap-2 ${bordered ? 'border-t border-white/10 p-4' : 'pt-1'} ${className}`}>{children}</div>
);
