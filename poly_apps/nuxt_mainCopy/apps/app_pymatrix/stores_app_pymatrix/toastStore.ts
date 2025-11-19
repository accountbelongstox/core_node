/**
 * Toast Notification Store
 * Manages toast notifications for pyMatrix app
 * Following Nuxt multi-app namespace architecture
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  icon?: string;
  timestamp: number;
}

export const useToastStore = defineStore('pymatrix-toast', () => {
  const toasts = ref<Toast[]>([]);
  const maxToasts = 5;
  const defaultDuration = 3000; // 3 seconds

  function generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function addToast(toast: Omit<Toast, 'id' | 'timestamp'>): string {
    const id = generateId();
    const newToast: Toast = {
      id,
      ...toast,
      duration: toast.duration ?? defaultDuration,
      dismissible: toast.dismissible ?? true,
      timestamp: Date.now()
    };

    // Add to beginning of array
    toasts.value.unshift(newToast);

    // Limit number of toasts
    if (toasts.value.length > maxToasts) {
      toasts.value = toasts.value.slice(0, maxToasts);
    }

    // Auto dismiss if duration is set
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  }

  function removeToast(id: string) {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  }

  function clearAll() {
    toasts.value = [];
  }

  // Helper methods for different toast types
  function success(message: string, title?: string, duration?: number): string {
    return addToast({
      type: 'success',
      title,
      message,
      duration,
      icon: '✅'
    });
  }

  function error(message: string, title?: string, duration?: number): string {
    return addToast({
      type: 'error',
      title,
      message,
      duration: duration ?? 5000, // Errors stay longer by default
      icon: '❌'
    });
  }

  function warning(message: string, title?: string, duration?: number): string {
    return addToast({
      type: 'warning',
      title,
      message,
      duration,
      icon: '⚠️'
    });
  }

  function info(message: string, title?: string, duration?: number): string {
    return addToast({
      type: 'info',
      title,
      message,
      duration,
      icon: 'ℹ️'
    });
  }

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info
  };
});
