import { useState, useRef, useCallback } from 'react';

/**
 * useFileDrop — drag-and-drop + click/keyboard-to-browse plumbing for file inputs,
 * factored out of the ~10 hand-rolled dropzones (OCRForm, MediaBrowser, FileTreePanel,
 * DocUploadPanel, BooksPanel, MCPManager...). A single drag-depth counter fixes the
 * onDragLeave flicker bugs; centralizes accept/maxSize filtering and a11y.
 */
export interface UseFileDropOptions {
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
}

export function useFileDrop(onFiles: (files: File[]) => void, opts: UseFileDropOptions = {}) {
  const { accept, multiple = false, maxSizeMB } = opts;
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filter = useCallback((list: FileList | null): File[] => {
    if (!list) return [];
    let files = Array.from(list);
    if (maxSizeMB) files = files.filter(f => f.size <= maxSizeMB * 1024 * 1024);
    return multiple ? files : files.slice(0, 1);
  }, [maxSizeMB, multiple]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = filter(e.target.files);
    if (f.length) onFiles(f);
    e.target.value = '';
  }, [filter, onFiles]);

  const dropProps = {
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); dragDepth.current++; setIsDragging(true); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); },
    onDragLeave: (e: React.DragEvent) => { e.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current = 0; setIsDragging(false); } },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); dragDepth.current = 0; setIsDragging(false);
      const f = filter(e.dataTransfer.files); if (f.length) onFiles(f);
    },
    onClick: openPicker,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); } },
    role: 'button' as const,
    tabIndex: 0,
  };

  const inputProps = { ref: inputRef, type: 'file' as const, accept, multiple, onChange, className: 'hidden' };

  return { isDragging, dropProps, inputProps, openPicker };
}

export default useFileDrop;
