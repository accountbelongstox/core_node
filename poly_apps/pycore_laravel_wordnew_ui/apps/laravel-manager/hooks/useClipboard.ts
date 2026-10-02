import { useToast } from '@/apps/laravel-manager/components/admin';
import i18n from '@/apps/laravel-manager/i18n';

export function useClipboard() {
  const toast = useToast();

  const copy = async (text: string, message?: string) => {
    const successMessage = message ? message : i18n.t('uiCommon.clipboard.copied');
    try {
      // Check if clipboard API is available (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        // Modern async clipboard API
        await navigator.clipboard.writeText(text);
        toast.success(successMessage);
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
            toast.success(successMessage);
            return true;
          } else {
            toast.error(i18n.t('uiCommon.clipboard.copy_failed_manual'));
            return false;
          }
        } catch (err) {
          document.body.removeChild(textArea);
          toast.error(i18n.t('uiCommon.clipboard.copy_failed_manual'));
          return false;
        }
      }
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      toast.error(i18n.t('uiCommon.clipboard.copy_failed'));
      return false;
    }
  };

  const copyMultiple = async (items: string[], message?: string) => {
    const text = items.join('\n');
    const defaultMessage = message || i18n.t('uiCommon.clipboard.copied_items', { count: items.length });
    return copy(text, defaultMessage);
  };

  return { copy, copyMultiple };
}
