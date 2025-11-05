# pyMatrix Layout Refactor Progress

- Initial assessment complete: repository structure, target documentation, and existing layout architecture reviewed.
- Device grid and video player styles now consume the new `--pm-color-*` tokens, replacing legacy `--pm-bg-*` and `--pm-primary` variables to restore the refreshed theme visuals.
- Verified the right control panel already used the updated design system so no additional CSS changes were required there.
- Settings and connect dialogs migrated off the deprecated `--pm-bg-*` / `--pm-border` variables so every visible modal uses the shared token palette.
- Keyboard shortcut helper and connection history overlays now rely on the same color tokens, eliminating the last `--pm-bg-*` references in user-facing panels.
- Layout now imports the theme globally (non-scoped) so the dark background, gradients, and shared button styles render across the entire page instead of falling back to plain white.
- Removed the legacy `pymatrix-theme.css` entry from `nuxt.config.ts` in favor of the new `app_pymatrix_theme.css`, ensuring the old Tailwind palette no longer overrides the redesigned tokens.
- Added aurora/glow utility classes plus enhanced button animations inside `app_pymatrix_theme.css`, then applied them to the top bar and side panels for richer gradients, floating effects, and interactive feedback.
- Added a persisted light/dark theme preference (stored via `uiPreferencesStore`) that toggles a `data-pm-theme` attribute and introduced a theme switcher button in the top bar. The theme file now contains light-mode variables so both palettes stay aligned.
