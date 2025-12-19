/**
 * i18n多语言服务
 */
import { en, TranslationKeys } from '../locales/en';
import { zh } from '../locales/zh';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  zh: '中文',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

// 语言资源映射
const translations: Record<SupportedLanguage, TranslationKeys> = {
  en,
  zh,
};

// 获取嵌套属性的辅助函数
function getNestedProperty(obj: any, path: string): string {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return path; // 如果找不到，返回原始路径
    }
  }

  return typeof result === 'string' ? result : path;
}

/**
 * i18n服务类
 */
class I18nService {
  private currentLanguage: SupportedLanguage = 'en';
  private listeners: Set<() => void> = new Set();

  /**
   * 获取当前语言
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  /**
   * 设置当前语言
   */
  setLanguage(language: SupportedLanguage): void {
    if (this.currentLanguage !== language) {
      this.currentLanguage = language;
      this.notifyListeners();
    }
  }

  /**
   * 翻译文本
   * @param key - 翻译键，支持点号分隔的嵌套路径，如 'dashboard.title'
   * @param params - 可选的参数对象，用于替换占位符
   */
  t(key: string, params?: Record<string, string | number>): string {
    const translation = getNestedProperty(translations[this.currentLanguage], key);

    // 如果有参数，替换占位符
    if (params) {
      return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
        return text.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, translation);
    }

    return translation;
  }

  /**
   * 添加语言变化监听器
   */
  addListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  /**
   * 移除语言变化监听器
   */
  removeListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * 获取所有支持的语言
   */
  getSupportedLanguages(): typeof SUPPORTED_LANGUAGES {
    return SUPPORTED_LANGUAGES;
  }
}

// 导出单例
export const i18nService = new I18nService();
