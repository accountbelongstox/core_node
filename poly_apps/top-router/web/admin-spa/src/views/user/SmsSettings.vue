<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">短信设置</h1>
        <p class="text-sm text-slate-500">管理您的短信通知偏好设置</p>
      </div>
    </header>

    <SmsSettingsCard />
  </div>
</template>

<script setup>
import SmsSettingsCard from '@/components/user/SmsSettingsCard.vue'
</script>
