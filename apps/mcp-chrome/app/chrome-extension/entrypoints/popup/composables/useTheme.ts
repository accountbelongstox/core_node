/**
 * Theme composable — dark/light support for the popup.
 *
 * Applies a `theme-dark` / `theme-light` class to the popup root element. All
 * popup surfaces should style themselves with the semantic CSS variables defined
 * in `theme.css` (var(--surface), var(--text), …) so a single class swap restyles
 * the whole UI. The choice is persisted to chrome.storage.local.
 */
import { ref } from 'vue';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'popup_theme';
const theme = ref<ThemeMode>('dark');

/** Apply the theme class to the popup root (the element with [data-popup-root]). */
function applyTheme(mode: ThemeMode) {
  const root =
    (document.querySelector('[data-popup-root]') as HTMLElement | null) ||
    document.documentElement;
  root.classList.remove('theme-dark', 'theme-light');
  root.classList.add(`theme-${mode}`);
}

export function useTheme() {
  const setTheme = async (mode: ThemeMode) => {
    theme.value = mode;
    applyTheme(mode);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: mode });
    } catch {
      /* storage may be unavailable in some contexts; the class is already applied */
    }
  };

  const toggleTheme = () => setTheme(theme.value === 'dark' ? 'light' : 'dark');

  const initTheme = async () => {
    let mode: ThemeMode = 'dark';
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      if (stored[STORAGE_KEY] === 'light' || stored[STORAGE_KEY] === 'dark') {
        mode = stored[STORAGE_KEY];
      }
    } catch {
      /* fall back to dark */
    }
    theme.value = mode;
    applyTheme(mode);
  };

  return { theme, setTheme, toggleTheme, initTheme };
}
