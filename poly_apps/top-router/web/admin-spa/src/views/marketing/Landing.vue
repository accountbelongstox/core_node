<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <section class="px-4 pb-20 pt-16 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl text-center">
        <h1
          class="mb-6 text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl"
        >
          专业的 Top Router API
          <span class="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent"
            >中转服务</span
          >
        </h1>
        <p class="mx-auto mb-8 max-w-3xl text-lg text-gray-600 dark:text-gray-400 sm:text-xl">
          高效稳定的 AI API 接入方案，支持多账户负载均衡、智能调度、实时监控。 让您的 AI
          应用开发更简单、更可靠。
        </p>

        <!-- CTA Buttons -->
        <div
          class="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0"
        >
          <router-link
            class="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-xl transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-2xl sm:w-auto"
            to="/auth/register"
          >
            立即开始免费使用
          </router-link>
          <a
            class="w-full rounded-xl border-2 border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto"
            href="#features"
          >
            了解更多
          </a>
        </div>

        <!-- Stats -->
        <div class="mt-16 grid gap-8 sm:grid-cols-3">
          <div class="glass-strong rounded-2xl p-6">
            <div class="text-4xl font-bold text-blue-500">99.9%</div>
            <div class="mt-2 text-gray-600 dark:text-gray-400">服务可用性</div>
          </div>
          <div class="glass-strong rounded-2xl p-6">
            <div class="text-4xl font-bold text-purple-500">100万+</div>
            <div class="mt-2 text-gray-600 dark:text-gray-400">日API调用</div>
          </div>
          <div class="glass-strong rounded-2xl p-6">
            <div class="text-4xl font-bold text-green-500">24/7</div>
            <div class="mt-2 text-gray-600 dark:text-gray-400">技术支持</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="bg-white px-4 py-20 dark:bg-gray-800 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="mb-16 text-center">
          <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            强大的功能特性
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400">为您的 AI 应用提供企业级支持</p>
        </div>

        <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <!-- Feature 1 -->
          <div class="glass-strong rounded-2xl p-8 transition-transform hover:scale-105">
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500 text-white"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">多账户负载均衡</h3>
            <p class="text-gray-600 dark:text-gray-400">
              智能分配请求到多个 Claude 账户，自动故障转移，确保服务高可用性
            </p>
          </div>

          <!-- Feature 2 -->
          <div class="glass-strong rounded-2xl p-8 transition-transform hover:scale-105">
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500 text-white"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">API Key 认证</h3>
            <p class="text-gray-600 dark:text-gray-400">
              安全的 API Key 管理，支持速率限制、配额控制、使用统计
            </p>
          </div>

          <!-- Feature 3 -->
          <div class="glass-strong rounded-2xl p-8 transition-transform hover:scale-105">
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500 text-white"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">实时监控</h3>
            <p class="text-gray-600 dark:text-gray-400">
              详细的使用统计、成本分析、性能监控，让您掌握每一个细节
            </p>
          </div>

          <!-- Feature 4 -->
          <div class="glass-strong rounded-2xl p-8 transition-transform hover:scale-105">
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500 text-white"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">智能调度</h3>
            <p class="text-gray-600 dark:text-gray-400">
              基于账户状态、并发数、会话粘性的智能路由算法
            </p>
          </div>

          <!-- Feature 5 -->
          <div class="glass-strong rounded-2xl p-8 transition-transform hover:scale-105">
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-500 text-white"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">数据加密</h3>
            <p class="text-gray-600 dark:text-gray-400">
              敏感数据 AES 加密存储，OAuth token 安全管理
            </p>
          </div>

          <!-- Feature 6 -->
          <div class="glass-strong rounded-2xl p-8 transition-transform hover:scale-105">
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500 text-white"
            >
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </div>
            <h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">现代化界面</h3>
            <p class="text-gray-600 dark:text-gray-400">
              美观易用的 Web 管理界面，支持暗黑模式，响应式设计
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Preview Section -->
    <section id="pricing" class="px-4 py-20 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="mb-16 text-center">
          <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            灵活的定价方案
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400">选择适合您的计划，随时升级或降级</p>
        </div>

        <div class="grid gap-8 md:grid-cols-3">
          <!-- Basic Plan -->
          <div class="glass-strong rounded-2xl p-8">
            <h3 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">基础版</h3>
            <div class="mb-6">
              <span class="text-4xl font-bold text-gray-900 dark:text-white">¥168</span>
              <span class="text-gray-600 dark:text-gray-400">/月</span>
            </div>
            <ul class="mb-8 space-y-3">
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">1 API Key</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">10K 请求/月</span>
              </li>
            </ul>
            <router-link
              class="block w-full rounded-lg border-2 border-gray-300 bg-white py-3 text-center font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              to="/auth/register"
            >
              开始使用
            </router-link>
          </div>

          <!-- Pro Plan -->
          <div class="glass-strong relative rounded-2xl p-8 ring-4 ring-blue-500">
            <div
              class="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-1 text-sm font-bold text-white"
            >
              最受欢迎
            </div>
            <h3 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">专业版</h3>
            <div class="mb-6">
              <span class="text-4xl font-bold text-gray-900 dark:text-white">¥688</span>
              <span class="text-gray-600 dark:text-gray-400">/月</span>
            </div>
            <ul class="mb-8 space-y-3">
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">1 API Key</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">50K 请求/月</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">所有模型访问</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">优先支持</span>
              </li>
            </ul>
            <router-link
              class="block w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 py-3 text-center font-semibold text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-xl"
              to="/auth/register"
            >
              立即订阅
            </router-link>
          </div>

          <!-- Premium Plan -->
          <div class="glass-strong rounded-2xl p-8">
            <h3 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">尊享版</h3>
            <div class="mb-6">
              <span class="text-4xl font-bold text-gray-900 dark:text-white">¥1688</span>
              <span class="text-gray-600 dark:text-gray-400">/月</span>
            </div>
            <ul class="mb-8 space-y-3">
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">1 API Key</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">无限请求</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">专属账户管理</span>
              </li>
              <li class="flex items-start">
                <svg
                  class="mr-2 h-5 w-5 text-green-500"
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
                <span class="text-gray-700 dark:text-gray-300">SLA 保障</span>
              </li>
            </ul>
            <router-link
              class="block w-full rounded-lg border-2 border-gray-300 bg-white py-3 text-center font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              to="/auth/register"
            >
              立即订阅
            </router-link>
          </div>
        </div>

        <div class="mt-12 text-center">
          <router-link class="text-blue-500 hover:text-blue-600 dark:text-blue-400" to="/pricing">
            查看完整定价详情 →
          </router-link>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section id="faq" class="bg-white px-4 py-20 dark:bg-gray-800 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-4xl">
        <div class="mb-16 text-center">
          <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
            常见问题
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-400">快速了解我们的服务</p>
        </div>

        <div class="space-y-4">
          <div
            v-for="(faq, index) in faqs"
            :key="index"
            class="glass-strong overflow-hidden rounded-xl"
          >
            <button
              class="flex w-full items-center justify-between p-6 text-left"
              @click="toggleFaq(index)"
            >
              <span class="text-lg font-semibold text-gray-900 dark:text-white">{{
                faq.question
              }}</span>
              <svg
                class="h-5 w-5 text-gray-500 transition-transform"
                :class="{ 'rotate-180': faq.open }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M19 9l-7 7-7-7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                />
              </svg>
            </button>
            <div
              v-if="faq.open"
              class="border-t border-gray-200 px-6 pb-6 pt-4 dark:border-gray-700"
            >
              <p class="text-gray-600 dark:text-gray-400">{{ faq.answer }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Floating WeChat QR Code Button -->
    <div class="fixed right-8 top-24 z-40 hidden lg:block">
      <div class="group relative">
        <!-- Button -->
        <button
          class="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"
        >
          <svg class="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path
              d="M9.5 4C5.4 4 2 6.6 2 9.9c0 2 1.3 3.7 3.2 4.8-.2.7-.7 2.3-.7 2.5 0 .2.1.3.3.2.1 0 2.1-1.4 2.5-1.7.6.1 1.2.2 1.9.2 4.1 0 7.5-2.6 7.5-5.9C17 6.6 13.6 4 9.5 4zM6.9 8.4c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1.5-1.1 1.1-1.1zm5.1 0c.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1S11 10.1 11 9.5s.5-1.1 1.1-1.1z"
            />
            <path
              d="M22 14.5c0-2.8-2.9-5-6.4-5-3.5 0-6.4 2.2-6.4 5s2.9 5 6.4 5c.5 0 1.1-.1 1.6-.2.3.2 1.7 1.2 1.8 1.2.1.1.3 0 .2-.2 0-.2-.4-1.4-.5-1.9 1.5-.8 2.3-2.1 2.3-3.9zm-8.3-.4c-.4 0-.8-.3-.8-.8s.3-.8.8-.8.8.3.8.8-.3.8-.8.8zm3.5 0c-.4 0-.8-.3-.8-.8s.3-.8.8-.8.8.3.8.8-.4.8-.8.8z"
            />
          </svg>
        </button>

        <!-- QR Code Popup (appears on hover) -->
        <div
          class="absolute right-16 top-0 hidden w-64 rounded-2xl bg-white p-4 shadow-2xl transition-all duration-300 group-hover:block dark:bg-gray-800"
        >
          <div class="text-center">
            <h3 class="mb-3 text-lg font-bold text-gray-900 dark:text-white">扫码加微信</h3>
            <div
              class="mx-auto mb-3 flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 p-4 dark:from-gray-700 dark:to-gray-800"
            >
              <div
                class="flex h-full w-full items-center justify-center rounded-lg bg-white dark:bg-gray-900"
              >
                <div class="text-center">
                  <img
                    alt="微信客服二维码"
                    class="mx-auto h-40 w-40 object-contain"
                    :src="wechatQrCode"
                  />
                  <p class="mt-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                    微信客服二维码
                  </p>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">工作时间：9:00 - 21:00</p>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <section class="px-4 py-20 sm:px-6 lg:px-8">
      <div class="glass-strong mx-auto max-w-4xl rounded-3xl p-12 text-center">
        <h2 class="mb-4 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          准备好开始了吗？
        </h2>
        <p class="mb-8 text-lg text-gray-600 dark:text-gray-400">立即注册，免费体验我们的服务</p>
        <router-link
          class="inline-block rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-xl transition-all hover:from-blue-600 hover:to-purple-700 hover:shadow-2xl"
          to="/auth/register"
        >
          免费注册
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import wechatQrCode from '@/assets/wangxin060906.png'

// FAQ数据
const faqs = ref([
  {
    question: '什么是 Top Router？',
    answer:
      'Top Router 是一个专业的 AI API 中转服务，提供多账户负载均衡、智能调度、实时监控等功能，让您的 AI 应用开发更简单、更可靠。',
    open: false
  },
  {
    question: '如何开始使用？',
    answer:
      '只需注册账户，创建 API Key，然后在您的应用中使用我们提供的 API 端点即可。我们提供免费版供您体验。',
    open: false
  },
  {
    question: '支持哪些支付方式？',
    answer: '我们支持支付宝和微信支付，支持月付和年付两种计费周期。年付可享受 17% 的折扣优惠。',
    open: false
  },
  {
    question: '可以随时取消订阅吗？',
    answer:
      '可以。您可以随时取消订阅，我们提供 7 天无理由退款保障。取消后您仍可使用服务至当前计费周期结束。',
    open: false
  },
  {
    question: '服务的可用性如何？',
    answer: '我们承诺 99.9% 的服务可用性，配备专业的运维团队，提供 24/7 技术支持。',
    open: false
  },
  {
    question: '如何保证数据安全？',
    answer: '我们使用 AES 加密存储敏感数据，所有通信使用 HTTPS 加密，严格遵守数据保护法规。',
    open: false
  }
])

const toggleFaq = (index) => {
  faqs.value[index].open = !faqs.value[index].open
}
</script>
