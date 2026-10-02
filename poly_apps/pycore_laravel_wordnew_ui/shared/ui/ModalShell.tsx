import React, { useEffect } from 'react';
import Portal from './Portal';
import { OVERLAY_BACKDROP, OVERLAY_BACKDROP_STRONG, OVERLAY_CONTAINER, OVERLAY_Z } from '../styles/overlay';

interface ModalShellProps {
  open?: boolean;
  onClose: () => void;
  /** Block backdrop click / Escape (an operation is in flight). */
  locked?: boolean;
  layer?: keyof typeof OVERLAY_Z;
  /** `dim`: the standard see-through mask; `strong`: security-sensitive dialogs; `black`: lightboxes and players. */
  backdrop?: 'dim' | 'strong' | 'black';
  /** Card classes; pass `null` to render children without the card (full-screen viewers). */
  cardClassName?: string | null;
  children: React.ReactNode;
}

const BACKDROP: Record<NonNullable<ModalShellProps['backdrop']>, string> = {
  dim: OVERLAY_BACKDROP,
  strong: OVERLAY_BACKDROP_STRONG,
  black: 'bg-black/90 backdrop-blur-sm',
};

const DEFAULT_CARD = 'relative flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-zinc-900/95 shadow-2xl';

/** The one modal overlay: portal, z-layer, backdrop, Escape and backdrop-click close. */
export const ModalShell: React.FC<ModalShellProps> = ({
  open = true, onClose, locked = false, layer = 'modal', backdrop = 'dim', cardClassName = DEFAULT_CARD, children,
}) => {
  useEffect(() => {
    if (!open || locked) return undefined;
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, locked, onClose]);

  if (!open) return null;
  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z[layer]}`}>
        <div className={`absolute inset-0 ${BACKDROP[backdrop]}`} onClick={() => { if (!locked) onClose(); }} />
        {cardClassName === null ? children : <div className={cardClassName}>{children}</div>}
      </div>
    </Portal>
  );
};
