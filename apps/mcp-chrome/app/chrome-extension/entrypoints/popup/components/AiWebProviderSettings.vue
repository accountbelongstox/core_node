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
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import {
  getPreferredProvider,
  setPreferredProvider,
  type AiWebProvider,
} from '@/services/AiProviderSettings';

type SelectableProvider = Extract<AiWebProvider, 'chatgpt' | 'gemini'>;

const options: { id: SelectableProvider; label: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
];

const provider = ref<SelectableProvider>('chatgpt');
const saved = ref(false);

onMounted(async () => {
  try {
    const stored = await getPreferredProvider();
    if (stored === 'chatgpt' || stored === 'gemini') provider.value = stored;
  } catch {
    // keep default
  }
});

const select = async (id: SelectableProvider) => {
  provider.value = id;
  try {
    await setPreferredProvider(id);
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 1500);
  } catch {
    // ignore persist failure
  }
};
</script>
