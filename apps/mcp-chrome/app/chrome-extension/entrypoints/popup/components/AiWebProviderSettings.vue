<template>
  <div class="tk-card rounded-lg p-2.5 overflow-hidden border">
    <h4 class="text-[9px] font-bold uppercase tracking-tight mb-1.5" style="color: var(--text-muted)">
      {{ getMessage('aiWebProviderTitle') }}
    </h4>
    <p class="text-[8px] mb-2" style="color: var(--text-faint)">
      {{ getMessage('aiWebProviderHint') }}
    </p>
    <div class="flex gap-1.5">
      <button
        v-for="opt in options"
        :key="opt.id"
        @click="select(opt.id)"
        :class="[
          'flex-1 px-2 py-1.5 rounded text-[9px] font-bold transition-all border',
          provider === opt.id
            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
            : 'text-slate-400 border-slate-700 hover:bg-slate-800/50',
        ]"
      >
        {{ opt.label }}
      </button>
    </div>
    <p v-if="saved" class="text-[8px] mt-1.5 text-emerald-400">{{ getMessage('savedStatus') }}</p>

    <!-- Word-validity task: which web AI classifies words (DeepSeek default). -->
    <h4 class="text-[9px] font-bold uppercase tracking-tight mt-3 mb-1.5" style="color: var(--text-muted)">
      {{ getMessage('validityAiProviderTitle') }}
    </h4>
    <p class="text-[8px] mb-2" style="color: var(--text-faint)">
      {{ getMessage('validityAiProviderHint') }}
    </p>
    <div class="flex gap-1.5">
      <button
        v-for="opt in validityOptions"
        :key="opt.id"
        @click="selectValidity(opt.id)"
        :class="[
          'flex-1 px-2 py-1.5 rounded text-[9px] font-bold transition-all border',
          validityProvider === opt.id
            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
            : 'text-slate-400 border-slate-700 hover:bg-slate-800/50',
        ]"
      >
        {{ opt.label }}
      </button>
    </div>
    <p v-if="validitySaved" class="text-[8px] mt-1.5 text-emerald-400">{{ getMessage('savedStatus') }}</p>

    <!-- Word-validity task: which word languages to drain (multi-select, EN by default). -->
    <h4 class="text-[9px] font-bold uppercase tracking-tight mt-3 mb-1.5" style="color: var(--text-muted)">
      {{ getMessage('validityWordLanguageTitle') }}
    </h4>
    <p class="text-[8px] mb-2" style="color: var(--text-faint)">
      {{ getMessage('validityWordLanguageHint') }}
    </p>
    <div class="flex gap-1.5 flex-wrap">
      <button
        v-for="opt in languageOptions"
        :key="opt.id"
        @click="selectLanguage(opt.id)"
        :class="[
          'px-2 py-1.5 rounded text-[9px] font-bold transition-all border',
          validityLanguages.includes(opt.id)
            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
            : 'text-slate-400 border-slate-700 hover:bg-slate-800/50',
        ]"
      >
        {{ opt.label }}
      </button>
    </div>
    <div class="flex gap-1.5 mt-1.5">
      <input
        v-model.trim="customValidityLanguage"
        class="flex-1 min-w-0 px-2 py-1.5 rounded text-[9px] border bg-transparent"
        maxlength="12"
        :placeholder="getMessage('otherLanguageCodePlaceholder')"
        @keyup.enter="selectCustomLanguage"
      />
      <button
        class="px-2 py-1.5 rounded text-[9px] font-bold border text-slate-300"
        @click="selectCustomLanguage"
      >{{ getMessage('useButton') }}</button>
    </div>
    <p v-if="languageSaved" class="text-[8px] mt-1.5 text-emerald-400">{{ getMessage('savedStatus') }}</p>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import {
  getPreferredProvider,
  setPreferredProvider,
  getValidityProvider,
  setValidityProvider,
  getValidityLanguages,
  setValidityLanguages,
  type AiWebProvider,
} from '@/services/AiProviderSettings';
import { getMessage } from '@/utils/i18n';

type SelectableProvider = Extract<AiWebProvider, 'chatgpt' | 'gemini'>;

const options: { id: SelectableProvider; label: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
];

const validityOptions: { id: AiWebProvider; label: string }[] = [
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'chatgpt', label: 'ChatGPT' },
];

const languageOptions: { id: string; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'zh', label: 'ZH' },
  { id: 'ja', label: 'JA' },
  { id: 'ko', label: 'KO' },
  { id: 'es', label: 'ES' },
  { id: 'fr', label: 'FR' },
  { id: 'de', label: 'DE' },
];

const provider = ref<SelectableProvider>('chatgpt');
const validityProvider = ref<AiWebProvider>('deepseek');
const validityLanguages = ref<string[]>(['en']);
const customValidityLanguage = ref('');
const saved = ref(false);
const validitySaved = ref(false);
const languageSaved = ref(false);

function flash(flag: typeof saved): void {
  flag.value = true;
  setTimeout(() => {
    flag.value = false;
  }, 1500);
}

onMounted(async () => {
  try {
    const stored = await getPreferredProvider();
    if (stored === 'chatgpt' || stored === 'gemini') provider.value = stored;
  } catch {
    // keep default
  }
  try {
    validityProvider.value = await getValidityProvider();
  } catch {
    // keep default
  }
  try {
    validityLanguages.value = await getValidityLanguages();
  } catch {
    // keep default
  }
});

const select = async (id: SelectableProvider) => {
  provider.value = id;
  try {
    await setPreferredProvider(id);
    flash(saved);
  } catch {
    // ignore persist failure
  }
};

const selectValidity = async (id: AiWebProvider) => {
  validityProvider.value = id;
  try {
    await setValidityProvider(id);
    flash(validitySaved);
  } catch {
    // ignore persist failure
  }
};

const selectLanguage = async (id: string): Promise<boolean> => {
  // Multi-select toggle (2.4): click adds/removes the language; the selection
  // must keep at least one language (EN is the default selection).
  const code = String(id || '').trim().toLowerCase();
  if (!code) return false;
  const current = validityLanguages.value.includes(code)
    ? validityLanguages.value.filter((lang) => lang !== code)
    : [...validityLanguages.value, code];
  if (current.length === 0) return false;
  try {
    await setValidityLanguages(current);
    validityLanguages.value = current;
    flash(languageSaved);
    return true;
  } catch {
    return false;
  }
};

const selectCustomLanguage = async () => {
  const language = customValidityLanguage.value.trim().toLowerCase();
  if (!language) return;
  if (await selectLanguage(language)) customValidityLanguage.value = '';
};
</script>
