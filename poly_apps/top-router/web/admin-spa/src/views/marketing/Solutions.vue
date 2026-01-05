<template>
  <section class="space-y-12">
    <div class="text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-500">solutions</p>
      <h1 class="mt-4 text-4xl font-bold text-slate-900 dark:text-white">覆盖多行业的 AI 工作流</h1>
      <p class="mt-4 text-lg text-slate-600 dark:text-slate-300">三大场景模板，帮助团队快速落地</p>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <article
        v-for="solution in solutions"
        :key="solution.title"
        class="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="mb-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {{ solution.tag }}
        </div>
        <h3 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ solution.title }}</h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ solution.desc }}</p>
        <ul class="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <li v-for="feature in solution.features" :key="feature" class="flex gap-2">
            <i class="fas fa-bolt text-indigo-500" />
            <span>{{ feature }}</span>
          </li>
        </ul>
        <router-link
          class="mt-8 inline-flex items-center text-sm font-semibold text-indigo-600"
          :to="solution.cta"
        >
          查看模板
          <i class="fas fa-arrow-right ml-2" />
        </router-link>
      </article>
    </div>
  </section>
</template>

<script setup>
const solutions = [
  {
    tag: 'Customer Support',
    title: '智能客服',
    desc: '接入现有 CRM，自动同步多渠道对话，提供实时摘要与意图分析。',
    features: ['多模型策略集', '敏感词路由', '工单系统回填', '升级人工提醒'],
    cta: '/contact'
  },
  {
    tag: 'Developer Experience',
    title: '研发助手',
    desc: '统一调用 Claude 与内部模型，构建代码审查、测试生成、脚本修复流水线。',
    features: ['多租户密钥管理', '调用速率治理', 'SLA 仪表盘', 'Webhook 自动化'],
    cta: '/tutorials'
  },
  {
    tag: 'Content Platform',
    title: '内容创作',
    desc: '生成式文案、审核与分发一体化，适配多语种和渠道。',
    features: ['组合提示模板', '合规审查插件', '批量导出', '实时 API 监控'],
    cta: '/pricing'
  }
]
</script>
