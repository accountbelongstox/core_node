import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { LocalStorageManager } from '@/common/utils/localStorage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type MenuType = 'vertical' | 'collapsible-vertical' | 'horizontal';
export type LayoutType = 'full' | 'boxed-layout';
export type NavbarType = 'navbar-sticky' | 'navbar-floating' | 'navbar-static';
export type DirectionType = 'rtl' | 'ltr';
export type LanguageCode = 'en' | 'zh' | 'ja' | 'fa' | 'es' | 'fr' | 'de' | 'ru' | 'pt' | 'it' | 'pl' | 'tr' | 'sv' | 'hu' | 'da' | 'el';

export interface AppConfigState {
  theme: ThemeMode;
  locale: LanguageCode;
  menu: MenuType;
  layout: LayoutType;
  rtlClass: DirectionType;
  animation: string;
  navbar: NavbarType;
  semidark: boolean;
}

const STORAGE_KEY = 'global_config';

const defaultConfig: AppConfigState = {
  theme: 'light',
  locale: 'en',
  menu: 'vertical',
  layout: 'full',
  rtlClass: 'ltr',
  animation: '',
  navbar: 'navbar-sticky',
  semidark: false,
};

export const useAppConfigStore = defineStore('appConfig', () => {
  const config = ref<AppConfigState>({ ...defaultConfig });
  const isDarkMode = computed(() => {
    if (config.value.theme === 'system') {
      if (typeof window !== 'undefined') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
    }
    return config.value.theme === 'dark';
  });
  const currentLocale = computed(() => config.value.locale);
  const currentTheme = computed(() => config.value.theme);
  const isRTL = computed(() => config.value.rtlClass === 'rtl');

  function loadFromStorage(): void {
    const stored = LocalStorageManager.getItem<AppConfigState>(STORAGE_KEY);
    if (stored) {
      config.value = { ...defaultConfig, ...stored };
    }
  }

  function saveToStorage(): void {
    LocalStorageManager.setItem(STORAGE_KEY, config.value);
  }

  function setTheme(theme: ThemeMode): void {
    config.value.theme = theme;
    applyThemeToDOM();
    saveToStorage();
  }

  function setLocale(locale: LanguageCode): void {
    config.value.locale = locale;
    saveToStorage();
  }

  function setMenu(menu: MenuType): void {
    config.value.menu = menu;
    saveToStorage();
  }

  function setLayout(layout: LayoutType): void {
    config.value.layout = layout;
    saveToStorage();
  }

  function setRTL(rtl: DirectionType): void {
    config.value.rtlClass = rtl;
    applyDirectionToDOM();
    saveToStorage();
  }

  function setNavbar(navbar: NavbarType): void {
    config.value.navbar = navbar;
    saveToStorage();
  }

  function setSemidark(semidark: boolean): void {
    config.value.semidark = semidark;
    saveToStorage();
  }

  function setAnimation(animation: string): void {
    config.value.animation = animation;
    saveToStorage();
  }

  function applyThemeToDOM(): void {
    if (typeof window === 'undefined') return;

    const htmlElement = document.documentElement;
    const actualTheme = isDarkMode.value ? 'dark' : 'light';

    htmlElement.classList.remove('light', 'dark');
    htmlElement.classList.add(actualTheme);
    htmlElement.setAttribute('data-theme', actualTheme);
  }

  function applyDirectionToDOM(): void {
    if (typeof window === 'undefined') return;

    const htmlElement = document.documentElement;
    htmlElement.setAttribute('dir', config.value.rtlClass);
    htmlElement.classList.remove('rtl', 'ltr');
    htmlElement.classList.add(config.value.rtlClass);
  }

  function toggleTheme(): void {
    const newTheme: ThemeMode = config.value.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }

  function toggleRTL(): void {
    const newDirection: DirectionType = config.value.rtlClass === 'rtl' ? 'ltr' : 'rtl';
    setRTL(newDirection);
  }

  function resetToDefaults(): void {
    config.value = { ...defaultConfig };
    applyThemeToDOM();
    applyDirectionToDOM();
    saveToStorage();
  }

  function updateConfig(updates: Partial<AppConfigState>): void {
    config.value = { ...config.value, ...updates };
    if (updates.theme !== undefined) {
      applyThemeToDOM();
    }
    if (updates.rtlClass !== undefined) {
      applyDirectionToDOM();
    }
    saveToStorage();
  }

  function initialize(): void {
    loadFromStorage();
    applyThemeToDOM();
    applyDirectionToDOM();

    if (typeof window !== 'undefined' && config.value.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        applyThemeToDOM();
      });
    }
  }

  watch(
    () => config.value.theme,
    () => {
      applyThemeToDOM();
    }
  );

  watch(
    () => config.value.rtlClass,
    () => {
      applyDirectionToDOM();
    }
  );

  return {
    config,
    isDarkMode,
    currentLocale,
    currentTheme,
    isRTL,
    setTheme,
    setLocale,
    setMenu,
    setLayout,
    setRTL,
    setNavbar,
    setSemidark,
    setAnimation,
    toggleTheme,
    toggleRTL,
    resetToDefaults,
    updateConfig,
    initialize,
    loadFromStorage,
    saveToStorage,
  };
});
