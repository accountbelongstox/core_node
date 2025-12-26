import { useToast } from '../components/admin';

export function useClipboard() {
  const toast = useToast();

  const copy = async (text: string, message: string = 'Copied to clipboard') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
      return true;
    } catch (error) {
      toast.error('Failed to copy');
      return false;
    }
  };

  const copyMultiple = async (items: string[], message?: string) => {
    const text = items.join('\n');
    const defaultMessage = message || `Copied ${items.length} items`;
    return copy(text, defaultMessage);
  };

  return { copy, copyMultiple };
}
