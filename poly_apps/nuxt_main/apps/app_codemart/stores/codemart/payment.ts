/**
 * Payment Store
 *
 * Global state management for payments:
 * - Payment methods
 * - Transaction history
 * - Wallet balance
 * - Pending payments
 * - Payment preferences
 * - Payment statistics
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentType
} from '~/apps/app_codemart/types_app_codemart'

interface PaymentPreferences {
  defaultMethod: PaymentMethod
  saveMethod: boolean
  enableNotifications: boolean
  currency: string
}

interface WalletInfo {
  balance: number
  currency: string
  availableBalance: number
  frozenBalance: number
}

interface PaymentStatistics {
  totalPaid: number
  totalReceived: number
  pendingCount: number
  completedCount: number
  failedCount: number
  byMethod: Record<PaymentMethod, number>
  byType: Record<PaymentType, number>
}

export const usePaymentStore = defineStore('codemart-payment', () => {
  // State
  const payments = ref<Payment[]>([])
  const pendingPayments = ref<Payment[]>([])
  const paymentMethods = ref<PaymentMethod[]>(['alipay', 'wechat', 'bank_card', 'wallet'])
  const wallet = ref<WalletInfo>({
    balance: 0,
    currency: 'CNY',
    availableBalance: 0,
    frozenBalance: 0
  })
  const preferences = ref<PaymentPreferences>({
    defaultMethod: 'alipay',
    saveMethod: true,
    enableNotifications: true,
    currency: 'CNY'
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const allPayments = computed(() => payments.value)

  const paymentHistory = computed(() => {
    return payments.value
      .filter(p => p.status === 'completed' || p.status === 'failed')
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA
      })
  })

  const recentPayments = computed(() => {
    return paymentHistory.value.slice(0, 10)
  })

  const completedPayments = computed(() => {
    return payments.value.filter(p => p.status === 'completed')
  })

  const failedPayments = computed(() => {
    return payments.value.filter(p => p.status === 'failed')
  })

  const hasPendingPayments = computed(() => {
    return pendingPayments.value.length > 0
  })

  const statistics = computed<PaymentStatistics>(() => {
    const stats: PaymentStatistics = {
      totalPaid: 0,
      totalReceived: 0,
      pendingCount: 0,
      completedCount: 0,
      failedCount: 0,
      byMethod: {
        alipay: 0,
        wechat: 0,
        bank_card: 0,
        wallet: 0
      },
      byType: {
        registration_deposit: 0,
        project_payment: 0,
        milestone_payment: 0,
        architect_deposit: 0,
        bonus: 0,
        refund: 0
      }
    }

    payments.value.forEach(payment => {
      // Count by status
      if (payment.status === 'pending') stats.pendingCount++
      if (payment.status === 'completed') stats.completedCount++
      if (payment.status === 'failed') stats.failedCount++

      // Sum amounts
      if (payment.status === 'completed') {
        // Determine if payment or receipt based on type
        if (payment.type === 'refund') {
          stats.totalReceived += payment.amount
        } else {
          stats.totalPaid += payment.amount
        }
      }

      // Count by method
      stats.byMethod[payment.payment_method]++

      // Count by type
      stats.byType[payment.type]++
    })

    return stats
  })

  const availableMethods = computed(() => {
    return paymentMethods.value.filter(method => {
      // Add logic to filter methods based on availability
      // For example, wallet is only available if balance > 0
      if (method === 'wallet') {
        return wallet.value.availableBalance > 0
      }
      return true
    })
  })

  // Actions - Payments
  function addPayment(payment: Payment) {
    payments.value.push(payment)

    // Add to pending if not completed
    if (payment.status === 'pending') {
      pendingPayments.value.push(payment)
    }
  }

  function updatePayment(paymentId: number, updates: Partial<Payment>) {
    const index = payments.value.findIndex(p => p.id === paymentId)
    if (index !== -1) {
      payments.value[index] = { ...payments.value[index], ...updates }

      // Update pending list
      if (updates.status === 'completed' || updates.status === 'failed') {
        const pendingIndex = pendingPayments.value.findIndex(p => p.id === paymentId)
        if (pendingIndex > -1) {
          pendingPayments.value.splice(pendingIndex, 1)
        }
      }
    }
  }

  function setPayments(newPayments: Payment[]) {
    payments.value = newPayments
    pendingPayments.value = newPayments.filter(p => p.status === 'pending')
  }

  function getPaymentById(paymentId: number): Payment | null {
    return payments.value.find(p => p.id === paymentId) || null
  }

  // Actions - Wallet
  function updateWallet(updates: Partial<WalletInfo>) {
    wallet.value = { ...wallet.value, ...updates }
  }

  function addToWallet(amount: number) {
    wallet.value.balance += amount
    wallet.value.availableBalance += amount
  }

  function deductFromWallet(amount: number): boolean {
    if (wallet.value.availableBalance >= amount) {
      wallet.value.balance -= amount
      wallet.value.availableBalance -= amount
      return true
    }
    return false
  }

  function freezeAmount(amount: number): boolean {
    if (wallet.value.availableBalance >= amount) {
      wallet.value.availableBalance -= amount
      wallet.value.frozenBalance += amount
      return true
    }
    return false
  }

  function unfreezeAmount(amount: number) {
    wallet.value.availableBalance += amount
    wallet.value.frozenBalance -= amount
  }

  // Actions - Methods
  function addPaymentMethod(method: PaymentMethod) {
    if (!paymentMethods.value.includes(method)) {
      paymentMethods.value.push(method)
    }
  }

  function removePaymentMethod(method: PaymentMethod) {
    const index = paymentMethods.value.indexOf(method)
    if (index > -1) {
      paymentMethods.value.splice(index, 1)
    }
  }

  // Actions - Preferences
  function updatePreferences(updates: Partial<PaymentPreferences>) {
    preferences.value = { ...preferences.value, ...updates }
    savePreferences()
  }

  function savePreferences() {
    try {
      localStorage.setItem('codemart_payment_preferences', JSON.stringify(preferences.value))
    } catch (err) {
      console.error('Failed to save payment preferences:', err)
    }
  }

  function loadPreferences() {
    try {
      const prefsStr = localStorage.getItem('codemart_payment_preferences')
      if (prefsStr) {
        const prefs = JSON.parse(prefsStr)
        preferences.value = { ...preferences.value, ...prefs }
      }
    } catch (err) {
      console.error('Failed to load payment preferences:', err)
    }
  }

  // Actions - State Management
  function setLoading(value: boolean) {
    loading.value = value
  }

  function setError(errorMessage: string | null) {
    error.value = errorMessage
  }

  // Actions - Reset
  function resetStore() {
    payments.value = []
    pendingPayments.value = []
    paymentMethods.value = ['alipay', 'wechat', 'bank_card', 'wallet']
    wallet.value = {
      balance: 0,
      currency: 'CNY',
      availableBalance: 0,
      frozenBalance: 0
    }
    preferences.value = {
      defaultMethod: 'alipay',
      saveMethod: true,
      enableNotifications: true,
      currency: 'CNY'
    }
    loading.value = false
    error.value = null
  }

  // Initialize
  function initialize() {
    loadPreferences()
  }

  return {
    // State
    payments,
    pendingPayments,
    paymentMethods,
    wallet,
    preferences,
    loading,
    error,

    // Getters
    allPayments,
    paymentHistory,
    recentPayments,
    completedPayments,
    failedPayments,
    hasPendingPayments,
    statistics,
    availableMethods,

    // Actions - Payments
    addPayment,
    updatePayment,
    setPayments,
    getPaymentById,

    // Actions - Wallet
    updateWallet,
    addToWallet,
    deductFromWallet,
    freezeAmount,
    unfreezeAmount,

    // Actions - Methods
    addPaymentMethod,
    removePaymentMethod,

    // Actions - Preferences
    updatePreferences,

    // Actions - State
    setLoading,
    setError,

    // Actions - Reset
    resetStore,
    initialize
  }
})
