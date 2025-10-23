<template>
  <div class="step-payment">
    <h2>Deposit Payment</h2>
    <p class="subtitle">Complete your registration with a deposit</p>

    <div class="deposit-info">
      <div class="info-card">
        <div class="info-label">Role</div>
        <div class="info-value">{{ roleLabel }}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Deposit Amount</div>
        <div class="info-value">¥{{ depositAmount }}</div>
      </div>
    </div>

    <div class="payment-methods">
      <h3>Select Payment Method</h3>
      <div class="method-options">
        <div
          v-for="method in paymentMethods"
          :key="method.id"
          :class="['method-option', { selected: selectedMethod === method.id }]"
          @click="selectedMethod = method.id"
        >
          <div class="method-icon">{{ method.icon }}</div>
          <div class="method-name">{{ method.name }}</div>
        </div>
      </div>
    </div>

    <div class="payment-details">
      <div class="detail-item">
        <span class="label">Deposit Amount:</span>
        <span class="value">¥{{ depositAmount }}</span>
      </div>
      <div class="detail-item">
        <span class="label">Processing Fee:</span>
        <span class="value">¥0.00</span>
      </div>
      <div class="detail-divider"></div>
      <div class="detail-item total">
        <span class="label">Total Amount:</span>
        <span class="value">¥{{ depositAmount }}</span>
      </div>
    </div>

    <div class="terms">
      <input id="agree-terms" v-model="agreedToPayment" type="checkbox" />
      <label for="agree-terms">
        I understand that this deposit will be held in escrow and returned if not used for project participation.
      </label>
    </div>

    <button
      class="btn btn-primary btn-block"
      @click="handlePayment"
      :disabled="!agreedToPayment"
    >
      Proceed to Payment
    </button>

    <p class="security-note">
      🔒 Your payment is secure and encrypted
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  userId: number | null;
  roleType: 'developer' | 'client';
}>();

const emit = defineEmits<{
  'payment-complete': [];
}>();

const selectedMethod = ref('alipay');
const agreedToPayment = ref(false);

const paymentMethods = [
  { id: 'alipay', name: 'Alipay', icon: '🔵' },
  { id: 'wechat', name: 'WeChat Pay', icon: '💚' },
  { id: 'bank', name: 'Bank Transfer', icon: '🏦' },
  { id: 'card', name: 'Credit Card', icon: '💳' },
];

const roleLabel = computed(() => {
  return props.roleType === 'developer' ? 'Developer' : 'Client';
});

const depositAmount = computed(() => {
  return props.roleType === 'developer' ? '199.00' : '0.00';
});

const handlePayment = () => {
  if (!agreedToPayment.value) {
    alert('Please agree to the payment terms');
    return;
  }

  // TODO: Integrate with payment gateway
  console.log('Processing payment with method:', selectedMethod.value);

  // Simulate payment completion
  setTimeout(() => {
    emit('payment-complete');
  }, 2000);
};
</script>

<style scoped lang="css">
.step-payment {
  max-width: 500px;
}

.step-payment h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #1a1a1a;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 30px;
}

.deposit-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 30px;
}

.info-card {
  padding: 16px;
  background: #f5f5f5;
  border-radius: 6px;
}

.info-label {
  font-size: 12px;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.info-value {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.payment-methods {
  margin-bottom: 30px;
}

.payment-methods h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.method-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.method-option {
  padding: 16px;
  border: 2px solid #ddd;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.method-option:hover {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

.method-option.selected {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.1);
}

.method-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.method-name {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.payment-details {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 6px;
  margin-bottom: 24px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 14px;
}

.detail-item .label {
  color: #666;
}

.detail-item .value {
  font-weight: 600;
  color: #333;
}

.detail-item.total {
  font-size: 16px;
  font-weight: 600;
}

.detail-item.total .label {
  color: #333;
}

.detail-item.total .value {
  color: #007bff;
}

.detail-divider {
  height: 1px;
  background: #ddd;
  margin: 12px 0;
}

.terms {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 24px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.terms input[type="checkbox"] {
  margin-top: 3px;
  flex-shrink: 0;
}

.terms label {
  font-size: 13px;
  color: #666;
  margin: 0;
  cursor: pointer;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
}

.btn-primary {
  background: #007bff;
  color: white;
  margin-bottom: 12px;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.security-note {
  text-align: center;
  font-size: 12px;
  color: #999;
  margin: 0;
}
</style>
