/**
 * PcAiShared — shared building blocks for the unified AI page (PcAiPage).
 *
 *  - PcImageLightbox : a portaled, full-screen image popup (reuses the dashboard
 *                      Portal + OVERLAY_* scale) with a caption + action slot.
 *  - PcCollapse      : a framer-motion height collapse/expand wrapper for the
 *                      provider-card detail drawers.
 *  - small motion presets shared across the three sub-views.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Portal from '../../../components/shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../../styles/overlay';

/** Shared sub-tab cross-fade/slide preset (used by PcAiPage). */
export const SUBTAB_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

/**
 * PcCollapse — animates its children's height between 0 and auto. Mount/unmount
 * is handled by AnimatePresence so the exit animation plays before removal.
 */
export const PcCollapse: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        key="collapse"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}>
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

interface LightboxProps {
  open: boolean;
  src: string | null;
  alt?: string;
  caption?: React.ReactNode;
  /** Optional action row rendered under the caption (download / reuse / delete). */
  actions?: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
}

/**
 * PcImageLightbox — a portaled image popup. Used by the provider "Test" result,
 * the Image Studio message images and the history tiles. Escapes every parent
 * stacking context via <Portal/> and orders strictly by the OVERLAY_Z scale.
 */
export const PcImageLightbox: React.FC<LightboxProps> = ({
  open, src, alt, caption, actions, closeLabel = 'Close', onClose,
}) => (
  <AnimatePresence>
    {open && src && (
      <Portal>
        <motion.div
          className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}>
          <motion.div
            className="relative max-w-3xl w-full max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onClose}
              title={closeLabel}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white transition">
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1 min-h-0 overflow-auto bg-slate-100 dark:bg-black/40 flex items-center justify-center">
              <img src={src} alt={alt || ''} className="max-w-full max-h-[60vh] object-contain" />
            </div>
            {(caption || actions) && (
              <div className="p-4 space-y-2 border-t border-slate-200/80 dark:border-slate-800/80">
                {caption}
                {actions}
              </div>
            )}
          </motion.div>
        </motion.div>
      </Portal>
    )}
  </AnimatePresence>
);
