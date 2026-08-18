'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import Portal from '@/shared/ui/Portal';
import { OVERLAY_Z } from '@/shared/styles/overlay';

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
      addToast({ type: 'error', message, title });
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
      <Portal lockScroll={false}>
        <div className={`fixed ${positionClass} ${OVERLAY_Z.toast} flex flex-col gap-2 w-96 max-w-full`}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </div>
      </Portal>
    </ToastContext.Provider>
  );
}

/**
 * ToastItem Component
 */
function ToastItem({ toast, onClose }: { key?: React.Key; toast: Toast; onClose: () => void }) {
  const { type, message, title } = toast;

  const styles = {
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      text: 'text-green-900'
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: AlertCircle,
      iconColor: 'text-red-600',
      text: 'text-red-900'
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600',
      text: 'text-yellow-900'
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: Info,
      iconColor: 'text-blue-600',
      text: 'text-blue-900'
    }
  }[type];

  const Icon = styles.icon;

  return (
    <div
      className={`
        ${styles.bg} border rounded-lg p-4 shadow-lg
        animate-in slide-in-from-right duration-300
        flex items-start gap-3
      `}
    >
      <Icon className={`w-5 h-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />

      <div className="flex-1">
        {title && (
          <h4 className={`font-semibold ${styles.text} mb-1`}>{title}</h4>
        )}
        <p className={`text-sm ${styles.text}`}>{message}</p>
      </div>

      <button
        onClick={onClose}
        className="flex-shrink-0 hover:bg-black/5 rounded p-1 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * useToast Hook
 *
 * Usage:
 * const toast = useToast();
 * toast.success('Operation completed!');
 * toast.error('Something went wrong');
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}
