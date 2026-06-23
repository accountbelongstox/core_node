<template>
  <div>
    <!-- Hero Section -->
    <section class="px-4 pb-12 pt-16 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl text-center">
        <h1
          class="mb-6 text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl"
        >
          功能
          <span class="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"
            >详情</span
          >
        </h1>
        <p class="mx-auto max-w-3xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
          深入了解 Top Router 为您提供的强大功能和企业级特性
        </p>
      </div>
    </section>

    <!-- Core Features Section -->
    <section class="px-4 py-12 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="mb-12 text-center">
          <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            核心功能
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400">为您的 AI 应用提供全方位支持</p>
        </div>

        <div class="grid gap-8 lg:grid-cols-2">
          <!-- Feature 1: 多账户负载均衡 -->
          <div class="glass-strong rounded-2xl p-8">
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-blue-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-4 text-2xl font-bold text-gray-900 dark:text-white">多账户负载均衡</h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">
              智能分配请求到多个 Claude
              账户，自动故障转移，确保服务高可用性。我们的负载均衡算法会根据账户状态、并发数、响应时间等多个维度进行智能调度。
            </p>
            <ul class="space-y-2">
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">自动健康检查和故障转移</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">基于权重的智能调度算法</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">实时并发控制和限流保护</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">支持账户优先级和分组管理</span>
              </li>
            </ul>
          </div>

          <!-- Feature 2: API Key 认证与管理 -->
          <div class="glass-strong rounded-2xl p-8">
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-purple-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
              API Key 认证与管理
            </h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">
              完善的 API Key 管理系统，支持速率限制、配额控制、使用统计。每个用户可以创建多个
              Key，灵活管理不同应用的访问权限。
            </p>
            <ul class="space-y-2">
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">SHA-256 哈希加密存储</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">灵活的配额和限流设置</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">详细的使用统计和成本分析</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">支持过期时间和自动续期</span>
              </li>
            </ul>
          </div>

          <!-- Feature 3: 实时监控与分析 -->
          <div class="glass-strong rounded-2xl p-8">
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-green-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-4 text-2xl font-bold text-gray-900 dark:text-white">实时监控与分析</h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">
              强大的监控系统，实时追踪每个请求的状态、性能、成本。提供多维度的数据分析，帮助您优化
              AI 应用性能。
            </p>
            <ul class="space-y-2">
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">实时请求统计和性能监控</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">按模型、时间的成本分析</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">Token 使用量详细统计</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">可视化图表和趋势分析</span>
              </li>
            </ul>
          </div>

          <!-- Feature 4: 智能调度系统 -->
          <div class="glass-strong rounded-2xl p-8">
            <div
              class="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-yellow-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-4 text-2xl font-bold text-gray-900 dark:text-white">智能调度系统</h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">
              基于多种策略的智能路由算法，确保每个请求都能找到最优的账户处理。支持会话粘性，保证上下文连续性。
            </p>
            <ul class="space-y-2">
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">会话粘性（Session Sticky）</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">基于并发数的负载均衡</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">账户状态实时监控</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 mt-1 h-5 w-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
                <span class="text-gray-700 dark:text-gray-300">自动过载保护机制</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Security Features Section -->
    <section class="bg-white px-4 py-12 dark:bg-gray-800 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="mb-12 text-center">
          <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            安全特性
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400">企业级安全保障，保护您的数据</p>
        </div>

        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div class="glass-strong rounded-xl p-6">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-500">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-bold text-gray-900 dark:text-white">数据加密存储</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              敏感数据使用 AES-256 加密存储，OAuth Token 安全管理
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-bold text-gray-900 dark:text-white">HTTPS 加密传输</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              所有通信使用 HTTPS 协议加密，确保数据传输安全
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-bold text-gray-900 dark:text-white">JWT 身份认证</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              基于 JWT 的用户认证系统，支持会话管理和自动续期
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-bold text-gray-900 dark:text-white">速率限制保护</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              防止恶意攻击和滥用，基于 IP 和 API Key 的多层限流
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-bold text-gray-900 dark:text-white">审计日志</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              详细记录所有操作日志，支持安全审计和问题追溯
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6">
            <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500">
              <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-lg font-bold text-gray-900 dark:text-white">异常检测</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              实时监控异常请求模式，自动识别并阻止可疑行为
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="px-4 py-20 sm:px-6 lg:px-8">
      <div class="glass-strong mx-auto max-w-4xl rounded-3xl p-12 text-center">
        <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          准备好体验这些强大功能了吗？
        </h2>
        <p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
          立即注册，免费开始使用 Top Router
        </p>
        <div
          class="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
        >
          <router-link
            class="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-xl transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-2xl sm:w-auto"
            to="/auth/register"
          >
            免费注册
          </router-link>
          <router-link
            class="w-full rounded-xl border-2 border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto"
            to="/contact"
          >
            联系我们
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 平滑滚动 */
html {
  scroll-behavior: smooth;
}
</style>
