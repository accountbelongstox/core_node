import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Info, CheckCircle, AlertTriangle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning' | 'star';
}

interface WfNewToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const WfNewToast: React.FC<WfNewToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-24 right-4 z-[100] pointer-events-none flex flex-col gap-2.5 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    info: <Info className="w-4 h-4 text-blue-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    star: <Sparkles className="w-4 h-4 text-yellow-400" />
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="pointer-events-auto w-full bg-slate-900/95 backdrop-blur-xl border border-white/10 p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3.5"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
          {icons[toast.type || 'info']}
        </div>
        <p className="text-xs font-mono font-medium text-slate-100">{toast.text}</p>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[10px] text-zinc-500 hover:text-white px-2 py-1 font-mono hover:bg-white/5 rounded-md"
      >
        Dismiss
      </button>
    </motion.div>
  );
};
