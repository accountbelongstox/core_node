import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Portal — renders children into a fresh element appended to <body>.
 *
 * Why this exists: overlays (modals, login boxes, lightboxes) were previously
 * rendered inline in the component tree. Any ancestor with `transform`,
 * `overflow-hidden/auto`, `filter` (e.g. backdrop-blur) or its own stacking
 * context would clip a `fixed inset-0` mask or trap its z-index, so masks were
 * not truly full-screen and could be squeezed/overlapped by sibling content.
 *
 * By portaling to a dedicated <body> child, the overlay escapes every parent
 * stacking/overflow context: `fixed inset-0` reliably covers the viewport and
 * the z-index scale in `styles/overlay.ts` is the only thing that orders it.
 *
 * A ref-counted body scroll lock keeps the background from scrolling while any
 * overlay is mounted (safe with stacked overlays).
 */

let lockCount = 0;

interface PortalProps {
  children: React.ReactNode;
  /** Lock background scroll while mounted (default true). */
  lockScroll?: boolean;
}

const Portal: React.FC<PortalProps> = ({ children, lockScroll = true }) => {
  const [host] = useState<HTMLDivElement | null>(() =>
    typeof document !== 'undefined' ? document.createElement('div') : null
  );

  // Attach/detach the host node to <body>.
  useEffect(() => {
    if (!host) return;
    host.setAttribute('data-overlay-portal', '');
    document.body.appendChild(host);
    return () => {
      document.body.removeChild(host);
    };
  }, [host]);

  // Ref-counted background scroll lock.
  useEffect(() => {
    if (!lockScroll) return;
    lockCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [lockScroll]);

  if (!host) return null;
  return createPortal(children, host);
};

export default Portal;
