import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * Collapse — animates its children's height between 0 and auto via framer-motion
 * (mirrors the pycore PcCollapse pattern). Used for the inline secondary-setting
 * panels (filters / language pickers / advanced options) so they expand/collapse
 * instead of always taking vertical space.
 */
const Collapse: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        key="collapse"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

/**
 * CollapsibleSection — a header button with a chevron that toggles an inline
 * <Collapse> body. Reused for every secondary-settings disclosure on the page.
 */
export const CollapsibleSection: React.FC<{
  title: React.ReactNode;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, open, onToggle, children, className }) => (
  <div className={`rounded-lg border border-slate-200 dark:border-slate-700 ${className || ''}`}>
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
    >
      <span className="flex items-center gap-2">
        {icon}
        {title}
      </span>
      <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    <Collapse open={open}>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </Collapse>
  </div>
);
