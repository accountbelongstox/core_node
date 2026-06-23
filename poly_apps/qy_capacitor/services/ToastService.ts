/**
 * Toast Service - Unified Toast Notification System
 * Supports both Capacitor native toast and web fallback
 * Multi-language and dark/light mode support
 */

import { Toast } from '@capacitor/toast';
import { Capacitor } from '@capacitor/core';
import { LanguageCenter } from '../i18n/LanguageCenter';

export type ToastPosition = 'top' | 'center' | 'bottom';
export type ToastDuration = 'short' | 'long';

export interface ToastOptions {
  message: string;
  duration?: ToastDuration;
  position?: ToastPosition;
  showButton?: boolean;
  buttonText?: string;
  onButtonClick?: () => void;
}

class ToastServiceClass {
  /**
   * Show a toast notification
   */
  async show(options: ToastOptions): Promise<void> {
    const t = (key: string) => LanguageCenter.t(key);
    
    // Use Capacitor Toast on native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        await Toast.show({
          text: options.message,
          duration: options.duration || 'short',
          position: options.position || 'bottom',
        });
      } catch (error) {
        console.error('[ToastService] Capacitor Toast failed, using web fallback:', error);
        this.showWebToast(options);
      }
    } else {
      // Use web fallback for PWA/web
      this.showWebToast(options);
    }
  }

  /**
   * Show success toast
   */
  async success(message: string, duration?: ToastDuration): Promise<void> {
    await this.show({ message, duration: duration || 'short' });
  }

  /**
   * Show error toast
   */
  async error(message: string, duration?: ToastDuration): Promise<void> {
    await this.show({ message, duration: duration || 'long' });
  }

  /**
   * Show warning toast
   */
  async warning(message: string, duration?: ToastDuration): Promise<void> {
    await this.show({ message, duration: duration || 'short' });
  }

  /**
   * Show info toast
   */
  async info(message: string, duration?: ToastDuration): Promise<void> {
    await this.show({ message, duration: duration || 'short' });
  }

  /**
   * Show toast with action button
   */
  async showWithAction(
    message: string,
    buttonText: string,
    onButtonClick: () => void,
    duration?: ToastDuration
  ): Promise<void> {
    await this.show({
      message,
      duration: duration || 'long',
      showButton: true,
      buttonText,
      onButtonClick,
    });
  }

  /**
   * Web fallback toast implementation using Tailwind CSS
   * Follows Material Design and iOS design guidelines for toast notifications
   */
  private showWebToast(options: ToastOptions): void {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      
      // Position classes based on position (following Material Design guidelines)
      const positionClasses = {
        top: 'top-4 left-1/2 -translate-x-1/2',
        center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        bottom: 'bottom-4 left-1/2 -translate-x-1/2',
      };
      
      container.className = `fixed z-[9999] pointer-events-none w-full max-w-sm px-4 ${positionClasses[options.position || 'bottom']}`;
      document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    toast.id = toastId;
    
    // Material Design inspired toast styling
    // - Rounded corners (8px/12px)
    // - Elevated shadow
    // - Dark background with high contrast text
    // - Smooth animations
    toast.className = 'mb-3 px-4 py-3 rounded-lg shadow-lg pointer-events-auto bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 animate-slide-up backdrop-blur-sm';

    // Toast content wrapper
    const content = document.createElement('div');
    content.className = 'flex items-center justify-between gap-4';
    
    // Message text (following Material Design typography)
    const messageEl = document.createElement('p');
    messageEl.className = 'flex-1 text-sm font-normal leading-relaxed';
    messageEl.textContent = options.message;
    content.appendChild(messageEl);

    // Add button if needed (Material Design action button style)
    if (options.showButton && options.buttonText && options.onButtonClick) {
      const button = document.createElement('button');
      button.className = 'px-3 py-1.5 rounded text-sm font-medium text-blue-400 hover:text-blue-300 active:text-blue-500 transition-colors uppercase tracking-wide';
      button.textContent = options.buttonText;
      button.onclick = () => {
        if (options.onButtonClick) {
          options.onButtonClick();
        }
        this.removeToast(toastId);
      };
      content.appendChild(button);
    }

    toast.appendChild(content);
    container.appendChild(toast);

    // Auto-remove after duration (matching Capacitor Toast durations)
    const durationMs = options.duration === 'long' ? 3500 : 2000;
    setTimeout(() => {
      this.removeToast(toastId);
    }, durationMs);
  }

  /**
   * Remove toast element
   */
  private removeToast(toastId: string): void {
    const toast = document.getElementById(toastId);
    if (toast) {
      toast.className = toast.className + ' opacity-0 -translate-y-2 transition-opacity transition-transform duration-300';
      setTimeout(() => {
        toast.remove();
        // Remove container if empty
        const container = document.getElementById('toast-container');
        if (container && container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }
  }
}

export const ToastService = new ToastServiceClass();

