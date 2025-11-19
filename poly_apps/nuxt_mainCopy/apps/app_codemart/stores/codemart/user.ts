/**
 * User Store
 *
 * Global state management for user authentication and profile:
 * - Current user information
 * - Authentication state
 * - User preferences
 * - User permissions and roles
 * - Session management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type UserRole = 'client' | 'developer' | 'architect' | 'reviewer' | 'admin'

export interface User {
  id: number
  username: string
  email: string
  full_name?: string
  avatar?: string
  role: UserRole
  bio?: string
  company?: string
  location?: string
  skills?: string[]
  languages?: string[]
  website?: string
  github?: string
  linkedin?: string
  phone?: string
  verified: boolean
  kyc_status?: 'pending' | 'approved' | 'rejected'
  created_at: string
  last_login?: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  language: 'en' | 'zh'
  notifications: {
    email: boolean
    push: boolean
    sms: boolean
  }
  privacy: {
    showEmail: boolean
    showPhone: boolean
    showProfile: boolean
  }
}

export interface UserPermissions {
  canCreateProject: boolean
  canApplyToTask: boolean
  canReviewCode: boolean
  canManageUsers: boolean
  canAccessAdmin: boolean
  canWithdrawFunds: boolean
}

export const useUserStore = defineStore('codemart-user', () => {
  // State
  const currentUser = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const authToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const preferences = ref<UserPreferences>({
    theme: 'auto',
    language: 'zh',
    notifications: {
      email: true,
      push: true,
      sms: false
    },
    privacy: {
      showEmail: false,
      showPhone: false,
      showProfile: true
    }
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Session
  const sessionExpiry = ref<number | null>(null)
  const lastActivity = ref<number>(Date.now())

  const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  // Getters
  const userId = computed(() => currentUser.value?.id)
  const username = computed(() => currentUser.value?.username)
  const email = computed(() => currentUser.value?.email)
  const userRole = computed(() => currentUser.value?.role)
  const isVerified = computed(() => currentUser.value?.verified || false)
  const isKYCApproved = computed(() => currentUser.value?.kyc_status === 'approved')

  const fullName = computed(() => {
    return currentUser.value?.full_name || currentUser.value?.username || 'Guest'
  })

  const avatarUrl = computed(() => {
    return currentUser.value?.avatar || '/default-avatar.png'
  })

  const permissions = computed<UserPermissions>(() => {
    if (!currentUser.value) {
      return {
        canCreateProject: false,
        canApplyToTask: false,
        canReviewCode: false,
        canManageUsers: false,
        canAccessAdmin: false,
        canWithdrawFunds: false
      }
    }

    const role = currentUser.value.role
    const verified = currentUser.value.verified
    const kycApproved = isKYCApproved.value

    return {
      canCreateProject: (role === 'client' || role === 'admin') && verified && kycApproved,
      canApplyToTask: (role === 'developer' || role === 'admin') && verified && kycApproved,
      canReviewCode: (role === 'reviewer' || role === 'architect' || role === 'admin') && verified,
      canManageUsers: role === 'admin',
      canAccessAdmin: role === 'admin',
      canWithdrawFunds: verified && kycApproved
    }
  })

  const isSessionValid = computed(() => {
    if (!sessionExpiry.value) return false
    return Date.now() < sessionExpiry.value
  })

  const isSessionActive = computed(() => {
    return Date.now() - lastActivity.value < SESSION_TIMEOUT
  })

  const requiresKYC = computed(() => {
    return !isKYCApproved.value && (
      currentUser.value?.role === 'client' ||
      currentUser.value?.role === 'developer'
    )
  })

  // Actions - Authentication
  function setUser(user: User) {
    currentUser.value = user
    isAuthenticated.value = true
    updateActivity()
  }

  function setAuthToken(token: string, refresh?: string) {
    authToken.value = token
    if (refresh) {
      refreshToken.value = refresh
    }

    // Store in localStorage
    try {
      localStorage.setItem('codemart_auth_token', token)
      if (refresh) {
        localStorage.setItem('codemart_refresh_token', refresh)
      }
    } catch (err) {
      console.error('Failed to save auth token:', err)
    }

    // Set session expiry (24 hours)
    sessionExpiry.value = Date.now() + 24 * 60 * 60 * 1000
  }

  function clearAuth() {
    currentUser.value = null
    isAuthenticated.value = false
    authToken.value = null
    refreshToken.value = null
    sessionExpiry.value = null

    // Clear from localStorage
    try {
      localStorage.removeItem('codemart_auth_token')
      localStorage.removeItem('codemart_refresh_token')
    } catch (err) {
      console.error('Failed to clear auth token:', err)
    }
  }

  function logout() {
    clearAuth()
    // TODO: Call logout API
  }

  // Actions - User Profile
  function updateUser(updates: Partial<User>) {
    if (currentUser.value) {
      currentUser.value = { ...currentUser.value, ...updates }
    }
  }

  function updateProfile(profileData: Partial<User>) {
    updateUser(profileData)
    // TODO: Call update profile API
  }

  // Actions - Preferences
  function updatePreferences(updates: Partial<UserPreferences>) {
    preferences.value = {
      ...preferences.value,
      ...updates,
      notifications: {
        ...preferences.value.notifications,
        ...(updates.notifications || {})
      },
      privacy: {
        ...preferences.value.privacy,
        ...(updates.privacy || {})
      }
    }
    savePreferences()
  }

  function savePreferences() {
    try {
      localStorage.setItem('codemart_user_preferences', JSON.stringify(preferences.value))
    } catch (err) {
      console.error('Failed to save preferences:', err)
    }
  }

  function loadPreferences() {
    try {
      const prefsStr = localStorage.getItem('codemart_user_preferences')
      if (prefsStr) {
        const prefs = JSON.parse(prefsStr)
        preferences.value = { ...preferences.value, ...prefs }
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
    }
  }

  // Actions - Session Management
  function updateActivity() {
    lastActivity.value = Date.now()
  }

  function checkSession(): boolean {
    if (!isSessionValid.value) {
      clearAuth()
      return false
    }

    if (!isSessionActive.value) {
      clearAuth()
      return false
    }

    return true
  }

  function refreshSession() {
    // TODO: Implement token refresh logic
    sessionExpiry.value = Date.now() + 24 * 60 * 60 * 1000
  }

  // Actions - Permissions
  function hasPermission(permission: keyof UserPermissions): boolean {
    return permissions.value[permission]
  }

  function hasRole(role: UserRole | UserRole[]): boolean {
    if (!currentUser.value) return false

    if (Array.isArray(role)) {
      return role.includes(currentUser.value.role)
    }

    return currentUser.value.role === role
  }

  // Actions - State Management
  function setLoading(value: boolean) {
    loading.value = value
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }

  // Actions - Initialization
  function initialize() {
    loadPreferences()

    // Try to load auth token from localStorage
    try {
      const token = localStorage.getItem('codemart_auth_token')
      const refresh = localStorage.getItem('codemart_refresh_token')

      if (token) {
        authToken.value = token
        if (refresh) {
          refreshToken.value = refresh
        }

        // TODO: Validate token and fetch user data
        // For now, just set session expiry
        sessionExpiry.value = Date.now() + 24 * 60 * 60 * 1000
      }
    } catch (err) {
      console.error('Failed to initialize user store:', err)
    }
  }

  // Actions - Reset
  function resetStore() {
    currentUser.value = null
    isAuthenticated.value = false
    authToken.value = null
    refreshToken.value = null
    sessionExpiry.value = null
    lastActivity.value = Date.now()
    preferences.value = {
      theme: 'auto',
      language: 'zh',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      privacy: {
        showEmail: false,
        showPhone: false,
        showProfile: true
      }
    }
    loading.value = false
    error.value = null
  }

  return {
    // State
    currentUser,
    isAuthenticated,
    authToken,
    refreshToken,
    preferences,
    loading,
    error,

    // Getters
    userId,
    username,
    email,
    userRole,
    isVerified,
    isKYCApproved,
    fullName,
    avatarUrl,
    permissions,
    isSessionValid,
    isSessionActive,
    requiresKYC,

    // Actions - Auth
    setUser,
    setAuthToken,
    clearAuth,
    logout,

    // Actions - Profile
    updateUser,
    updateProfile,

    // Actions - Preferences
    updatePreferences,

    // Actions - Session
    updateActivity,
    checkSession,
    refreshSession,

    // Actions - Permissions
    hasPermission,
    hasRole,

    // Actions - State
    setLoading,
    setError,

    // Actions - Init
    initialize,
    resetStore
  }
})
