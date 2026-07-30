/** Shared cross-fade/slide preset for swapping sub-tab panels. */
export const SUBTAB_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};
