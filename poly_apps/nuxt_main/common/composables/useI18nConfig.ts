import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGlobalConfig } from './useGlobalConfig';
import type { LanguageCode } from '@/common/stores/app-config-store';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

export const supportedLanguages: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: 'us' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: 'cn' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: 'jp' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: 'ir', rtl: true },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: 'es' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: 'fr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: 'de' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: 'ru' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: 'pt' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: 'it' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: 'pl' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: 'tr' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: 'se' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: 'hu' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: 'dk' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: 'gr' },
];

export function useI18nConfig() {
  const { locale: i18nLocale, t } = useI18n();
  const { locale: configLocale, setLocale: setConfigLocale, setRTL } = useGlobalConfig();

  const currentLanguage = computed(() => {
    const lang = supportedLanguages.find((lang) => lang.code === configLocale.value);
    return lang || supportedLanguages[0];
  });

  const availableLanguages = computed(() => supportedLanguages);

  const changeLanguage = (languageCode: LanguageCode) => {
    const language = supportedLanguages.find((lang) => lang.code === languageCode);

    if (language) {
      i18nLocale.value = languageCode;

      setConfigLocale(languageCode);

      if (language.rtl) {
        setRTL('rtl');
      } else {
        setRTL('ltr');
      }
    }
  };

  const getLanguageByCode = (code: LanguageCode): LanguageOption | undefined => {
    return supportedLanguages.find((lang) => lang.code === code);
  };

  const isRTLLanguage = (code: LanguageCode): boolean => {
    const language = getLanguageByCode(code);
    return language?.rtl || false;
  };

  return {
    currentLanguage,
    availableLanguages,
    changeLanguage,
    getLanguageByCode,
    isRTLLanguage,
    t,
  };
}
