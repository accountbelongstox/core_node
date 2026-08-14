import React from 'react';
import { UploadCloud } from 'lucide-react';
import { useFileDrop } from '@/apps/laravel-manager/hooks/useFileDrop';

/**
 * FileDropzone — one accessible drag-and-drop + click-to-browse uploader, replacing
 * the ~10 hand-rolled border-dashed dropzones. Centralizes accept/maxSize validation,
 * keyboard (Enter/Space) open, and consistent drag-active styling. Pass `children`
 * to render a custom inner layout while keeping the drag/validation behavior.
 */
export const FileDropzone: React.FC<{
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  label?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
  children?: (state: { isDragging: boolean }) => React.ReactNode;
}> = ({ onFiles, accept, multiple, maxSizeMB, label = 'Drop files here or click to upload', hint, disabled, className = '', children }) => {
  const { isDragging, dropProps, inputProps } = useFileDrop(onFiles, { accept, multiple, maxSizeMB });
  return (
    <div
      {...(disabled ? {} : dropProps)}
      aria-disabled={disabled}
      aria-label={label}
      className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
        ${isDragging ? 'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-500/10' : 'border-slate-300 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <input {...inputProps} />
      {children ? children({ isDragging }) : (
        <>
          <UploadCloud className="w-6 h-6 text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          {hint ? <p className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</p> : null}
        </>
      )}
    </div>
  );
};

export default FileDropzone;
