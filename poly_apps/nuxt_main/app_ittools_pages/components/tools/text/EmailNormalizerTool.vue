<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-sky-50 to-blue-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-envelope text-sky-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">Email Normalizer</h2>
          </div>
          <p class="text-sm text-slate-600">Normalize and validate email addresses</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Input Section -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <input v-model="email" type="email" 
              class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="john.doe+test@gmail.com" @input="normalizeEmail" />
          </div>

          <div class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <p class="font-medium mb-1">What this tool does:</p>
            <ul class="list-disc list-inside space-y-1">
              <li>Removes dots from Gmail local part (j.o.h.n = john)</li>
              <li>Removes plus aliases (john+alias@gmail.com = john@gmail.com)</li>
              <li>Converts domain to lowercase</li>
              <li>Validates email format</li>
            </ul>
          </div>
        </div>

        <!-- Result Section -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <div v-if="result" class="space-y-4">
            <!-- Validation Status -->
            <div :class="result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'"
              class="border rounded-xl p-4 flex items-center space-x-3">
              <i :class="result.valid ? 'fas fa-check-circle text-green-600' : 'fas fa-times-circle text-red-600'" class="text-2xl"></i>
              <span :class="result.valid ? 'text-green-700' : 'text-red-700'" class="font-medium">
                {{ result.valid ? 'Valid Email' : 'Invalid Email Format' }}
              </span>
            </div>

            <div v-if="result.valid" class="space-y-3">
              <!-- Normalized Email -->
              <div class="bg-sky-50 rounded-lg p-4">
                <div class="text-xs text-sky-600 mb-1">Normalized Email</div>
                <div class="font-mono text-lg text-sky-800 flex items-center justify-between">
                  <span>{{ result.normalized }}</span>
                  <button @click="copy(result.normalized)" class="text-sky-600 hover:text-sky-800">
                    <i class="fas fa-copy"></i>
                  </button>
                </div>
              </div>

              <!-- Parts -->
              <div class="border border-slate-200 rounded-lg overflow-hidden divide-y">
                <div class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">Local Part</span>
                  <span class="font-mono text-slate-800">{{ result.localPart }}</span>
                </div>
                <div class="px-4 py-3 flex justify-between">
                  <span class="text-slate-600">Domain</span>
                  <span class="font-mono text-slate-800">{{ result.domain }}</span>
                </div>
                <div v-if="result.plusAlias" class="px-4 py-3 flex justify-between bg-amber-50">
                  <span class="text-amber-600">Removed Alias</span>
                  <span class="font-mono text-amber-800">+{{ result.plusAlias }}</span>
                </div>
                <div v-if="result.dotsRemoved" class="px-4 py-3 flex justify-between bg-amber-50">
                  <span class="text-amber-600">Dots Removed</span>
                  <span class="font-mono text-amber-800">{{ result.dotsRemoved }}</span>
                </div>
              </div>

              <!-- Provider Info -->
              <div v-if="result.provider" class="bg-slate-50 rounded-lg p-4 flex items-center space-x-3">
                <i :class="getProviderIcon(result.provider)" class="text-2xl"></i>
                <div>
                  <div class="text-sm text-slate-500">Email Provider</div>
                  <div class="font-medium text-slate-800">{{ result.provider }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="border border-slate-200 rounded-xl bg-slate-50 p-8 text-center text-slate-400">
            <i class="fas fa-envelope text-4xl mb-2"></i>
            <p>Enter an email to normalize</p>
          </div>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex justify-end space-x-3">
      <button @click="reset" class="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-white transition">
        Reset
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const email = ref('');
const result = ref<any>(null);

const normalizeEmail = () => {
  if (!email.value.trim()) {
    result.value = null;
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value)) {
    result.value = { valid: false };
    return;
  }

  const [localPart, domain] = email.value.split('@');
  const lowerDomain = domain.toLowerCase();
  
  let normalized = localPart;
  let plusAlias = null;
  let dotsRemoved = 0;

  // Handle plus alias
  if (normalized.includes('+')) {
    const [base, alias] = normalized.split('+');
    plusAlias = alias;
    normalized = base;
  }

  // Handle Gmail-specific normalization
  const isGmail = ['gmail.com', 'googlemail.com'].includes(lowerDomain);
  if (isGmail) {
    const original = normalized;
    normalized = normalized.replace(/\./g, '');
    dotsRemoved = original.length - normalized.length;
  }

  const provider = getEmailProvider(lowerDomain);

  result.value = {
    valid: true,
    original: email.value,
    normalized: `${normalized.toLowerCase()}@${lowerDomain}`,
    localPart: normalized.toLowerCase(),
    domain: lowerDomain,
    plusAlias,
    dotsRemoved: dotsRemoved || null,
    provider
  };
};

const getEmailProvider = (domain: string): string | null => {
  const providers: Record<string, string> = {
    'gmail.com': 'Gmail',
    'googlemail.com': 'Gmail',
    'outlook.com': 'Outlook',
    'hotmail.com': 'Outlook',
    'live.com': 'Outlook',
    'yahoo.com': 'Yahoo',
    'icloud.com': 'iCloud',
    'protonmail.com': 'ProtonMail',
    'qq.com': 'QQ Mail',
    '163.com': 'NetEase 163'
  };
  return providers[domain] || null;
};

const getProviderIcon = (provider: string): string => {
  const icons: Record<string, string> = {
    'Gmail': 'fab fa-google text-red-500',
    'Outlook': 'fab fa-microsoft text-blue-500',
    'Yahoo': 'fab fa-yahoo text-purple-500',
    'iCloud': 'fab fa-apple text-slate-800',
    'ProtonMail': 'fas fa-shield-alt text-purple-600'
  };
  return icons[provider] || 'fas fa-envelope text-slate-500';
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};

const reset = () => {
  email.value = '';
  result.value = null;
};
</script>

