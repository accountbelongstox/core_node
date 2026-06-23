<template>
  <div class="w-full max-w-2xl">
    <!-- 主题切换按钮 - 绝对定位在卡片右上角 -->
    <div class="absolute right-0 top-0 -mt-12">
      <ThemeToggle mode="dropdown" />
    </div>
    <div
      class="glass-card w-full rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-xl dark:bg-slate-800/80 sm:p-10"
    >
      <!-- 标题和Logo -->
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg"
        >
          <i class="fas fa-user-plus text-2xl" />
        </div>
      </div>

      <!-- 步骤指示器 -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div
            v-for="(step, index) in steps"
            :key="index"
            class="relative flex flex-1 flex-col items-center"
          >
            <div
              class="z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300"
              :class="
                currentStep > index
                  ? 'border-green-500 bg-green-500 text-white'
                  : currentStep === index
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
              "
            >
              <i v-if="currentStep > index" class="fas fa-check text-xs" />
              <span v-else class="text-xs font-bold">{{ index + 1 }}</span>
            </div>
            <span
              class="mt-2 text-xs font-medium"
              :class="
                currentStep === index
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              "
              >{{ step }}</span
            >

            <!-- Connector Line -->
            <div
              v-if="index < steps.length - 1"
              class="absolute left-1/2 top-4 -z-0 h-0.5 w-full -translate-y-1/2"
              :class="currentStep > index ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'"
            ></div>
          </div>
        </div>
      </div>

      <!-- 第一步：账户信息 -->
      <form v-if="currentStep === 0" class="space-y-6" @submit.prevent="handleStep1">
        <div class="grid gap-6 md:grid-cols-2">
          <div class="col-span-2">
            <label
              class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-200"
              for="username"
              >用户名 <span class="text-red-500">*</span></label
            >
            <div class="relative">
              <input
                id="username"
                v-model="registerForm.username"
                autocomplete="username"
                class="form-input block w-full rounded-lg border p-2.5 text-gray-900 focus:ring-2 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                :class="usernameClass"
                name="username"
                placeholder="3-20个字符，仅支持字母、数字、下划线"
                required
                type="text"
                @blur="checkUsername"
                @input="onUsernameInput"
              />
              <div
                v-if="validationSuccess.username"
                class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <i class="fas fa-check text-green-500"></i>
              </div>
            </div>
            <p v-if="validationErrors.username" class="mt-1 text-xs text-red-500">
              {{ validationErrors.username }}
            </p>
          </div>

          <div class="col-span-2">
            <label
              class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-200"
              for="email"
              >邮箱地址 <span class="text-red-500">*</span></label
            >
            <div class="relative">
              <input
                id="email"
                v-model="registerForm.email"
                autocomplete="email"
                class="form-input block w-full rounded-lg border p-2.5 text-gray-900 focus:ring-2 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                :class="emailClass"
                name="email"
                placeholder="name@company.com"
                required
                type="email"
                @blur="checkEmail"
                @input="onEmailInput"
              />
              <div
                v-if="validationSuccess.email"
                class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
              >
                <i class="fas fa-check text-green-500"></i>
              </div>
            </div>
            <p v-if="validationErrors.email" class="mt-1 text-xs text-red-500">
              {{ validationErrors.email }}
            </p>
          </div>

          <div class="col-span-2">
            <label
              class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-200"
              for="password"
              >密码 <span class="text-red-500">*</span></label
            >
            <input
              id="password"
              v-model="registerForm.password"
              autocomplete="new-password"
              class="form-input block w-full rounded-lg border p-2.5 text-gray-900 focus:ring-2 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              :class="passwordClass"
              name="password"
              placeholder="8+字符，大小写+数字"
              required
              type="password"
              @input="onPasswordInput"
            />
            <p v-if="validationErrors.password" class="mt-1 text-xs text-red-500">
              {{ validationErrors.password }}
            </p>
          </div>

          <div class="col-span-2">
            <label
              class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-200"
              for="confirmPassword"
              >确认密码 <span class="text-red-500">*</span></label
            >
            <input
              id="confirmPassword"
              v-model="registerForm.confirmPassword"
              autocomplete="new-password"
              class="form-input block w-full rounded-lg border p-2.5 text-gray-900 focus:ring-2 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              :class="confirmPassword"
              name="confirmPassword"
              placeholder="再次输入密码"
              required
              type="password"
              @input="onConfirmPasswordInput"
            />
            <p v-if="validationErrors.confirmPassword" class="mt-1 text-xs text-red-500">
              {{ validationErrors.confirmPassword }}
            </p>
          </div>
        </div>

        <div class="flex gap-4 pt-4">
          <router-link
            class="flex-1 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
            to="/auth/user-login"
          >
            <i class="fas fa-arrow-left mr-2" />返回登录
          </router-link>
          <button
            class="flex-1 transform rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-center text-sm font-medium text-white shadow-lg transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-blue-800"
            :disabled="!canProceedStep1"
            type="submit"
          >
            下一步
            <i class="fas fa-arrow-right ml-2" />
          </button>
        </div>
      </form>

      <!-- 第二步：邮箱验证 -->
      <form v-if="currentStep === 1" class="space-y-6" @submit.prevent="handleStep2">
        <div
          class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
        >
          <div class="flex items-center">
            <i class="fas fa-info-circle mr-2 text-blue-600 dark:text-blue-400" />
            <span class="font-medium">验证码已发送</span>
          </div>
          <div class="ml-6 mt-1">
            请检查您的邮箱
            <strong class="font-semibold">{{ registerForm.email }}</strong> 并输入验证码。
          </div>
        </div>

        <div>
          <label
            class="mb-2 block text-sm font-medium text-gray-900 dark:text-gray-200"
            for="verificationCode"
            >验证码 <span class="text-red-500">*</span></label
          >
          <div class="flex gap-3">
            <input
              id="verificationCode"
              v-model="registerForm.verificationCode"
              autocomplete="off"
              class="form-input block w-full flex-1 rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-center text-lg tracking-widest text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              :class="{
                'border-red-500 focus:border-red-500 focus:ring-red-500':
                  validationErrors.verificationCode
              }"
              maxlength="6"
              name="verificationCode"
              placeholder="000000"
              required
              type="text"
              @input="onVerificationCodeInput"
            />
            <button
              class="rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-gray-700 dark:focus:ring-blue-800"
              :disabled="sendCodeLoading || countdown > 0"
              type="button"
              @click="resendVerificationCode"
            >
              <div v-if="sendCodeLoading" class="fas fa-circle-notch fa-spin" />
              <template v-else-if="countdown > 0"> {{ countdown }}s </template>
              <template v-else> 重新发送 </template>
            </button>
          </div>
          <p v-if="validationErrors.verificationCode" class="mt-1 text-xs text-red-500">
            {{ validationErrors.verificationCode }}
          </p>
        </div>

        <div class="flex gap-4 pt-4">
          <button
            class="flex-1 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
            type="button"
            @click="prevStep"
          >
            <i class="fas fa-arrow-left mr-2" />上一步
          </button>
          <button
            class="flex-1 transform rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-center text-sm font-medium text-white shadow-lg transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-blue-800"
            :disabled="!canProceedStep2 || verifyLoading"
            type="submit"
          >
            <div v-if="verifyLoading" class="fas fa-circle-notch fa-spin mr-2" />
            <template v-else>
              完成注册
              <i class="fas fa-check ml-2" />
            </template>
          </button>
        </div>
      </form>

      <!-- 第三步：注册完成 -->
      <div v-if="currentStep === 2" class="space-y-8 py-4 text-center">
        <div class="relative inline-block">
          <div class="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75"></div>
          <div
            class="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg"
          >
            <i class="fas fa-check text-4xl text-white" />
          </div>
        </div>

        <div>
          <h3 class="text-2xl font-bold text-gray-900 dark:text-white">注册成功！</h3>
          <p class="mt-2 text-gray-600 dark:text-gray-400">欢迎加入 Top Router Service</p>
        </div>

        <div class="rounded-xl bg-gray-50 p-6 text-left dark:bg-gray-700/50">
          <div class="space-y-3 text-sm">
            <div
              class="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-600"
            >
              <span class="text-gray-500 dark:text-gray-400">用户名</span>
              <span class="font-medium text-gray-900 dark:text-white">{{
                registeredUser.username
              }}</span>
            </div>
            <div
              class="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-600"
            >
              <span class="text-gray-500 dark:text-gray-400">邮箱</span>
              <span class="font-medium text-gray-900 dark:text-white">{{
                registeredUser.email
              }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-500 dark:text-gray-400">注册时间</span>
              <span class="font-medium text-gray-900 dark:text-white">{{
                formatDate(registeredUser.createdAt)
              }}</span>
            </div>
          </div>
        </div>

        <router-link
          class="inline-flex w-full transform items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-center text-base font-medium text-white shadow-lg transition-all hover:-translate-y-0.5 hover:from-blue-700 hover:to-purple-700 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
          to="/auth/user-login"
        >
          <i class="fas fa-sign-in-alt mr-2" />立即登录
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { apiClient } from '@/config/api'
import { showToast } from '@/utils/toast'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

// 步骤定义
const steps = ['账户信息', '邮箱验证', '注册完成']
const currentStep = ref(0)

// 表单数据
const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  displayName: '',
  verificationCode: ''
})

