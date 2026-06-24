import { useCallback } from 'react';
import { TRANSLATIONS } from '../../../constants';
import { useToast } from '../../admin/Toast';
import type { Language } from '../../../types';

/**
 * Copy-to-clipboard helper shared by the MCP tabs (screenshots / placeholder /
 * ocr). Modern async clipboard API with an execCommand fallback for non-secure
 * contexts; surfaces success/failure via the toast layer.
 */
export function useMcpClipboard(lang: Language = 'en') {
  const toast = useToast();
  const t = TRANSLATIONS[lang].mcp;

  return useCallback(
    async (text: string): Promise<void> => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          toast.success(t.screenshots.toast.copied);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
            toast.success(t.screenshots.toast.copied);
          } catch (err) {
            console.error('Failed to copy:', err);
            toast.error(t.screenshots.toast.copy_failed_manual);
          } finally {
            document.body.removeChild(textArea);
          }
        }
      } catch (err) {
        console.error('Copy to clipboard failed:', err);
        toast.error(t.screenshots.toast.copy_failed);
      }
    },
    [lang] // eslint-disable-line react-hooks/exhaustive-deps
  );
}
