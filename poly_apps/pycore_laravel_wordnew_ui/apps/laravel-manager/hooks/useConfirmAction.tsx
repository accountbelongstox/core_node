import React, { useCallback, useRef, useState } from 'react';
import { ConfirmModal } from '@/apps/laravel-manager/components/admin';

export type ConfirmActionVariant = 'danger' | 'warning' | 'info';

export interface ConfirmActionOptions {
  title?: string;
  message: string;
  variant?: ConfirmActionVariant;
  confirmText?: string;
  cancelText?: string;
  action: () => Promise<void> | void;
}

interface ConfirmActionState {
  open: boolean;
  loading: boolean;
  title?: string;
  message: string;
  variant: ConfirmActionVariant;
  confirmText?: string;
  cancelText?: string;
}

const INITIAL_STATE: ConfirmActionState = { open: false, loading: false, message: '', variant: 'warning' };

export function useConfirmAction() {
  const [state, setState] = useState<ConfirmActionState>(INITIAL_STATE);
  const actionRef = useRef<ConfirmActionOptions['action'] | null>(null);
  const runningRef = useRef(false);

  const requestConfirm = useCallback((opts: ConfirmActionOptions) => {
    actionRef.current = opts.action;
    setState({
      open: true,
      loading: false,
      title: opts.title,
      message: opts.message,
      variant: opts.variant ? opts.variant : 'warning',
      confirmText: opts.confirmText,
      cancelText: opts.cancelText
    });
  }, []);

  const close = useCallback(() => {
    if (runningRef.current) return;
    actionRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const accept = useCallback(async () => {
    const action = actionRef.current;
    if (!action || runningRef.current) return;
    runningRef.current = true;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await action();
    } finally {
      runningRef.current = false;
      actionRef.current = null;
      setState((prev) => ({ ...prev, open: false, loading: false }));
    }
  }, []);

  const confirmDialog = (
    <ConfirmModal
      isOpen={state.open}
      onClose={close}
      onConfirm={accept}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      variant={state.variant}
      loading={state.loading}
    />
  );

  return { requestConfirm, confirmDialog };
}
