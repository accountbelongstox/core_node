import { ApiResponse } from '../types/api';
import { ErrorHandler } from './errorHandler';

/**
 * API Call Wrapper
 * Unified error and response handling for API calls
 */
export class ApiWrapper {
  /**
   * Wrap API call, automatically handle errors
   * @param apiCall API call function
   * @param contextKey Translation key for context (used in error messages)
   * @param showToast Whether to show Toast (default true)
   * @returns Returns data on success, null on failure
   */
  static async wrap<T>(
    apiCall: () => Promise<ApiResponse<T>>,
    contextKey?: string,
    showToast: boolean = true
  ): Promise<T | null> {
    try {
      const response = await apiCall();
      return ErrorHandler.handleApiResponse(response, contextKey);
    } catch (error) {
      if (showToast) {
        ErrorHandler.handleError(error, contextKey);
      }
      return null;
    }
  }

  /**
   * Wrap API call, throw error on failure (for scenarios that need error handling)
   * @param apiCall API call function
   * @param contextKey Translation key for context
   * @returns Returns data on success, throws error on failure
   */
  static async wrapOrThrow<T>(
    apiCall: () => Promise<ApiResponse<T>>,
    contextKey?: string
  ): Promise<T> {
    try {
      const response = await apiCall();
      const result = ErrorHandler.handleApiResponse(response, contextKey);
      if (result === null) {
        throw new Error(response.message || response.error || 'Operation failed');
      }
      return result;
    } catch (error) {
      ErrorHandler.handleError(error, contextKey);
      throw error;
    }
  }

  /**
   * Wrap API call, return complete response object
   * @param apiCall API call function
   * @param contextKey Translation key for context
   * @returns API response object
   */
  static async wrapResponse<T>(
    apiCall: () => Promise<ApiResponse<T>>,
    contextKey?: string
  ): Promise<ApiResponse<T>> {
    try {
      const response = await apiCall();
      if (!response.success && contextKey) {
        ErrorHandler.handleApiResponse(response, contextKey);
      }
      return response;
    } catch (error) {
      ErrorHandler.handleError(error, contextKey);
      return {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

