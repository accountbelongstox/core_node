import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * WfNewHeaderPopover — the one popover used by header actions (notifications,
 * quick theme/language menu). The trigger stays in the header; the panel is a
 * fixed layer horizontally centered in the viewport just below the trigger, so
 * it is never clipped or off-center on phones, the Capacitor app or desktop.
 * The panel is portaled to <body>: the header's backdrop-filter would otherwise
 * become the containing block of the fixed layer.
 */
interface WfNewHeaderPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (toggle: () => void) => React.ReactNode;
  /** Tailwind width of the panel (clamped to the viewport by the wrapper padding). */
  widthClass?: string;
  children: React.ReactNode;
}

const PANEL_GAP_PX = 8;

export const WfNewHeaderPopover: React.FC<WfNewHeaderPopoverProps> = ({
  open, onOpenChange, trigger, widthClass = 'w-80', children,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [top, setTop] = useState(0);

  const toggle = useCallback(() => {
    if (!open && wrapRef.current) {
      setTop(wrapRef.current.getBoundingClientRect().bottom + PANEL_GAP_PX);
    }
    onOpenChange(!open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={wrapRef}>
      {trigger(toggle)}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="wf-header-popover"
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-x-0 z-[60] flex justify-center px-4 pointer-events-none"
              style={{ top }}
            >
              <div
                ref={panelRef}
                className={`pointer-events-auto ${widthClass} max-w-full rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden text-slate-200`}
              >
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};
