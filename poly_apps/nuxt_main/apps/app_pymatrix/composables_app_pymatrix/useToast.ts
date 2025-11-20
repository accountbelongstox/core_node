/**
 * useToast Composable
 * Provides convenient access to toast notifications
 * Following Nuxt multi-app namespace architecture
 */

import { useToastStore } from '../stores_app_pymatrix/toastStore';

export function useToast() {
  const toastStore = useToastStore();

  return {
    /**
     * Show a success toast
     */
    success: (message: string, title?: string, duration?: number) => {
      return toastStore.success(message, title, duration);
    },

    /**
     * Show an error toast
     */
    error: (message: string, title?: string, duration?: number) => {
      return toastStore.error(message, title, duration);
    },

    /**
     * Show a warning toast
     */
    warning: (message: string, title?: string, duration?: number) => {
      return toastStore.warning(message, title, duration);
    },

    /**
     * Show an info toast
     */
    info: (message: string, title?: string, duration?: number) => {
      return toastStore.info(message, title, duration);
    },

    /**
     * Remove a specific toast by ID
     */
    remove: (id: string) => {
      toastStore.removeToast(id);
    },

    /**
     * Clear all toasts
     */
    clearAll: () => {
      toastStore.clearAll();
    }
  };
}
