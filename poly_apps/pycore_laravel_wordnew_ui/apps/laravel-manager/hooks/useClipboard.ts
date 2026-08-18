import { useToast } from '@/apps/laravel-manager/components/admin';

export function useClipboard() {
  const toast = useToast();

  const copy = async (text: string, message: string = 'Copied to clipboard') => {
    try {
      // Check if clipboard API is available (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        // Modern async clipboard API
        await navigator.clipboard.writeText(text);
        toast.success(message);
        return true;
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (successful) {
            toast.success(message);
            return true;
          } else {
            toast.error('Failed to copy. Please copy manually.');
            return false;
          }
        } catch (err) {
          document.body.removeChild(textArea);
          toast.error('Failed to copy. Please copy manually.');
          return false;
        }
      }
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
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