// 验证状态
const validationErrors = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  verificationCode: ''
})

const validationSuccess = ref({
  username: false,
  email: false,
  password: false,
  confirmPassword: false
})

// 加载状态
const sendCodeLoading = ref(false)
const verifyLoading = ref(false)
const countdown = ref(0)

// 注册成功的用户信息
const registeredUser = ref(null)

// 防抖timer
let usernameCheckTimer = null
let emailCheckTimer = null

// 计算属性：第一步是否可以继续
const canProceedStep1 = computed(() => {
  return (
    registerForm.value.username &&
    registerForm.value.email &&
    registerForm.value.password &&
    registerForm.value.confirmPassword &&
    validationSuccess.value.username &&
    validationSuccess.value.email &&
    validationSuccess.value.password &&
    validationSuccess.value.confirmPassword &&
    !validationErrors.value.username &&
    !validationErrors.value.email &&
    !validationErrors.value.password &&
    !validationErrors.value.confirmPassword
  )
})

// 计算属性：第二步是否可以继续
const canProceedStep2 = computed(() => {
  return registerForm.value.verificationCode.length === 6
})

// 用户名输入处理
const onUsernameInput = () => {
  validationErrors.value.username = ''
  validationSuccess.value.username = false

  // 基本格式验证
  const username = registerForm.value.username
  if (username && !/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    validationErrors.value.username = '用户名格式不正确'
    return
  }

  // 防抖检查可用性
  if (usernameCheckTimer) {
    clearTimeout(usernameCheckTimer)
  }
  usernameCheckTimer = setTimeout(() => {
    if (username && username.length >= 3) {
      checkUsername()
    }
  }, 500)
}

