<template>
  <section class="space-y-8">
    <header>
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-amber-500">billing</p>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">账单中心</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">查看历史账单、下载发票并管理支付状态</p>
    </header>

    <div
      class="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">近期账单</h2>
        <button
          class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
          :disabled="loading"
          @click="refresh"
        >
          <i class="fas fa-sync" :class="{ 'fa-spin': loading }" /> 刷新
        </button>
      </header>

      <DataTable :columns="tableColumns" :loading="loading" row-key="id" :rows="invoices">
        <template #cell-amount="{ value }">
          <span class="font-semibold">¥{{ value }}</span>
        </template>
        <template #cell-status="{ row }">
          <span
            :class="[getStatusClass(row.status), 'rounded-full px-3 py-1 text-xs font-semibold']"
          >
            {{ row.status === 'paid' ? '已支付' : '待支付' }}
          </span>
        </template>
        <template #cell-actions="{ row }">
          <div class="text-right">
            <button class="text-sm font-semibold text-indigo-600" @click="download(row.id)">
              下载发票
            </button>
          </div>
        </template>
        <template #empty>
          <div class="py-6 text-center text-sm text-slate-500 dark:text-slate-400">暂无账单</div>
        </template>
      </DataTable>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'
import DataTable from '@/components/common/DataTable.vue'

const invoices = ref([])
const loading = ref(false)
const tableColumns = [
  { key: 'createdAt', label: '创建时间' },
  { key: 'planName', label: '套餐' },
  { key: 'amount', label: '金额', align: 'right' },
  { key: 'status', label: '状态' },
  { key: 'actions', label: '操作', align: 'right' }
]

const fetchInvoices = async () => {
  loading.value = true
  try {
    const response = await apiClient.get('/subscriptions/orders')
    if (response.success) {
      invoices.value = (response.orders || []).map((order) => ({
        ...order,
        createdAt: new Date(order.createdAt).toLocaleDateString()
      }))
    }
  } catch (error) {
    showToast(error.message || '获取账单失败', 'error')
  } finally {
    loading.value = false
  }
}

const download = (id) => {
  showToast(`发票 ${id} 下载功能开发中`, 'info')
}

const refresh = () => fetchInvoices()

const getStatusClass = (status) => {
  return status === 'paid'
    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200'
    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-200'
}

onMounted(fetchInvoices)
</script>
