<template>
  <section class="flex flex-col items-center justify-center gap-4 py-24 text-center">
    <p class="text-sm font-semibold uppercase tracking-[0.5em] text-slate-500">404</p>
    <h1 class="text-4xl font-bold text-slate-900 dark:text-white">页面不存在</h1>
    <p class="max-w-xl text-sm text-slate-500 dark:text-slate-400">
      路径 {{ $route.fullPath }} 暂无内容。请返回首页或检查链接是否正确。
    </p>
    <router-link class="btn btn-primary" to="/">返回首页</router-link>
  </section>
</template>

<script setup>
// 简单 404 页面
</script>
