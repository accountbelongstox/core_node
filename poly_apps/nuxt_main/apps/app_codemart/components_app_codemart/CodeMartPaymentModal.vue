<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Payment Modal Component - Universal payment processing modal
  Supports: Registration deposit, Project payment, Milestone payment, Architect deposit
-->
<template>
  <div v-if="isVisible" class="codemart-modal-overlay" @click.self="handleClose">
    <div class="codemart-modal codemart-payment-modal">
      <div class="codemart-modal-header">
        <h2 class="codemart-modal-title">{{ title || t('codemart.payment.title') }}</h2>
        <button
          type="button"
          class="codemart-modal-close"
          @click="handleClose"
        >
          ×
        </button>
      </div>

      <div class="codemart-modal-body">
        <div v-if="currentStep === 'details'" class="codemart-payment-step">
          <div class="codemart-payment-summary">
            <div class="codemart-payment-item">
              <span class="codemart-payment-label">{{ t('codemart.payment.amount') }}</span>
              <span class="codemart-payment-value codemart-payment-amount">
                {{ formatCurrency(amount, currency) }}
              </span>
            </div>
            <div v-if="description" class="codemart-payment-item">
              <span class="codemart-payment-label">{{ t('codemart.payment.description') }}</span>
              <span class="codemart-payment-value">{{ description }}</span>
            </div>
            <div v-if="paymentType" class="codemart-payment-item">
              <span class="codemart-payment-label">{{ t('codemart.payment.type') }}</span>
              <span class="codemart-payment-value">
                {{ t(`codemart.payment.types.${paymentType}`) }}
              </span>
            </div>
          </div>

          <div class="codemart-form-group">
            <label class="codemart-form-label">
              {{ t('codemart.payment.selectMethod') }}
              <span class="codemart-form-required">*</span>
            </label>
            <div class="codemart-payment-methods">
              <label
                v-for="method in availableMethods"
                :key="method.value"
                class="codemart-payment-method"
                :class="{ 'codemart-payment-method-selected': selectedMethod === method.value }"
              >
                <input
                  v-model="selectedMethod"
                  type="radio"
                  :value="method.value"
                  class="codemart-payment-method-input"
                />
                <div class="codemart-payment-method-content">
                  <div class="codemart-payment-method-icon">
                    {{ method.icon }}
                  </div>
                  <div class="codemart-payment-method-info">
                    <div class="codemart-payment-method-name">{{ method.label }}</div>
                    <div v-if="method.description" class="codemart-payment-method-description">
                      {{ method.description }}
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div class="codemart-payment-agreement">
            <label class="codemart-checkbox-label">
              <input
                v-model="agreedToTerms"
                type="checkbox"
                class="codemart-checkbox-input"
              />
              <span>
                {{ t('codemart.payment.agreeToTerms') }}
                <a href="#" class="codemart-link">{{ t('codemart.payment.termsLink') }}</a>
              </span>
            </label>
          </div>
        </div>

        <div v-else-if="currentStep === 'processing'" class="codemart-payment-step">
          <div class="codemart-payment-processing">
            <div class="codemart-spinner"></div>
            <p class="codemart-payment-processing-text">
              {{ t('codemart.payment.processing') }}
            </p>
            <p class="codemart-payment-processing-hint">
              {{ t('codemart.payment.processingHint') }}
            </p>
          </div>
        </div>

        <div v-else-if="currentStep === 'success'" class="codemart-payment-step">
          <div class="codemart-payment-success">
            <div class="codemart-payment-success-icon">✓</div>
            <h3 class="codemart-payment-success-title">
              {{ t('codemart.payment.success') }}
            </h3>
            <p class="codemart-payment-success-message">
              {{ successMessage || t('codemart.payment.successMessage') }}
            </p>
            <div v-if="transactionId" class="codemart-payment-transaction">
              {{ t('codemart.payment.transactionId') }}: {{ transactionId }}
            </div>
          </div>
        </div>

        <div v-else-if="currentStep === 'error'" class="codemart-payment-step">
          <div class="codemart-payment-error">
            <div class="codemart-payment-error-icon">✗</div>
            <h3 class="codemart-payment-error-title">
              {{ t('codemart.payment.failed') }}
            </h3>
            <p class="codemart-payment-error-message">
              {{ errorMessage || t('codemart.payment.failedMessage') }}
            </p>
          </div>
        </div>
      </div>

      <div class="codemart-modal-footer">
        <button
          v-if="currentStep === 'details'"
          type="button"
          class="codemart-btn codemart-btn-secondary"
          @click="handleClose"
        >
          {{ t('codemart.common.cancel') }}
        </button>
        <button
          v-if="currentStep === 'details'"
          type="button"
          class="codemart-btn codemart-btn-primary"
          :disabled="!canProceed"
          @click="handlePay"
        >
          {{ t('codemart.payment.confirmPayment') }}
        </button>
        <button
          v-if="currentStep === 'success'"
          type="button"
          class="codemart-btn codemart-btn-primary"
          @click="handleSuccess"
        >
          {{ t('codemart.common.continue') }}
        </button>
        <button
          v-if="currentStep === 'error'"
          type="button"
          class="codemart-btn codemart-btn-primary"
          @click="handleRetry"
        >
          {{ t('codemart.common.retry') }}
        </button>
        <button
          v-if="currentStep === 'error'"
          type="button"
          class="codemart-btn codemart-btn-secondary"
          @click="handleClose"
        >
          {{ t('codemart.common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import paymentApi from '~/apps/app_codemart/services_app_codemart/payment-api'
import type { PaymentMethod, PaymentType } from '~/apps/app_codemart/types_app_codemart'

const { t } = useI18n()

interface Props {
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

const props = withDefaults(defineProps<Props>(), {
  currency: 'CNY',
  visible: false
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'success': [paymentId: number]
  'error': [error: Error]
  'close': []
}>()

const isVisible = ref(props.visible)
const currentStep = ref<'details' | 'processing' | 'success' | 'error'>('details')
const selectedMethod = ref<PaymentMethod>('alipay')
const agreedToTerms = ref(false)
const transactionId = ref<string>()
const errorMessage = ref<string>()
const successMessage = ref<string>()

watch(() => props.visible, (newValue) => {
  isVisible.value = newValue
  if (newValue) {
    resetModal()
  }
})

const availableMethods = [
  {
    value: 'alipay' as PaymentMethod,
    label: t('codemart.payment.methods.alipay'),
    icon: '💳',
    description: t('codemart.payment.methods.alipayDesc')
  },
  {
    value: 'wechat' as PaymentMethod,
    label: t('codemart.payment.methods.wechat'),
    icon: '💚',
    description: t('codemart.payment.methods.wechatDesc')
  },
  {
    value: 'bank_card' as PaymentMethod,
    label: t('codemart.payment.methods.bankCard'),
    icon: '🏦',
    description: t('codemart.payment.methods.bankCardDesc')
  },
  {
    value: 'wallet' as PaymentMethod,
    label: t('codemart.payment.methods.wallet'),
    icon: '👛',
    description: t('codemart.payment.methods.walletDesc')
  }
]

const canProceed = computed(() => {
  return selectedMethod.value && agreedToTerms.value
})

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency
  }).format(amount)
}

const resetModal = () => {
  currentStep.value = 'details'
  selectedMethod.value = 'alipay'
  agreedToTerms.value = false
  transactionId.value = undefined
  errorMessage.value = undefined
  successMessage.value = undefined
}

const handlePay = async () => {
  currentStep.value = 'processing'

  try {
    const payment = await paymentApi.createPayment({
      payee_id: props.payeeId || 0,
      project_id: props.projectId,
      milestone_id: props.milestoneId,
      amount: props.amount,
      type: props.paymentType || 'project_payment',
      payment_method: selectedMethod.value,
      description: props.description
    })

    // Simulate payment gateway processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    transactionId.value = payment.id?.toString()
    successMessage.value = t('codemart.payment.successMessage')
    currentStep.value = 'success'

    emit('success', payment.id as number)
  } catch (error) {
    console.error('Payment failed:', error)
    errorMessage.value = error instanceof Error ? error.message : 'Unknown error'
    currentStep.value = 'error'
    emit('error', error instanceof Error ? error : new Error('Unknown error'))
  }
}

const handleSuccess = () => {
  handleClose()
}

const handleRetry = () => {
  resetModal()
}

const handleClose = () => {
  isVisible.value = false
  emit('update:visible', false)
  emit('close')
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
