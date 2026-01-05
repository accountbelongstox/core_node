<template>
  <div>
    <!-- Hero Section -->
    <section class="px-4 pb-12 pt-16 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl text-center">
        <h1
          class="mb-6 text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl"
        >
          联系
          <span class="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"
            >我们</span
          >
        </h1>
        <p class="mx-auto max-w-3xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
          有任何问题或建议？我们很乐意听到您的声音
        </p>
      </div>
    </section>

    <!-- Contact Methods Section -->
    <section class="px-4 py-12 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="grid gap-6 md:grid-cols-3">
          <!-- Email -->
          <div class="glass-strong rounded-2xl p-8 text-center">
            <div
              class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">邮箱</h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">发送邮件给我们</p>
            <a
              class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              href="mailto:support@clauderelay.com"
            >
              support@clauderelay.com
            </a>
          </div>

          <!-- Online Support -->
          <div class="glass-strong rounded-2xl p-8 text-center">
            <div
              class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white"
            >
              <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">在线客服</h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">实时在线支持</p>
            <button
              class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              @click="openChat"
            >
              开始对话
            </button>
          </div>

          <!-- WeChat QR Code -->
          <div class="glass-strong group relative rounded-2xl p-8 text-center">
            <div
              class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white"
            >
              <svg class="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9.5 4C5.4 4 2 6.6 2 9.9c0 2 1.3 3.7 3.2 4.8-.2.7-.7 2.3-.7 2.5 0 .2.1.3.3.2.1 0 2.1-1.4 2.5-1.7.6.1 1.2.2 1.9.2 4.1 0 7.5-2.6 7.5-5.9C17 6.6 13.6 4 9.5 4zM6.9 8.4c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1.5-1.1 1.1-1.1zm5.1 0c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1S11 10.1 11 9.5s.5-1.1 1.1-1.1z"
                />
                <path
                  d="M22 14.5c0-2.8-2.9-5-6.4-5-3.5 0-6.4 2.2-6.4 5s2.9 5 6.4 5c.5 0 1.1-.1 1.6-.2.3.2 1.7 1.2 1.8 1.2.1.1.3 0 .2-.2 0-.2-.4-1.4-.5-1.9 1.5-.8 2.3-2.1 2.3-3.9zm-8.3-.4c-.4 0-.8-.3-.8-.8s.3-.8.8-.8.8.3.8.8-.3.8-.8.8zm3.5 0c-.4 0-.8-.3-.8-.8s.3-.8.8-.8.8.3.8.8-.4.8-.8.8z"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-bold text-gray-900 dark:text-white">扫码加微信</h3>
            <p class="mb-4 text-gray-600 dark:text-gray-400">悬停显示二维码</p>

            <!-- QR Code Popup (appears on hover) -->
            <div
              class="pointer-events-none absolute inset-x-0 -top-4 z-10 mx-auto hidden w-full max-w-xs opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:block group-hover:opacity-100"
            >
              <div
                class="rounded-2xl border-2 border-green-500 bg-white p-6 shadow-2xl dark:bg-gray-800"
              >
                <div
                  class="mx-auto mb-4 flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 p-4 dark:from-gray-700 dark:to-gray-800"
                >
                  <div
                    class="flex h-full w-full items-center justify-center rounded-lg bg-white dark:bg-gray-900"
                  >
                    <div class="text-center">
                      <img
                        alt="微信二维码"
                        class="mx-auto h-48 w-48 object-contain"
                        :src="wechatQrCode"
                      />
                      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">微信二维码</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Support Hours Section -->
    <section class="px-4 py-12 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="glass-strong rounded-2xl p-8">
          <div class="grid gap-8 md:grid-cols-2">
            <!-- Support Hours -->
            <div>
              <h3 class="mb-6 text-2xl font-bold text-gray-900 dark:text-white">服务时间</h3>
              <div class="space-y-4">
                <div class="flex items-start">
                  <svg
                    class="mr-3 mt-1 h-6 w-6 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <div>
                    <div class="font-semibold text-gray-900 dark:text-white">在线客服</div>
                    <div class="text-gray-600 dark:text-gray-400">每天 9:00 - 21:00 (北京时间)</div>
                  </div>
                </div>

                <div class="flex items-start">
                  <svg
                    class="mr-3 mt-1 h-6 w-6 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <div>
                    <div class="font-semibold text-gray-900 dark:text-white">邮件支持</div>
                    <div class="text-gray-600 dark:text-gray-400">24/7 全天候接收,24小时内回复</div>
                  </div>
                </div>

                <div class="flex items-start">
                  <svg
                    class="mr-3 mt-1 h-6 w-6 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                    />
                  </svg>
                  <div>
                    <div class="font-semibold text-gray-900 dark:text-white">技术文档</div>
                    <div class="text-gray-600 dark:text-gray-400">7x24 在线访问</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Response Time -->
            <div>
              <h3 class="mb-6 text-2xl font-bold text-gray-900 dark:text-white">响应时效</h3>
              <div class="space-y-4">
                <div class="glass-strong rounded-xl p-4">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="font-semibold text-gray-900 dark:text-white">免费版</span>
                    <span class="text-blue-600 dark:text-blue-400">48小时</span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">工作日邮件支持</div>
                </div>

                <div class="glass-strong rounded-xl p-4">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="font-semibold text-gray-900 dark:text-white">专业版</span>
                    <span class="text-blue-600 dark:text-blue-400">24小时</span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    优先邮件 + 在线客服支持
                  </div>
                </div>

                <div class="glass-strong rounded-xl p-4">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="font-semibold text-gray-900 dark:text-white">企业版</span>
                    <span class="text-blue-600 dark:text-blue-400">2小时</span>
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    专属技术支持 + SLA 保障
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="bg-white px-4 py-20 dark:bg-gray-800 sm:px-6 lg:px-8">
      <div class="glass-strong mx-auto max-w-4xl rounded-3xl p-12 text-center">
        <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          还有疑问？
        </h2>
        <p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
          查看我们的常见问题或直接注册开始使用
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
            to="/"
          >
            查看常见问题
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import wechatQrCode from '@/assets/wangxin060906.png'

const openChat = () => {
  // TODO: 实现在线客服功能
  alert('在线客服功能即将推出！\n请暂时使用邮件或微信联系我们。')
}
</script>

<style scoped>
/* 平滑滚动 */
html {
  scroll-behavior: smooth;
}
</style>
