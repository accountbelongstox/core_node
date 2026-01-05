import { useEffect, useRef, useCallback } from 'react';

/**
 * React Hook for auto-resizing textarea based on content
 * Uses React refs and state instead of direct DOM manipulation
 * 
 * @param value - Textarea value
 * @param maxHeight - Maximum height in pixels (default: 120)
 * @returns Ref object to attach to textarea
 * 
 * Usage:
 *   const textareaRef = useAutoResizeTextarea(message, 120);
 *   <textarea ref={textareaRef} value={message} />
 */
export function useAutoResizeTextarea(
  value: string,
  maxHeight: number = 120
): React.RefObject<HTMLTextAreaElement> {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = 'auto';
      // Set height based on content, capped at maxHeight
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  }, [maxHeight]);

  // Adjust height when value changes
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return textareaRef;
}

