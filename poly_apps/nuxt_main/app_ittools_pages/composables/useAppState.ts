// Unified state management using Nuxt useState + storage persistence
import type { ModuleId } from '../types/navigation'
import { useStorage } from './useStorage'

export interface AppState {
  // UI state
  sidebarCollapsed: boolean
  mobileMenuOpen: boolean
  activeModule: ModuleId

  // User preferences
  theme: 'light' | 'dark' | 'auto'
  locale: string

  // App data
  user: {
    id?: number
    name?: string
    email?: string
    avatar?: string
  } | null
}

const DEFAULT_STATE: AppState = {
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  activeModule: 'api-testing',
  theme: 'auto',
  locale: 'zh-CN',
  user: null
}

export const useAppState = () => {
  const storage = useStorage()

  // Initialize state with values from storage
  const initializeState = <K extends keyof AppState>(
    key: K,
    defaultValue: AppState[K]
  ): AppState[K] => {
    if (process.client) {
      const stored = storage.getItem<AppState[K]>(key)
      return stored !== null ? stored : defaultValue
    }
    return defaultValue
  }

  // UI State
  const sidebarCollapsed = useState('sidebar-collapsed', () =>
    initializeState('sidebarCollapsed', DEFAULT_STATE.sidebarCollapsed)
  )

  const mobileMenuOpen = useState('mobile-menu-open', () =>
    initializeState('mobileMenuOpen', DEFAULT_STATE.mobileMenuOpen)
  )

  const activeModule = useState<ModuleId>('active-module', () =>
    initializeState('activeModule', DEFAULT_STATE.activeModule)
  )

  // User preferences
  const theme = useState('app-theme', () =>
    initializeState('theme', DEFAULT_STATE.theme)
  )

  const locale = useState('app-locale', () =>
    initializeState('locale', DEFAULT_STATE.locale)
  )

  // User data
  const user = useState('app-user', () =>
    initializeState('user', DEFAULT_STATE.user)
  )

  // Persist to storage when changed
  const setSidebarCollapsed = (value: boolean) => {
    sidebarCollapsed.value = value
    storage.setItem('sidebarCollapsed', value)
  }

  const setMobileMenuOpen = (value: boolean) => {
    mobileMenuOpen.value = value
    // Don't persist mobile menu state
  }

  const setActiveModule = (value: ModuleId) => {
    activeModule.value = value
    storage.setItem('activeModule', value)
  }

  const setTheme = (value: AppState['theme']) => {
    theme.value = value
    storage.setItem('theme', value)
  }

  const setLocale = (value: string) => {
    locale.value = value
    storage.setItem('locale', value)
  }

  const setUser = (value: AppState['user']) => {
    user.value = value
    storage.setItem('user', value)
  }

  // Toggle helpers
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed.value)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen.value)
  }

  // Reset state
  const resetState = () => {
    setSidebarCollapsed(DEFAULT_STATE.sidebarCollapsed)
    setMobileMenuOpen(DEFAULT_STATE.mobileMenuOpen)
    setActiveModule(DEFAULT_STATE.activeModule)
    setTheme(DEFAULT_STATE.theme)
    setLocale(DEFAULT_STATE.locale)
    setUser(DEFAULT_STATE.user)
  }

  return {
    // Readonly state
    sidebarCollapsed: readonly(sidebarCollapsed),
    mobileMenuOpen: readonly(mobileMenuOpen),
    activeModule: readonly(activeModule),
    theme: readonly(theme),
    locale: readonly(locale),
    user: readonly(user),

    // Setters
    setSidebarCollapsed,
    setMobileMenuOpen,
    setActiveModule,
    setTheme,
    setLocale,
    setUser,

    // Toggles
    toggleSidebar,
    toggleMobileMenu,

    // Reset
    resetState
  }
}
