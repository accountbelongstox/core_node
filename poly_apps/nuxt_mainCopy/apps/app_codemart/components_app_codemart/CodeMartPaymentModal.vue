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
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePaymentModal } from '~/apps/app_codemart/composables_app_codemart/use-payment-modal'
import { usePaymentStore } from '~/apps/app_codemart/stores/codemart/payment'
import type { PaymentType } from '~/apps/app_codemart/types_app_codemart'

const { t } = useI18n()
const paymentStore = usePaymentStore()

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

// Use composable for all business logic
const {
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
  availableMethods,
  selectedMethodInfo,
  canProceed,
  isAmountValid,
  canRetry,
  formattedAmount,
  recentPayments,
  handleClose,
  resetModal,
  handlePay,
  handleRetry,
  handleSuccess,
  processPayment,
  validatePayment,
  clearPaymentHistory,
  updatePreferences,
  downloadReceipt,
  formatCurrency,
  formatDate
} = usePaymentModal(props, emit)

// Computed - Format remaining attempts
const remainingAttempts = computed(() => {
  return Math.max(0, 3 - retryAttempts.value)
})

const showPaymentHistory = computed(() => {
  return recentPayments.value.length > 0
})

// Watch payment success to update store
watch(() => currentStep.value, (newStep) => {
  if (newStep === 'success' && transactionId.value) {
    // Payment successful, refresh payment data in store
    paymentStore.initialize()
  }
})
</script>

<!-- NO <style> tag - All styles defined in theme files -->
