// Unified i18n composable using Nuxt useState
import { messages, defaultLocale, type Locale, type MessageSchema } from '../i18n_app_ittools'

export const useI18n = () => {
  // Use Nuxt's useState for global state
  const locale = useState<Locale>('app-locale', () => {
    // Try to get locale from localStorage or use default
    if (process.client) {
      const stored = localStorage.getItem('app-locale')
      return (stored as Locale) || defaultLocale
    }
    return defaultLocale
  })

  // Change locale
  const setLocale = (newLocale: Locale) => {
    locale.value = newLocale
    if (process.client) {
      localStorage.setItem('app-locale', newLocale)
    }
  }

  // Get nested translation value
  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: any = messages[locale.value]

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        console.warn(`Translation key not found: ${key}`)
        return key
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`)
      return key
    }

    // Replace parameters if provided
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey]?.toString() || match
      })
    }

    return value
  }

  return {
    locale: readonly(locale),
    setLocale,
    t
  }
}
