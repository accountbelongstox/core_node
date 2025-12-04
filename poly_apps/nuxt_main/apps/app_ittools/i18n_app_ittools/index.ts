// Unified i18n configuration
import en from './locales/en'
import zhCN from './locales/zh-CN'

export const messages = {
  'en': en,
  'zh-CN': zhCN
}

export type Locale = keyof typeof messages
export type MessageSchema = typeof en

// Default locale
export const defaultLocale: Locale = 'zh-CN'

// Available locales
export const availableLocales: Locale[] = ['en', 'zh-CN']
