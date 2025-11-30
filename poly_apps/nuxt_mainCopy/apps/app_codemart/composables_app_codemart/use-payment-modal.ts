/**
 * Payment Modal Composable
 *
 * Centralizes all business logic for payment processing:
 * - Payment modal state management
 * - Multi-step payment flow (details → processing → success/error)
 * - Payment method selection and validation
 * - Payment gateway integration
 * - Transaction tracking and history
 * - Receipt generation
 * - Payment retry mechanism
 * - Error handling
 */

import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import paymentApi from '~/apps/app_codemart/services_app_codemart/payment-api'
import type {
  Payment,
  PaymentMethod,
  PaymentType,
  PaymentStatus
} from '~/apps/app_codemart/types_app_codemart'

interface PaymentModalProps {
  visible: boolean
  amount: number
  currency?: string
  title?: string
  description?: string
  paymentType?: PaymentType
  projectId?: number
  milestoneId?: number
  payeeId?: number
}

interface PaymentModalEmits {
  (e: 'update:visible', value: boolean): void
  (e: 'success', paymentId: number): void
  (e: 'error', error: Error): void
  (e: 'close'): void
}

type PaymentStep = 'details' | 'processing' | 'success' | 'error'

interface PaymentMethodOption {
  value: PaymentMethod
  label: string
  icon: string
  description: string
  enabled: boolean
  minAmount?: number
  maxAmount?: number
  processingTime?: string
}

interface PaymentHistory {
  id: number
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  created_at: string
  transaction_id?: string
}

interface PaymentPreferences {
  defaultMethod: PaymentMethod
  saveMethod: boolean
  enableNotifications: boolean
}

const PAYMENT_HISTORY_KEY = 'codemart_payment_history'
const PAYMENT_PREFERENCES_KEY = 'codemart_payment_preferences'
const MAX_RETRY_ATTEMPTS = 3
const PAYMENT_TIMEOUT = 30000 // 30 seconds

