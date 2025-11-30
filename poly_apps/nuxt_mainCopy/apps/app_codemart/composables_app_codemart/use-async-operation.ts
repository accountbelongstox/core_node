/**
 * Generic Async Operation Composable Factory
 * Eliminates repetitive try-catch-finally patterns in composables
 * Provides unified loading and error state management
 */

import { ref, computed, Ref } from 'vue';

export interface AsyncOperationOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  resetOnExecute?: boolean;
}

export interface UseAsyncOperationReturn<T> {
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  errorMessage: Ref<string>;
  data: Ref<T | null>;
  isError: Ref<boolean>;
  isLoading: Ref<boolean>;
  isIdle: Ref<boolean>;
  isSuccess: Ref<boolean>;
  execute: () => Promise<T | undefined>;
  reset: () => void;
  clear: () => void;
  status: Ref<'idle' | 'loading' | 'success' | 'error'>;
}

export function useAsyncOperation<T = void>(
  operation: () => Promise<T>,
  options: AsyncOperationOptions<T> = {}
): UseAsyncOperationReturn<T> {
  const {
    immediate = false,
    onSuccess,
    onError,
    resetOnExecute = true,
  } = options;

  const loading = ref(false);
  const error = ref<Error | null>(null);
  const errorMessage = ref('');
  const data = ref<T | null>(null);
  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle');

  const isError = computed(() => error.value !== null);
  const isLoading = computed(() => loading.value);
  const isIdle = computed(() => status.value === 'idle');
  const isSuccess = computed(() => status.value === 'success');

  const reset = () => {
    if (resetOnExecute) {
      error.value = null;
      errorMessage.value = '';
      data.value = null;
    }
  };

  const clear = () => {
    loading.value = false;
    error.value = null;
    errorMessage.value = '';
    data.value = null;
    status.value = 'idle';
  };

  const execute = async (): Promise<T | undefined> => {
    reset();
    loading.value = true;
    status.value = 'loading';

    try {
      const result = await operation();
      data.value = result;
      status.value = 'success';

      if (onSuccess) {
        await onSuccess(result);
      }

      return result;
    } catch (err) {
      const error_obj = err instanceof Error ? err : new Error(String(err));
      error.value = error_obj;
      errorMessage.value = error_obj.message;
      status.value = 'error';

      if (onError) {
        await onError(error_obj);
      }

      throw error_obj;
    } finally {
      loading.value = false;
    }
  };

  if (immediate) {
    execute();
  }

  return {
    loading,
    error,
    errorMessage,
    data,
    isError,
    isLoading,
    isIdle,
    isSuccess,
    execute,
    reset,
    clear,
    status,
  };
}

export default useAsyncOperation;
