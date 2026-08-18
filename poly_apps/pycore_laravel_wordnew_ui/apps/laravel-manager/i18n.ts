import i18n from '../../core/i18n/UiI18n';
import { TRANSLATIONS } from './locales/LmTranslations';

const LANGUAGES = ['en', 'zh'] as const;

LANGUAGES.forEach((language) => {
  i18n.addResourceBundle(language, 'translation', TRANSLATIONS[language], true, true);
});

export { Trans, useTranslation } from '../../core/i18n/UiI18n';
export default i18n;
