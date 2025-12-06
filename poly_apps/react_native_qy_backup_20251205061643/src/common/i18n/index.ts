import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';

const STORAGE_KEY = '@qy_language';

const resources = {
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  'en': { translation: en },
  'ja': { translation: ja },
  'ko': { translation: ko },
  'fr': { translation: fr },
  'de': { translation: de },
  'es': { translation: es },
};

// Get saved language or default
const getSavedLanguage = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    return saved || 'zh-CN';
  } catch {
    return 'zh-CN';
  }
};

// Initialize i18n
const initI18n = async () => {
  const savedLanguage = await getSavedLanguage();
  
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: savedLanguage,
      fallbackLng: 'zh-CN',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false,
      },
    });
};

// Change language
export const changeLanguage = async (lng: string) => {
  await i18n.changeLanguage(lng);
  await AsyncStorage.setItem(STORAGE_KEY, lng);
};

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || 'zh-CN';
};

// Initialize on import
initI18n();

export default i18n;

