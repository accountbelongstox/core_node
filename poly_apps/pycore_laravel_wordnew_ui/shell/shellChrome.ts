/**
 * Cross-end shell dock geometry — single source of truth for ShellControls.tsx.
 *
 * The floating dock sits at the viewport top-right (`fixed top-3 right-3 z-[60]`).
 * When expanded it shows Apps / Home / Laravel Manager / Pycore Manager / WordNew,
 * AI Chat, Light mode, English, etc. Any end-local chrome near that corner
 * (e.g. pycore-manager PcTopBar) MUST reserve `shellDockRightGutterPx()` so
 * controls do not overlap the dock toggle or its panel.
 *
 * Keep Tailwind classes in ShellControls aligned with these pixel values.
 */

/** Tailwind `top-3` / `right-3` → 0.75rem */
export const SHELL_DOCK_INSET_PX = 12;

/** Toggle button `w-10 h-10` */
export const SHELL_DOCK_BUTTON_PX = 40;

/** `gap-2` between toggle and expanded panel */
export const SHELL_DOCK_PANEL_GAP_PX = 8;

/** Expanded panel `w-60` → 15rem */
export const SHELL_DOCK_PANEL_WIDTH_PX = 240;

/** ShellControls root z-index */
export const SHELL_DOCK_Z_INDEX = 60;

/**
 * Right gutter end chrome must reserve from the viewport right edge.
 *
 * Worst case — shell menu open (Apps, Home, end switcher, theme, language):
 *   gutter = inset + panelWidth + inset
 *          = 12 + 240 + 12
 *          = 264px
 *
 * Collapsed dock (toggle only) occupies inset + button = 52px from the right;
 * the full gutter clears the expanded panel so menu rows never sit under
 * pycore's Laravel endpoint chip.
 */
export function shellDockRightGutterPx(): number {
  return SHELL_DOCK_INSET_PX + SHELL_DOCK_PANEL_WIDTH_PX + SHELL_DOCK_INSET_PX;
}

/** Viewport Y (px) immediately below the dock toggle — useful for dropdown hints. */
export function shellDockToggleBottomPx(): number {
  return SHELL_DOCK_INSET_PX + SHELL_DOCK_BUTTON_PX;
}

/** CSS custom property name set on `.shell-root` for end-local chrome. */
export const SHELL_DOCK_GUTTER_CSS_VAR = '--shell-dock-right-gutter';
