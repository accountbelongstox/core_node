import { ApiResponse } from '../types/api';
import { useToast } from './toast';
import { i18n } from './i18n';
import { Language } from '../types';

/**
 * Error handler utility class
 * Unified handling for all API errors and exceptions
 */
export class ErrorHandler {
  private static toast: ToastContextType | null = null;

  /**
   * Initialize Toast (called in App component)
   */
  static setToast(toast: ToastContextType) {
    this.toast = toast;
  }

  /**
   * Set language for error messages
   */
  static setLanguage(lang: Language) {
    i18n.setLanguage(lang);
  }

  /**
   * Get user-friendly error message
   */
  private static getUserMessage(error: any, defaultKey?: string): string {
    // API response error
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    if (error?.response?.data?.error) {
      return error.response.data.error;
    }

    // ApiResponse format error
    if (typeof error === 'object' && 'message' in error) {
      return error.message as string;
    }
    if (typeof error === 'object' && 'error' in error) {
      return error.error as string;
    }

    // Error object
    if (error instanceof Error) {
      return error.message;
    }

    // String error
    if (typeof error === 'string') {
      return error;
    }

    // Network error
    if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
      return i18n.t('errorNetworkFailed');
    }

    // Default message
    return defaultKey ? i18n.t(defaultKey as any) : i18n.t('errorOperationFailed');
  }

  /**
   * Handle API response error
   */
  static handleApiResponse<T>(response: ApiResponse<T>, contextKey?: string): T | null {
    if (response.success && response.data !== undefined) {
      return response.data;
    }

    const errorMessage = this.getUserMessage(response, 'errorRequestFailed');
    let title = i18n.t('errorOperationFailedTitle');
    if (contextKey) {
      // Try to get context-specific error title
      const contextTitle = i18n.t(`errorContext${contextKey}` as any);
      if (contextTitle && contextTitle !== `errorContext${contextKey}`) {
        title = `${contextTitle} ${i18n.t('errorTitle')}`;
      }
    }

    if (this.toast) {
      this.toast.error(errorMessage, title);
    } else {
      console.error(`[${contextKey || 'API'}]`, errorMessage);
    }

    return null;
  }

  /**
   * Handle exception error
   */
  static handleError(error: any, contextKey?: string, showToast: boolean = true): void {
    const errorMessage = this.getUserMessage(error, 'errorUnknownError');
    let title = i18n.t('errorTitle');
    if (contextKey) {
      // Try to get context-specific error title
      const contextTitle = i18n.t(`errorContext${contextKey}` as any);
      if (contextTitle && contextTitle !== `errorContext${contextKey}`) {
        title = `${contextTitle} ${i18n.t('errorTitle')}`;
      }
    }

    // Log to console
    console.error(`[${contextKey || 'Error'}]`, error);

    // Show Toast
    if (showToast && this.toast) {
      this.toast.error(errorMessage, title);
    }
  }

  /**
   * Handle success message
   */
  static handleSuccess(message: string, title?: string): void {
    if (this.toast) {
      this.toast.success(message, title || i18n.t('successTitle'));
    }
  }

  /**
   * Handle warning message
   */
  static handleWarning(message: string, title?: string): void {
    if (this.toast) {
      this.toast.warning(message, title || i18n.t('warningTitle'));
    }
  }

  /**
   * Handle info message
   */
  static handleInfo(message: string, title?: string): void {
    if (this.toast) {
      this.toast.info(message, title || i18n.t('infoTitle'));
    }
  }

  /**
   * Wrap async function, automatically handle errors
   */
  static async wrapAsync<T>(
    fn: () => Promise<T>,
    context?: string,
    showToast: boolean = true
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error, context, showToast);
      return null;
    }
  }

  /**
   * Wrap API call, automatically handle response and errors
   */
  static async wrapApiCall<T>(
    apiCall: () => Promise<ApiResponse<T>>,
    context?: string
  ): Promise<T | null> {
    try {
      const response = await apiCall();
      return this.handleApiResponse(response, context);
    } catch (error) {
      this.handleError(error, context);
      return null;
    }
  }
}

