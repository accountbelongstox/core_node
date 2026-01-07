import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Toast Type
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast Item
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

/**
 * Toast Context Type
 */
interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

/**
 * Toast Context
 */
const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Toast Provider Props
 */
interface ToastProviderProps {
  children: React.ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Toast Provider Component
 */
export function ToastProvider({
  children,
  position = 'top-right',
  maxToasts = 5
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /**
   * Add a toast
   */
  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = generateId();
      const newToast: Toast = {
        id,
        duration: 5000,
        ...toast
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Limit max toasts
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      // Auto remove after duration
      if (newToast.duration) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }
    },
    [maxToasts]
  );

  /**
   * Remove a toast
   */
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /**
   * Shorthand methods
   */
  const success = useCallback(
    (message: string, title?: string) => {
      addToast({ type: 'success', message, title });
    },
    [addToast]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      addToast({ type: 'error', message, title, duration: 6000 });
    },
    [addToast]
  );

  const warning = useCallback(
    (message: string, title?: string) => {
      addToast({ type: 'warning', message, title });
    },
    [addToast]
  );

  const info = useCallback(
    (message: string, title?: string) => {
      addToast({ type: 'info', message, title });
    },
    [addToast]
  );

  const positionClass = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
  }[position];

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container */}
      <div className={`fixed ${positionClass} z-[9999] flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)] pointer-events-none`}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * ToastItem Component
 */
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { type, message, title } = toast;

  const styles = {
    success: {
      bg: 'bg-green-500/10 dark:bg-green-500/20 border-green-500/30 dark:border-green-500/40',
      icon: '✓',
      iconColor: 'text-green-500',
      text: 'text-green-700 dark:text-green-400',
      titleColor: 'text-green-800 dark:text-green-300'
    },
    error: {
      bg: 'bg-red-500/10 dark:bg-red-500/20 border-red-500/30 dark:border-red-500/40',
      icon: '✕',
      iconColor: 'text-red-500',
      text: 'text-red-700 dark:text-red-400',
      titleColor: 'text-red-800 dark:text-red-300'
    },
    warning: {
      bg: 'bg-yellow-500/10 dark:bg-yellow-500/20 border-yellow-500/30 dark:border-yellow-500/40',
      icon: '⚠',
      iconColor: 'text-yellow-500',
      text: 'text-yellow-700 dark:text-yellow-400',
      titleColor: 'text-yellow-800 dark:text-yellow-300'
    },
    info: {
      bg: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30 dark:border-blue-500/40',
      icon: 'ℹ',
      iconColor: 'text-blue-500',
      text: 'text-blue-700 dark:text-blue-400',
      titleColor: 'text-blue-800 dark:text-blue-300'
    }
  }[type];

  const style = styles;

  return (
    <div
      className={`glass border rounded-[2rem] p-4 shadow-2xl backdrop-blur-xl pointer-events-auto animate-in slide-in-from-right fade-in duration-300 ${style.bg}`}
      onClick={onClose}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-black ${style.iconColor} bg-white/20 dark:bg-black/20`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <div className={`text-sm font-black mb-1 ${style.titleColor}`}>
              {title}
            </div>
          )}
          <div className={`text-sm font-medium leading-relaxed ${style.text}`}>
            {message}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-2"
          aria-label="Close"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
    </div>
  );
}

/**
 * useToast Hook
 */
export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