export function usePaymentModal(props: PaymentModalProps, emit: PaymentModalEmits) {
  const { t } = useI18n()

  // State
  const isVisible = ref(props.visible)
  const currentStep = ref<PaymentStep>('details')
  const selectedMethod = ref<PaymentMethod>('alipay')
  const agreedToTerms = ref(false)
  const transactionId = ref<string>()
  const errorMessage = ref<string>()
  const successMessage = ref<string>()
  const loading = ref(false)
  const retryAttempts = ref(0)
  const paymentStartTime = ref<number>(0)
  const paymentDuration = ref<number>(0)

  const paymentHistory = ref<PaymentHistory[]>([])
  const preferences = ref<PaymentPreferences>({
    defaultMethod: 'alipay',
    saveMethod: true,
    enableNotifications: true
  })

  // Available payment methods
  const availableMethods = computed<PaymentMethodOption[]>(() => [
    {
      value: 'alipay',
      label: t('codemart.payment.methods.alipay'),
      icon: '💳',
      description: t('codemart.payment.methods.alipayDesc'),
      enabled: true,
      minAmount: 0.01,
      maxAmount: 100000,
      processingTime: t('codemart.payment.instant')
    },
    {
      value: 'wechat',
      label: t('codemart.payment.methods.wechat'),
      icon: '💚',
      description: t('codemart.payment.methods.wechatDesc'),
      enabled: true,
      minAmount: 0.01,
      maxAmount: 100000,
      processingTime: t('codemart.payment.instant')
    },
    {
      value: 'bank_card',
      label: t('codemart.payment.methods.bankCard'),
      icon: '🏦',
      description: t('codemart.payment.methods.bankCardDesc'),
      enabled: true,
      minAmount: 1,
      maxAmount: 1000000,
      processingTime: t('codemart.payment.within24hours')
    },
    {
      value: 'wallet',
      label: t('codemart.payment.methods.wallet'),
      icon: '👛',
      description: t('codemart.payment.methods.walletDesc'),
      enabled: true,
      minAmount: 0.01,
      maxAmount: 50000,
      processingTime: t('codemart.payment.instant')
    }
  ])

  // Computed
  const selectedMethodInfo = computed(() => {
    return availableMethods.value.find(m => m.value === selectedMethod.value)
  })

  const canProceed = computed(() => {
    return selectedMethod.value && agreedToTerms.value && isAmountValid.value
  })

  const isAmountValid = computed(() => {
    const method = selectedMethodInfo.value
    if (!method) return false

    const amount = props.amount
    if (method.minAmount && amount < method.minAmount) return false
    if (method.maxAmount && amount > method.maxAmount) return false

    return amount > 0
  })

  const canRetry = computed(() => {
    return currentStep.value === 'error' && retryAttempts.value < MAX_RETRY_ATTEMPTS
  })

  const formattedAmount = computed(() => {
    return formatCurrency(props.amount, props.currency || 'CNY')
  })

  const recentPayments = computed(() => {
    return paymentHistory.value.slice(0, 5)
  })

  // Watch props changes
  watch(() => props.visible, (newValue) => {
    isVisible.value = newValue
    if (newValue) {
      initializeModal()
    }
  })

  // Methods - Formatting
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  // Methods - Modal Management
  const initializeModal = () => {
    resetModal()
    loadPreferences()
    loadPaymentHistory()

    // Set default payment method from preferences
    if (preferences.value.defaultMethod) {
      selectedMethod.value = preferences.value.defaultMethod
    }
  }

  const resetModal = () => {
    currentStep.value = 'details'
    selectedMethod.value = preferences.value.defaultMethod || 'alipay'
    agreedToTerms.value = false
    transactionId.value = undefined
    errorMessage.value = undefined
    successMessage.value = undefined
    loading.value = false
    retryAttempts.value = 0
    paymentStartTime.value = 0
    paymentDuration.value = 0
  }

  const handleClose = () => {
    isVisible.value = false
    emit('update:visible', false)
    emit('close')
  }

  // Methods - Payment Processing
  const validatePayment = (): { valid: boolean; message?: string } => {
    if (!selectedMethod.value) {
      return { valid: false, message: t('codemart.payment.errors.selectMethod') }
    }

    if (!agreedToTerms.value) {
      return { valid: false, message: t('codemart.payment.errors.agreeTerms') }
    }

    if (!isAmountValid.value) {
      const method = selectedMethodInfo.value
      if (method?.minAmount && props.amount < method.minAmount) {
        return {
          valid: false,
          message: t('codemart.payment.errors.amountTooLow', {
            min: formatCurrency(method.minAmount, props.currency || 'CNY')
          })
        }
      }
      if (method?.maxAmount && props.amount > method.maxAmount) {
        return {
          valid: false,
          message: t('codemart.payment.errors.amountTooHigh', {
            max: formatCurrency(method.maxAmount, props.currency || 'CNY')
          })
        }
      }
      return { valid: false, message: t('codemart.payment.errors.invalidAmount') }
    }

    return { valid: true }
  }

  const processPayment = async (): Promise<Payment | null> => {
    const validation = validatePayment()
    if (!validation.valid) {
      errorMessage.value = validation.message
      return null
    }

    currentStep.value = 'processing'
    loading.value = true
    paymentStartTime.value = Date.now()

    try {
      const paymentData = {
        payee_id: props.payeeId || 0,
        project_id: props.projectId,
        milestone_id: props.milestoneId,
        amount: props.amount,
        type: props.paymentType || 'project_payment',
        payment_method: selectedMethod.value,
        description: props.description
      }

      // Create payment record
      const payment = await paymentApi.createPayment(paymentData)

      // Simulate payment gateway processing (replace with actual gateway integration)
      await simulatePaymentGateway(payment)

      // Calculate payment duration
      paymentDuration.value = Date.now() - paymentStartTime.value

      // Update transaction info
      transactionId.value = payment.transaction_id || payment.id?.toString()
      successMessage.value = t('codemart.payment.successMessage')

      // Save to history
      addToPaymentHistory(payment)

      // Save preferred method if enabled
      if (preferences.value.saveMethod) {
        preferences.value.defaultMethod = selectedMethod.value
        savePreferences()
      }

      currentStep.value = 'success'
      emit('success', payment.id as number)

      return payment
    } catch (err) {
      console.error('Payment failed:', err)
      paymentDuration.value = Date.now() - paymentStartTime.value
      errorMessage.value = err instanceof Error ? err.message : t('codemart.payment.errors.unknown')
      currentStep.value = 'error'
      retryAttempts.value++
      emit('error', err instanceof Error ? err : new Error('Unknown error'))
      return null
    } finally {
      loading.value = false
    }
  }

  const simulatePaymentGateway = async (payment: Payment): Promise<void> => {
    // TODO: Replace with actual payment gateway integration
    // This is a placeholder that simulates payment processing

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(t('codemart.payment.errors.timeout')))
      }, PAYMENT_TIMEOUT)

      // Simulate processing delay
      setTimeout(() => {
        clearTimeout(timeout)

        // Simulate 95% success rate
        if (Math.random() < 0.95) {
          resolve()
        } else {
          reject(new Error(t('codemart.payment.errors.gatewayError')))
        }
      }, 2000 + Math.random() * 1000)
    })
  }

  const handlePay = async () => {
    await processPayment()
  }

  const handleRetry = () => {
    if (canRetry.value) {
      resetModal()
    } else {
      errorMessage.value = t('codemart.payment.errors.maxRetries')
    }
  }

  const handleSuccess = () => {
    handleClose()
  }

  // Methods - Payment History
  const loadPaymentHistory = () => {
    try {
      const historyStr = localStorage.getItem(PAYMENT_HISTORY_KEY)
      if (historyStr) {
        paymentHistory.value = JSON.parse(historyStr)
      }
    } catch (err) {
      console.error('Failed to load payment history:', err)
    }
  }

  const addToPaymentHistory = (payment: Payment) => {
    const historyItem: PaymentHistory = {
      id: payment.id as number,
      amount: payment.amount,
      currency: props.currency || 'CNY',
      method: payment.payment_method,
      status: payment.status,
      created_at: payment.created_at || new Date().toISOString(),
      transaction_id: payment.transaction_id
    }

    paymentHistory.value.unshift(historyItem)

    // Keep only last 50 payments
    if (paymentHistory.value.length > 50) {
      paymentHistory.value = paymentHistory.value.slice(0, 50)
    }

    savePaymentHistory()
  }

  const savePaymentHistory = () => {
    try {
      localStorage.setItem(PAYMENT_HISTORY_KEY, JSON.stringify(paymentHistory.value))
    } catch (err) {
      console.error('Failed to save payment history:', err)
    }
  }

  const clearPaymentHistory = () => {
    paymentHistory.value = []
    localStorage.removeItem(PAYMENT_HISTORY_KEY)
  }

  // Methods - Preferences
  const loadPreferences = () => {
    try {
      const prefsStr = localStorage.getItem(PAYMENT_PREFERENCES_KEY)
      if (prefsStr) {
        const prefs = JSON.parse(prefsStr)
        preferences.value = { ...preferences.value, ...prefs }
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
    }
  }

  const savePreferences = () => {
    try {
      localStorage.setItem(PAYMENT_PREFERENCES_KEY, JSON.stringify(preferences.value))
    } catch (err) {
      console.error('Failed to save preferences:', err)
    }
  }

  const updatePreferences = (newPrefs: Partial<PaymentPreferences>) => {
    preferences.value = { ...preferences.value, ...newPrefs }
    savePreferences()
  }

  // Methods - Receipt
  const generateReceipt = async (paymentId: number): Promise<Blob | null> => {
    try {
      // TODO: Implement actual receipt generation
      // This should call an API that generates PDF receipt
      const receipt = await paymentApi.generateReceipt(paymentId)
      return receipt
    } catch (err) {
      console.error('Failed to generate receipt:', err)
      return null
    }
  }

  const downloadReceipt = async (paymentId: number) => {
    const receipt = await generateReceipt(paymentId)
    if (receipt) {
      const url = URL.createObjectURL(receipt)
      const link = document.createElement('a')
      link.href = url
      link.download = `receipt-${paymentId}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  const emailReceipt = async (paymentId: number, email: string): Promise<boolean> => {
    try {
      await paymentApi.emailReceipt(paymentId, email)
      return true
    } catch (err) {
      console.error('Failed to email receipt:', err)
      return false
    }
  }

  return {
    // State
    isVisible,
    currentStep,
    selectedMethod,
    agreedToTerms,
    transactionId,
    errorMessage,
    successMessage,
    loading,
    retryAttempts,
    paymentDuration,
    paymentHistory,
    preferences,

    // Computed
    availableMethods,
    selectedMethodInfo,
    canProceed,
    isAmountValid,
    canRetry,
    formattedAmount,
    recentPayments,

    // Methods - Modal
    handleClose,
    resetModal,

    // Methods - Payment
    handlePay,
    handleRetry,
    handleSuccess,
    processPayment,
    validatePayment,

    // Methods - History
    loadPaymentHistory,
    clearPaymentHistory,

    // Methods - Preferences
    updatePreferences,

    // Methods - Receipt
    generateReceipt,
    downloadReceipt,
    emailReceipt,

    // Methods - Formatting
    formatCurrency,
    formatDate
  }
}
