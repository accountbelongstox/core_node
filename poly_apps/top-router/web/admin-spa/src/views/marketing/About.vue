<template>
  <div>
    <!-- Hero Section -->
    <section class="px-4 pb-12 pt-16 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl text-center">
        <h1
          class="mb-6 text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl"
        >
          关于
          <span class="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"
            >我们</span
          >
        </h1>
        <p class="mx-auto max-w-3xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
          致力于为开发者提供最专业、最可靠的 AI API 中转服务
        </p>
      </div>
    </section>

    <!-- Mission Section -->
    <section class="px-4 py-12 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="glass-strong rounded-3xl p-8 md:p-12">
          <div class="grid gap-12 md:grid-cols-2">
            <div>
              <div
                class="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-blue-500 text-white"
              >
                <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
              </div>
              <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white">我们的使命</h2>
              <p class="text-lg text-gray-600 dark:text-gray-400">
                让每一个开发者都能轻松接入和使用先进的 AI 能力,通过提供稳定、高效、易用的 API
                中转服务,降低 AI 应用开发的门槛,加速 AI 技术在各行业的应用和普及。
              </p>
            </div>

            <div>
              <div
                class="mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-purple-500 text-white"
              >
                <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                  <path
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                  />
                </svg>
              </div>
              <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white">我们的愿景</h2>
              <p class="text-lg text-gray-600 dark:text-gray-400">
                成为全球领先的 AI API
                基础设施服务商,通过持续创新和优化,为全球开发者提供99.99%可用性的服务,让 AI
                赋能每一个创意和应用。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Values Section -->
    <section class="bg-white px-4 py-12 dark:bg-gray-800 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="mb-12 text-center">
          <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            核心价值观
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400">指引我们前进的核心理念</p>
        </div>

        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div class="glass-strong rounded-xl p-6 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white"
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
            <h3 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">创新驱动</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              持续技术创新,不断优化服务质量,引领行业发展
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white"
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
            <h3 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">可靠稳定</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              提供 99.9% 服务可用性,确保业务连续性
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">用户至上</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              以用户需求为中心,提供优质的技术支持和服务
            </p>
          </div>

          <div class="glass-strong rounded-xl p-6 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">安全第一</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              严格的数据保护机制,保障用户信息和业务安全
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Statistics Section -->
    <section class="bg-white px-4 py-12 dark:bg-gray-800 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="mb-12 text-center">
          <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            服务数据
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400">用数字说话,用实力证明</p>
        </div>

        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div class="glass-strong rounded-2xl p-8 text-center">
            <div
              class="mb-2 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-5xl font-bold text-transparent"
            >
              99.9%
            </div>
            <div class="text-gray-600 dark:text-gray-400">服务可用性</div>
          </div>

          <div class="glass-strong rounded-2xl p-8 text-center">
            <div
              class="mb-2 bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-5xl font-bold text-transparent"
            >
              10ms
            </div>
            <div class="text-gray-600 dark:text-gray-400">平均响应延迟</div>
          </div>

          <div class="glass-strong rounded-2xl p-8 text-center">
            <div
              class="mb-2 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-5xl font-bold text-transparent"
            >
              1M+
            </div>
            <div class="text-gray-600 dark:text-gray-400">每日处理请求</div>
          </div>

          <div class="glass-strong rounded-2xl p-8 text-center">
            <div
              class="mb-2 bg-gradient-to-r from-yellow-500 to-red-500 bg-clip-text text-5xl font-bold text-transparent"
            >
              24/7
            </div>
            <div class="text-gray-600 dark:text-gray-400">技术支持</div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="px-4 py-20 sm:px-6 lg:px-8">
      <div class="glass-strong mx-auto max-w-4xl rounded-3xl p-12 text-center">
        <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          加入我们的开发者社区
        </h2>
        <p class="mb-8 text-lg text-gray-600 dark:text-gray-400">立即注册,开始构建您的 AI 应用</p>
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
