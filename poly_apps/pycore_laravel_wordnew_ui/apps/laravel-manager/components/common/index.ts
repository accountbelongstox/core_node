// Unified reusable-component surface. Import shared UI from here instead of
// re-implementing it inline. Shared cross-app primitives live under shared/ui.
// See hooks/ for the reusable hooks: useApiResource,
// useLocalStorageList, useFileDrop, useApiRequest, useLocalStorage.)

// --- existing common ---
export { ToolContainer } from './ToolContainer';
export { CodeDisplay } from './CodeDisplay';
export { TextAreaInput } from './TextAreaInput';
export { CopyButton, CopyAllButton } from './CopyButton';
export type { CopyButtonProps } from './CopyButton';

// --- promoted primitives (single import surface; their source files are unchanged) ---
export { default as LoadingSpinner } from '@/apps/laravel-manager/components/common/LoadingSpinner';
export type { LoadingSpinnerProps } from '@/apps/laravel-manager/components/common/LoadingSpinner';
export { default as AudioButton } from '@/apps/laravel-manager/components/AudioButton';
export { Modal, ConfirmModal } from '../admin/Modal';
export type { ModalProps, ConfirmModalProps } from '../admin/Modal';
export { DataTable } from '../admin/DataTable';
export type { DataTableColumn, DataTableProps } from '../admin/DataTable';

// --- new reusables (this layer) ---
export { InlineSpinner, LoadingBlock } from './Loading';
export { EmptyState } from './EmptyState';
export { AlertBox } from './AlertBox';
export type { AlertVariant } from './AlertBox';
export { StatusBadge, StatusDot, statusTone } from './StatusBadge';
export type { StatusTone } from './StatusBadge';
export { FileDropzone } from './FileDropzone';
export { Field } from './Field';
export { StatCard, StatGrid } from './StatCard';
export type { StatCardProps, StatGridProps, StatCardTone } from './StatCard';
