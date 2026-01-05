<template>
  <section class="space-y-10">
    <div class="text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-pink-500">case studies</p>
      <h1 class="mt-4 text-4xl font-bold text-slate-900 dark:text-white">客户成功故事</h1>
      <p class="mt-4 text-lg text-slate-600 dark:text-slate-300">
        来自金融、教育、出海等行业的真实部署经验
      </p>
    </div>

    <div class="space-y-6">
      <article
        v-for="caseItem in caseStudies"
        :key="caseItem.company"
        class="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p class="text-sm font-semibold uppercase tracking-widest text-slate-500">
              {{ caseItem.industry }}
            </p>
            <h3 class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {{ caseItem.company }}
            </h3>
            <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ caseItem.summary }}</p>
          </div>
          <div class="text-right text-sm text-slate-500 dark:text-slate-400">
            <p class="text-3xl font-extrabold text-slate-900 dark:text-white">
              {{ caseItem.result }}
            </p>
            <p class="mt-1 text-xs uppercase tracking-wide">{{ caseItem.metric }}</p>
          </div>
        </div>
        <ul class="mt-6 grid gap-4 sm:grid-cols-2">
          <li
            v-for="highlight in caseItem.highlights"
            :key="highlight"
            class="rounded-2xl bg-slate-100/80 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300"
          >
            {{ highlight }}
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<script setup>
const caseStudies = [
  {
    company: '火种客服云',
    industry: 'SaaS · 客服',
    summary:
      '接入 Top Router 后，通过统一调用策略降低 42% 延迟，并在 3 个月内推出 5 个智能工单能力。',
    result: '42%',
    metric: '平均响应下降',
    highlights: ['多模型仲裁', '分钟级配额告警', 'SAML 单点登录', '钉钉工单联动']
  },
  {
    company: '行者出海',
    industry: 'Marketing',
    summary: '为 8 个语种的内容审核与生成构建统一工作流，每月处理 3 亿字节内容。',
    result: '3 亿',
    metric: 'tokens / 月',
    highlights: ['自定义合规策略', '审计日志回溯', 'Webhook 驱动 CMS', '混合云部署']
  }
]
</script>
