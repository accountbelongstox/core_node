/**
 * CodeMart Payment Composable
 * 处理支付相关的业务逻辑
 */
import { ref, computed } from 'vue';
import type { Payment, PaymentCreateInput } from '../types_app_codemart';
import { PaymentApi } from '../services_app_codemart/payment-api';

export function useCodemartPayment() {
  const paymentApi = new PaymentApi();

  const payments = ref<Payment[]>([]);
  const currentPayment = ref<Payment | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 创建支付
  const createPayment = async (data: PaymentCreateInput) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await paymentApi.createPayment(data);
      currentPayment.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取支付详情
  const fetchPayment = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await paymentApi.getPayment(id);
      currentPayment.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取用户支付列表
  const fetchUserPayments = async (userId: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await paymentApi.getUserPayments(userId);
      payments.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 确认支付
  const confirmPayment = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await paymentApi.confirmPayment(id);
      currentPayment.value = response.data;
      const index = payments.value.findIndex(p => p.id === id);
      if (index !== -1) {
        payments.value[index] = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 取消支付
  const cancelPayment = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await paymentApi.cancelPayment(id);
      currentPayment.value = response.data;
      const index = payments.value.findIndex(p => p.id === id);
      if (index !== -1) {
        payments.value[index] = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 退款
  const refundPayment = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await paymentApi.refundPayment(id);
      currentPayment.value = response.data;
      const index = payments.value.findIndex(p => p.id === id);
      if (index !== -1) {
        payments.value[index] = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // Computed properties
  const hasPayments = computed(() => payments.value.length > 0);
  const pendingPayments = computed(() =>
    payments.value.filter(p => p.status === 'pending')
  );
  const completedPayments = computed(() =>
    payments.value.filter(p => p.status === 'completed')
  );
  const failedPayments = computed(() =>
    payments.value.filter(p => p.status === 'failed')
  );
  const totalPaid = computed(() =>
    completedPayments.value.reduce((sum, p) => sum + p.amount, 0)
  );

  return {
    // State
    payments,
    currentPayment,
    loading,
    error,

    // Methods
    createPayment,
    fetchPayment,
    fetchUserPayments,
    confirmPayment,
    cancelPayment,
    refundPayment,

    // Computed
    hasPayments,
    pendingPayments,
    completedPayments,
    failedPayments,
    totalPaid
  };
}
