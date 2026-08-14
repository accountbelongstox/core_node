import { useState } from 'react';
import { useToast } from '@/apps/laravel-manager/components/admin';

export interface ToolOperationOptions {
  successMessage?: string;
  errorMessage?: string;
  validateInput?: () => boolean | string;
}

export function useToolOperation<T = any>() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string>('');
  const toast = useToast();

  const execute = async (
    operation: () => Promise<any>,
    options: ToolOperationOptions = {}
  ) => {
    if (options.validateInput) {
      const validation = options.validateInput();
      if (validation !== true) {
        toast.warning(typeof validation === 'string' ? validation : 'Invalid input');
        return null;
      }
    }

    setLoading(true);
    setError('');

    try {
      const res = await operation();

      if (res.success && res.data) {
        setResult(res.data);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        return res.data;
      } else {
        const errorMsg = res.error || options.errorMessage || 'Operation failed';
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
    } catch (err: any) {
      const errorMsg = err.message || options.errorMessage || 'Operation failed';
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError('');
    setLoading(false);
  };

  return { loading, result, error, execute, reset, setResult };
}
