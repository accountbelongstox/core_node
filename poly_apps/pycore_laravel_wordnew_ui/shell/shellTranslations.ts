import i18n from '../core/i18n/UiI18n';

const SHELL_TRANSLATIONS = {
  en: {
    common: {
      loading: 'Loading...',
      unknown_app_flavor: 'Unknown app flavor: {{id}}',
    },
  },
  zh: {
    common: {
      loading: '加载中...',
      unknown_app_flavor: '未知应用类型：{{id}}',
    },
  },
} as const;

Object.entries(SHELL_TRANSLATIONS).forEach(([language, resources]) => {
  i18n.addResourceBundle(language, 'translation', resources, true, true);
});
