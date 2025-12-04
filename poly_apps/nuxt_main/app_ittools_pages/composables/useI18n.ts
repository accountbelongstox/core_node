// Unified i18n composable using Nuxt useState
import { messages, defaultLocale, type Locale, type MessageSchema } from '../i18n'
import { useStorage } from './useStorage'

export const useI18n = () => {
  const storage = useStorage()

  // Use Nuxt's useState for global state
  const locale = useState<Locale>('app-locale', () => {
    // Try to get locale from storage or use default
    if (process.client) {
      const stored = storage.getItem<Locale>('app-locale')
      return stored || defaultLocale
    }
    return defaultLocale
  })

  // Change locale
  const setLocale = (newLocale: Locale) => {
    locale.value = newLocale
    if (process.client) {
      storage.setItem('app-locale', newLocale)
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
