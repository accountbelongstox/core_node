<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-12 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-slate-900">在线支持</h1>
      <p class="mt-4 text-lg text-slate-600">扫描下方二维码，添加客服微信获取即时帮助</p>
    </div>

    <div
      class="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-12"
    >
      <div
        class="group relative mb-8 flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100"
      >
        <img
          alt="WeChat QR Code"
          class="h-full w-full object-cover"
          src="@/assets/wangxin060906.png"
        />
      </div>

      <div class="space-y-4 text-center">
        <h3 class="text-xl font-bold text-slate-900">客服微信</h3>
        <p class="text-slate-600">工作时间：周一至周日 9:00 - 22:00</p>
        <div
          class="flex items-center justify-center gap-2 rounded-lg bg-slate-50 py-2 text-sm text-slate-500"
        >
          <i class="fas fa-info-circle"></i>
          <span>添加时请备注“API咨询”</span>
        </div>
      </div>
    </div>

    <div class="mt-12 grid gap-6 text-center md:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50"
        >
          <i class="fas fa-bolt text-xl text-indigo-600"></i>
        </div>
        <h3 class="mb-2 font-semibold text-slate-900">快速响应</h3>
        <p class="text-sm text-slate-500">平均 5 分钟内回复您的咨询</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-50"
        >
          <i class="fas fa-code text-xl text-purple-600"></i>
        </div>
        <h3 class="mb-2 font-semibold text-slate-900">技术支持</h3>
        <p class="text-sm text-slate-500">专业工程师为您解决对接问题</p>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50"
        >
          <i class="fas fa-shield-alt text-xl text-emerald-600"></i>
        </div>
        <h3 class="mb-2 font-semibold text-slate-900">售后保障</h3>
        <p class="text-sm text-slate-500">全程跟进确保服务稳定可用</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// No script logic needed for this static page
</script>
