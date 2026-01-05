<template>
  <div class="flex items-center gap-1">
    <div
      v-if="account.platform === 'gemini'"
      class="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-gradient-to-r from-yellow-100 to-amber-100 px-2.5 py-1"
    >
      <i class="fas fa-robot text-xs text-yellow-700" />
      <span class="text-xs font-semibold text-yellow-800">Gemini</span>
      <span class="mx-1 h-4 w-px bg-yellow-300" />
      <span class="text-xs font-medium text-yellow-700">{{ geminiAuthType }}</span>
    </div>

    <div
      v-else-if="account.platform === 'gemini-api'"
      class="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-2.5 py-1 dark:border-blue-700 dark:from-blue-900/20 dark:to-indigo-900/20"
    >
      <i class="fas fa-key text-xs text-blue-700 dark:text-blue-300" />
      <span class="text-xs font-semibold text-blue-800 dark:text-blue-200">Gemini API</span>
      <span class="mx-1 h-4 w-px bg-blue-300 dark:bg-blue-600" />
      <span class="text-xs font-medium text-blue-700 dark:text-blue-300">{{ geminiAuthType }}</span>
    </div>

    <div
      v-else-if="account.platform === 'claude-console'"
      class="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-100 to-pink-100 px-2.5 py-1"
    >
      <i class="fas fa-terminal text-xs text-purple-700" />
      <span class="text-xs font-semibold text-purple-800">Console</span>
      <span class="mx-1 h-4 w-px bg-purple-300" />
      <span class="text-xs font-medium text-purple-700">API Key</span>
    </div>

    <div
      v-else-if="account.platform === 'bedrock'"
      class="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-gradient-to-r from-orange-100 to-red-100 px-2.5 py-1"
    >
      <i class="fab fa-aws text-xs text-orange-700" />
      <span class="text-xs font-semibold text-orange-800">Bedrock</span>
      <span class="mx-1 h-4 w-px bg-orange-300" />
      <span class="text-xs font-medium text-orange-700">AWS</span>
    </div>

    <div
      v-else-if="account.platform === 'openai'"
      class="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gradient-to-r from-gray-100 to-gray-100 px-2.5 py-1"
    >
      <div class="fa-openai" />
      <span class="text-xs font-semibold text-gray-950">OpenAI</span>
      <span class="mx-1 h-4 w-px bg-gray-400" />
      <span class="text-xs font-medium text-gray-950">{{ openAiAuthType }}</span>
    </div>

    <div
      v-else-if="account.platform === 'azure_openai'"
      class="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-100 to-cyan-100 px-2.5 py-1 dark:border-blue-700 dark:from-blue-900/20 dark:to-cyan-900/20"
    >
      <i class="fab fa-microsoft text-xs text-blue-700 dark:text-blue-400" />
      <span class="text-xs font-semibold text-blue-800 dark:text-blue-300">Azure OpenAI</span>
      <span class="mx-1 h-4 w-px bg-blue-300 dark:bg-blue-600" />
      <span class="text-xs font-medium text-blue-700 dark:text-blue-400">API Key</span>
    </div>

    <div
      v-else-if="account.platform === 'openai-responses'"
      class="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-100 to-green-100 px-2.5 py-1 dark:border-teal-700 dark:from-teal-900/20 dark:to-green-900/20"
    >
      <i class="fas fa-server text-xs text-teal-700 dark:text-teal-400" />
      <span class="text-xs font-semibold text-teal-800 dark:text-teal-300">OpenAI-Responses</span>
      <span class="mx-1 h-4 w-px bg-teal-300 dark:bg-teal-600" />
      <span class="text-xs font-medium text-teal-700 dark:text-teal-400">API Key</span>
    </div>

    <div
      v-else-if="account.platform === 'claude' || account.platform === 'claude-oauth'"
      class="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-100 to-blue-100 px-2.5 py-1"
    >
      <i class="fas fa-brain text-xs text-indigo-700" />
      <span class="text-xs font-semibold text-indigo-800">{{ claudeAccountType }}</span>
      <span class="mx-1 h-4 w-px bg-indigo-300" />
      <span class="text-xs font-medium text-indigo-700">{{ getClaudeAuthType(account) }}</span>
    </div>

    <div
      v-else-if="account.platform === 'ccr'"
      class="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-100 to-emerald-100 px-2.5 py-1 dark:border-teal-700 dark:from-teal-900/20 dark:to-emerald-900/20"
    >
      <i class="fas fa-code-branch text-xs text-teal-700 dark:text-teal-400" />
      <span class="text-xs font-semibold text-teal-800 dark:text-teal-300">CCR</span>
      <span class="mx-1 h-4 w-px bg-teal-300 dark:bg-teal-600" />
      <span class="text-xs font-medium text-teal-700 dark:text-teal-300">Relay</span>
    </div>

    <div
      v-else-if="account.platform === 'droid'"
      class="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-gradient-to-r from-cyan-100 to-sky-100 px-2.5 py-1 dark:border-cyan-700 dark:from-cyan-900/20 dark:to-sky-900/20"
    >
      <i class="fas fa-robot text-xs text-cyan-700 dark:text-cyan-400" />
      <span class="text-xs font-semibold text-cyan-800 dark:text-cyan-300">Droid</span>
      <span class="mx-1 h-4 w-px bg-cyan-300 dark:bg-cyan-600" />
      <span class="text-xs font-medium text-cyan-700 dark:text-cyan-300">{{ droidAuthType }}</span>
      <span v-if="isDroidApiKeyMode(account)" :class="droidBadgeClasses">
        <i class="fas fa-key text-[9px]" />
        <span>x{{ droidApiKeyCount }}</span>
      </span>
    </div>

    <div v-else class="flex items-center gap-1">
      <i class="fas fa-question text-xs text-gray-700" />
      <span class="text-xs font-semibold text-gray-800">未知</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  getClaudeAccountType,
  getClaudeAuthType,
  getGeminiAuthType,
  getOpenAIAuthType,
  getDroidAuthType,
  isDroidApiKeyMode,
  getDroidApiKeyCount,
  getDroidApiKeyBadgeClasses
} from '@/utils/accountHelpers'

const props = defineProps({
  account: {
    type: Object,
    required: true
  }
})

const geminiAuthType = computed(() => getGeminiAuthType(props.account))
const openAiAuthType = computed(() => getOpenAIAuthType())
const droidAuthType = computed(() => getDroidAuthType(props.account))
const droidApiKeyCount = computed(() => getDroidApiKeyCount(props.account))
const droidBadgeClasses = computed(() => getDroidApiKeyBadgeClasses(props.account))
const claudeAccountType = computed(() => getClaudeAccountType(props.account))
</script>
