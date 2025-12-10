
import React from 'react';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
  onConfirm,
  onCancel
}) => {
  const colors = {
    danger: {
      confirm: 'bg-[#ff2a6d] hover:bg-[#ff2a6d]/80 text-white',
      icon: 'ph-warning text-[#ff2a6d]',
      border: 'border-[#ff2a6d]/30'
    },
    warning: {
      confirm: 'bg-[#ffd60a] hover:bg-[#ffd60a]/80 text-black',
      icon: 'ph-warning text-[#ffd60a]',
      border: 'border-[#ffd60a]/30'
    },
    info: {
      confirm: 'bg-[#00f2ff] hover:bg-[#00f2ff]/80 text-white',
      icon: 'ph-info text-[#00f2ff]',
      border: 'border-[#00f2ff]/30'
    }
  };

  const style = colors[type];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className={`
          w-full max-w-md bg-[#0a0c10] border rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)]
          overflow-hidden animate-scale-in ${style.border}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-white/10 flex items-center gap-3 px-6 bg-white/[0.02]">
          <i className={`ph ${style.icon} text-xl`}></i>
          <h3 className="text-sm font-bold text-white tracking-wide flex-1">{title}</h3>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="h-14 border-t border-white/10 flex items-center justify-end gap-3 px-6 bg-white/[0.02]">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors text-sm font-medium"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg ${style.confirm} transition-colors text-sm font-medium`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook for managing confirm dialogs
export const useConfirmDialog = () => {
  const [dialog, setDialog] = React.useState<ConfirmDialogOptions | null>(null);
  const [resolveCallback, setResolveCallback] = React.useState<((confirmed: boolean) => void) | null>(null);

  const showConfirmDialog = (options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog(options);
      setResolveCallback(() => resolve);
    });
  };

  const handleConfirm = () => {
    if (resolveCallback) {
      resolveCallback(true);
    }
    setDialog(null);
    setResolveCallback(null);
  };

  const handleCancel = () => {
    if (resolveCallback) {
      resolveCallback(false);
    }
    setDialog(null);
    setResolveCallback(null);
  };

  return {
    dialog,
    showConfirmDialog,
    ConfirmDialogComponent: dialog ? (
      <ConfirmDialog {...dialog} onConfirm={handleConfirm} onCancel={handleCancel} />
    ) : null
  };
};

