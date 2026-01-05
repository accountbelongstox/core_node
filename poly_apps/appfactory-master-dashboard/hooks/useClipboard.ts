import { useCallback, useState } from 'react';

/**
 * React Hook for clipboard operations
 * Uses React's useCallback instead of direct navigator.clipboard access
 * 
 * React best practice: Wrap browser APIs in hooks with proper error handling
 * 
 * @returns [copyToClipboard, isCopied, error]
 * 
 * Usage:
 *   const [copyToClipboard, isCopied] = useClipboard();
 *   <button onClick={() => copyToClipboard('text')}>Copy</button>
 */
export function useClipboard(): [
  (text: string) => Promise<boolean>,
  boolean,
  Error | null
] {
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Use React's useCallback for event handlers
  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      // Check if clipboard API is available (React best practice: check in callback)
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setError(null);
        
        // Reset copied state after 2 seconds
        setTimeout(() => setIsCopied(false), 2000);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (success) {
          setIsCopied(true);
          setError(null);
          setTimeout(() => setIsCopied(false), 2000);
          return true;
        } else {
          throw new Error('Clipboard API not available');
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to copy to clipboard');
      setError(error);
      setIsCopied(false);
      return false;
    }
  }, []);

  return [copyToClipboard, isCopied, error];
}

