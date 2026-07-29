<template>
  <div class="tk-card rounded-lg p-2.5 overflow-hidden border">
    <h4 class="text-[9px] font-bold uppercase tracking-tight mb-1.5" style="color: var(--text-muted)">
      AI Web Provider
    </h4>
    <p class="text-[8px] mb-2" style="color: var(--text-faint)">
      Which web AI the prompt-translate / web-chat workers drive in your live browser.
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
    <p v-if="saved" class="text-[8px] mt-1.5 text-emerald-400">Saved</p>

    <!-- Word-validity task: which web AI classifies words (DeepSeek default). -->
    <h4 class="text-[9px] font-bold uppercase tracking-tight mt-3 mb-1.5" style="color: var(--text-muted)">
      Validity AI Provider
    </h4>
    <p class="text-[8px] mb-2" style="color: var(--text-faint)">
      Which web AI the word-validity check drives (validity + translation in one pass).
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
    <p v-if="validitySaved" class="text-[8px] mt-1.5 text-emerald-400">Saved</p>

    <!-- Word-validity task: which word language to drain (EN only by default). -->
    <h4 class="text-[9px] font-bold uppercase tracking-tight mt-3 mb-1.5" style="color: var(--text-muted)">
      Validity Word Language
    </h4>
    <p class="text-[8px] mb-2" style="color: var(--text-faint)">
      Only EN words are processed by default; pick another language to drain its backlog instead.
    </p>
    <div class="flex gap-1.5 flex-wrap">
      <button
        v-for="opt in languageOptions"
        :key="opt.id"
        @click="selectLanguage(opt.id)"
        :class="[
          'px-2 py-1.5 rounded text-[9px] font-bold transition-all border',
          validityLanguage === opt.id
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
        placeholder="Other language code"
        @keyup.enter="selectCustomLanguage"
      />
      <button
        class="px-2 py-1.5 rounded text-[9px] font-bold border text-slate-300"
        @click="selectCustomLanguage"
      >Use</button>
    </div>
    <p v-if="languageSaved" class="text-[8px] mt-1.5 text-emerald-400">Saved</p>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import {
  getPreferredProvider,
  setPreferredProvider,
  getValidityProvider,
  setValidityProvider,
  getValidityLanguage,
  setValidityLanguage,
  type AiWebProvider,
} from '@/services/AiProviderSettings';

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
const validityLanguage = ref<string>('en');
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
    validityLanguage.value = await getValidityLanguage();
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
  try {
    await setValidityLanguage(id);
    validityLanguage.value = id;
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
