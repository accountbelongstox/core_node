import { computed } from 'vue';
import { useAppConfigStore } from '@/common/stores/app-config-store';
import type { ThemeMode, LanguageCode, MenuType, LayoutType, NavbarType, DirectionType } from '@/common/stores/app-config-store';

export function useGlobalConfig() {
  const configStore = useAppConfigStore();

  const theme = computed(() => configStore.currentTheme);
  const locale = computed(() => configStore.currentLocale);
  const isDarkMode = computed(() => configStore.isDarkMode);
  const isRTL = computed(() => configStore.isRTL);
  const config = computed(() => configStore.config);

  const setTheme = (theme: ThemeMode) => {
    configStore.setTheme(theme);
  };

  const setLocale = (locale: LanguageCode) => {
    configStore.setLocale(locale);
  };

  const setMenu = (menu: MenuType) => {
    configStore.setMenu(menu);
  };

  const setLayout = (layout: LayoutType) => {
    configStore.setLayout(layout);
  };

  const setRTL = (rtl: DirectionType) => {
    configStore.setRTL(rtl);
  };

  const setNavbar = (navbar: NavbarType) => {
    configStore.setNavbar(navbar);
  };

  const setSemidark = (semidark: boolean) => {
    configStore.setSemidark(semidark);
  };

  const setAnimation = (animation: string) => {
    configStore.setAnimation(animation);
  };

  const toggleTheme = () => {
    configStore.toggleTheme();
  };

  const toggleRTL = () => {
    configStore.toggleRTL();
  };

  const resetToDefaults = () => {
    configStore.resetToDefaults();
  };

  const initialize = () => {
    configStore.initialize();
  };

  return {
    theme,
    locale,
    isDarkMode,
    isRTL,
    config,
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
    initialize,
  };
}