// 邮箱输入处理
const onEmailInput = () => {
  validationErrors.value.email = ''
  validationSuccess.value.email = false

  // 基本格式验证
  const email = registerForm.value.email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    validationErrors.value.email = '邮箱格式不正确'
    return
  }

  // 防抖检查可用性
  if (emailCheckTimer) {
    clearTimeout(emailCheckTimer)
  }
  emailCheckTimer = setTimeout(() => {
    if (email) {
      checkEmail()
    }
  }, 500)
}

// 密码输入处理
const onPasswordInput = () => {
  validationErrors.value.password = ''
  validationSuccess.value.password = false

  const password = registerForm.value.password
  if (!password) return

  // 至少8个字符
  if (password.length < 8) {
    validationErrors.value.password = '密码至少需要8个字符'
    return
  }

  // 包含大写字母
  if (!/[A-Z]/.test(password)) {
    validationErrors.value.password = '密码必须包含至少一个大写字母'
    return
  }

  // 包含小写字母
  if (!/[a-z]/.test(password)) {
    validationErrors.value.password = '密码必须包含至少一个小写字母'
    return
  }

  // 包含数字
  if (!/[0-9]/.test(password)) {
    validationErrors.value.password = '密码必须包含至少一个数字'
    return
  }

  validationSuccess.value.password = true

  // 如果已经输入了确认密码，重新验证
  if (registerForm.value.confirmPassword) {
    onConfirmPasswordInput()
  }
}

// 确认密码输入处理
const onConfirmPasswordInput = () => {
  validationErrors.value.confirmPassword = ''
  validationSuccess.value.confirmPassword = false

  const confirmPassword = registerForm.value.confirmPassword
  if (!confirmPassword) return

  if (confirmPassword !== registerForm.value.password) {
    validationErrors.value.confirmPassword = '两次输入的密码不一致'
    return
  }

  validationSuccess.value.confirmPassword = true
}

