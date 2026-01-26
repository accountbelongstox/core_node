/**
 * Dialog Manager - Manages dialog state and rendering
 * Provides React-based dialog fallback for web
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogProps } from './Dialog';

interface DialogState {
  id: string;
  props: Omit<DialogProps, 'onConfirm' | 'onCancel'>;
  resolve: (value: any) => void;
  reject: () => void;
}

let dialogQueue: DialogState[] = [];
let setDialogState: ((dialogs: DialogState[]) => void) | null = null;

export const showDialog = (props: Omit<DialogProps, 'onConfirm' | 'onCancel'>): Promise<any> => {
  return new Promise((resolve, reject) => {
    const id = `dialog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    dialogQueue.push({ id, props, resolve, reject });
    if (setDialogState) {
      setDialogState([...dialogQueue]);
    }
  });
};

export const DialogManager: React.FC = () => {
  const [dialogs, setDialogs] = useState<DialogState[]>([]);

  useEffect(() => {
    setDialogState = setDialogs;
    // Process any queued dialogs
    if (dialogQueue.length > 0) {
      setDialogs([...dialogQueue]);
    }
  }, []);

  const handleConfirm = (dialog: DialogState, value?: string) => {
    if (dialog.props.type === 'prompt') {
      dialog.resolve({ value: value || '', cancelled: false });
    } else if (dialog.props.type === 'confirm') {
      dialog.resolve({ value: true });
    } else {
      dialog.resolve(undefined);
    }
    removeDialog(dialog.id);
  };

  const handleCancel = (dialog: DialogState) => {
    if (dialog.props.type === 'prompt') {
      dialog.resolve({ value: '', cancelled: true });
    } else if (dialog.props.type === 'confirm') {
      dialog.resolve({ value: false });
    } else {
      dialog.resolve(undefined);
    }
    removeDialog(dialog.id);
  };

  const removeDialog = (id: string) => {
    dialogQueue = dialogQueue.filter((d) => d.id !== id);
    setDialogs([...dialogQueue]);
  };

  if (dialogs.length === 0) return null;

  return (
    <>
      {dialogs.map((dialog) => (
        <Dialog
          key={dialog.id}
          {...dialog.props}
          onConfirm={(value) => handleConfirm(dialog, value)}
          onCancel={() => handleCancel(dialog)}
        />
      ))}
    </>
  );
};

