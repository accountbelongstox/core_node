/**
 * Centralized overlay stacking scale.
 *
 * All overlays are portaled to <body> (see components/shared/Portal.tsx), so
 * these values only contend with each other and the app chrome. App chrome:
 *   - TopHeader  : z-40
 *   - Sidebar    : z-50
 *   - OfflineBanner: z-[100]
 * Overlays therefore start well above the chrome (1000+) and never need to
 * fight a local stacking context again.
 *
 * Order (low → high): feature modals < login/auth < toasts < error inspector.
 */
export const OVERLAY_Z = {
  /** Standard feature modals (forms, viewers, lightboxes). */
  modal: 'z-[1000]',
  /** Authentication / login — must sit above feature modals. */
  login: 'z-[1100]',
  /** Toast notifications — above modals so they remain visible. */
  toast: 'z-[1200]',
  /** Debug / error inspector — topmost. */
  error: 'z-[1300]',
} as const;

/**
 * Standard full-screen overlay container: a fixed, viewport-filling layer that
 * centers its modal card. Pair with a OVERLAY_Z value and wrap in <Portal/>.
 *
 * Usage:
 *   <Portal>
 *     <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal}`}>
 *       <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
 *       <div className="relative ...">…</div>
 *     </div>
 *   </Portal>
 */
export const OVERLAY_CONTAINER = 'fixed inset-0 flex items-center justify-center p-4';

/**
 * Standard semi-transparent mask. The overlay floats ABOVE the page and only
 * lightly dims it — the original UI stays visible through the backdrop (with a
 * soft blur to keep the dialog readable). Tune the opacity here to change the
 * see-through strength for every overlay at once.
 *
 *   `/35` → page clearly visible · `/50` → noticeably dimmed but still visible.
 */
export const OVERLAY_BACKDROP = 'bg-slate-900/35 dark:bg-slate-950/45 backdrop-blur-sm';

/** Slightly stronger dim for security-sensitive dialogs (still see-through). */
export const OVERLAY_BACKDROP_STRONG = 'bg-slate-900/50 dark:bg-slate-950/60 backdrop-blur-sm';