// 验证码输入处理
const onVerificationCodeInput = () => {
  validationErrors.value.verificationCode = ''
  // 只允许输入数字
  registerForm.value.verificationCode = registerForm.value.verificationCode.replace(/\D/g, '')
}

// 检查用户名可用性
const checkUsername = async () => {
  const username = registerForm.value.username
  if (!username || username.length < 3) return

  try {
    const result = await apiClient.post('/register/check-availability', { username })

    if (result.success) {
      if (result.usernameAvailable) {
        validationSuccess.value.username = true
        validationErrors.value.username = ''
      } else {
        validationSuccess.value.username = false
        validationErrors.value.username = result.usernameError || '用户名已被使用'
      }
    }
  } catch (error) {
    console.error('Check username error:', error)
  }
}

const emailClass = computed(() => {
  return [
    validationErrors.value.email
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : validationSuccess.value.email
        ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600'
  ]
})

const passwordClass = computed(() => {
  return [
    validationErrors.value.password
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : validationSuccess.value.password
        ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600'
  ]
})

const usernameClass = computed(() => {
  return [
    validationErrors.value.username
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : validationSuccess.value.username
        ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600'
  ]
})

const confirmPassword = computed(() => {
  return [
    validationErrors.value.confirmPassword
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : validationSuccess.value.confirmPassword
        ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600'
  ]
})

// 检查邮箱可用性
const checkEmail = async () => {
  const email = registerForm.value.email
  if (!email) return

  try {
    const result = await apiClient.post('/register/check-availability', { email })

    if (result.success) {
      if (result.emailAvailable) {
        validationSuccess.value.email = true
        validationErrors.value.email = ''
      } else {
        validationSuccess.value.email = false
        validationErrors.value.email = result.emailError || '邮箱已被注册'
      }
    }
  } catch (error) {
    console.error('Check email error:', error)
  }
}

// 发送验证码
const sendVerificationCode = async () => {
  sendCodeLoading.value = true

  try {
    const result = await apiClient.post('/register/send-verification', {
      email: registerForm.value.email
    })

    if (result.success) {
      showToast('验证码已发送，请查收邮件', 'success')
      startCountdown()
    } else {
      showToast(result.error || '发送验证码失败', 'error')
    }
  } catch (error) {
    showToast(error.message || '发送验证码失败', 'error')
  } finally {
    sendCodeLoading.value = false
  }
}

// 重新发送验证码
const resendVerificationCode = async () => {
  await sendVerificationCode()
}

// 倒计时
const startCountdown = () => {
  countdown.value = 60
  const timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

// 处理第一步
const handleStep1 = async () => {
  if (!canProceedStep1.value) {
    showToast('请填写所有必填项并确保信息正确', 'warning')
    return
  }

  // 发送验证码
  await sendVerificationCode()

  // 如果发送成功，进入下一步
  if (countdown.value > 0) {
    currentStep.value = 1
  }
}

// 处理第二步
const handleStep2 = async () => {
  if (!canProceedStep2.value) {
    showToast('请输入验证码', 'warning')
    return
  }

  verifyLoading.value = true

  try {
    // 验证邮箱验证码
    const verifyResult = await apiClient.post('/register/verify-email', {
      email: registerForm.value.email,
      code: registerForm.value.verificationCode
    })

    if (!verifyResult.success) {
      validationErrors.value.verificationCode = verifyResult.error || '验证码错误'
      showToast(verifyResult.error || '验证码验证失败', 'error')
      return
    }

    // 注册用户
    const registerResult = await apiClient.post('/register', {
      username: registerForm.value.username,
      email: registerForm.value.email,
      password: registerForm.value.password,
      displayName: registerForm.value.displayName || registerForm.value.username
    })

    if (registerResult.success) {
      registeredUser.value = registerResult.user
      currentStep.value = 2
      showToast('注册成功！', 'success')
    } else {
      showToast(registerResult.error || '注册失败', 'error')
    }
  } catch (error) {
    showToast(error.message || '注册失败', 'error')
  } finally {
    verifyLoading.value = false
  }
}

// 上一步
const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.glass-card {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
</style>
