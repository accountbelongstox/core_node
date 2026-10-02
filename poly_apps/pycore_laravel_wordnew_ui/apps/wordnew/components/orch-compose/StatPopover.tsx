import React, { useEffect, useRef, useState } from 'react';
import { Pill } from '@/shared/ui/Pill';
import type { ElementTheme } from '../../WfNewThemes';

interface Props {
  theme: ElementTheme;
  title: string;
  /** What the chip shows (icons and counters). */
  chip: React.ReactNode;
  /** Width and spacing of the opened panel. */
  panelClassName: string;
  fluid?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** A stat chip that opens a small panel below it; a click outside or Escape closes it. */
export const StatPopover: React.FC<Props> = ({ theme, title, chip, panelClassName, fluid = false, className = '', children }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${fluid ? 'min-w-0 max-w-full' : 'shrink-0'} ${className}`}>
      <Pill stat fluid={fluid} title={title} expanded={open} onClick={() => setOpen((value) => !value)}>{chip}</Pill>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={`absolute right-0 z-30 mt-1 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-white/10 p-3 shadow-lg ${theme.cardClass} ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
