<template>
  <div class="flex flex-col gap-2.5 h-[420px]">
    <!-- Extension menu: 2-row grid -->
    <div class="grid grid-cols-3 gap-1 shrink-0">
      <button
        v-for="extension in extensions"
        :key="extension.id"
        @click="activeExtId = extension.id"
        class="flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-md text-[9px] font-bold leading-tight text-center transition-colors min-h-[44px]"
        :style="
          activeExtId === extension.id
            ? 'background: var(--accent-soft); color: var(--accent-fg); border: 1px solid var(--accent)'
            : 'color: var(--text-muted); border: 1px solid transparent'
        "
      >
        <span class="text-sm leading-none">{{ extension.icon }}</span>
        <span class="line-clamp-2">{{ extension.name }}</span>
      </button>
    </div>

    <div v-if="activeExtension" class="flex items-center justify-end gap-1.5 shrink-0">
      <span class="text-[8px] font-bold uppercase" style="color: var(--text-faint)">Enabled</span>
      <button
        @click="toggleExtension(activeExtension.id)"
        :class="[
          'relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0',
          activeExtension.enabled ? 'bg-indigo-600' : 'bg-slate-500',
        ]"
        :aria-pressed="activeExtension.enabled"
      >
        <span
          :class="[
            'inline-block h-3 w-3 rounded-full bg-white transition-transform',
            activeExtension.enabled ? 'translate-x-3.5' : 'translate-x-0.5',
          ]"
        />
      </button>
    </div>

    <!-- Active extension panel -->
    <div
      v-if="activeExtension"
      class="flex-1 min-h-0 overflow-y-auto no-scrollbar rounded-lg"
      style="background: var(--surface); border: 1px solid var(--border)"
    >
      <div class="p-2.5">
        <component v-if="activeExtension.component" :is="activeExtension.component" />
        <div v-else class="text-[10px]" style="color: var(--text-faint)">
          {{ getMessage('extNoConfig') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { getMessage } from '@/utils/i18n';
import { useExtensionConfig } from '@/composables/useExtensionConfig';
import { usePersistedRef } from '@/composables/usePersistedRef';
import BingDictionary from './extensions/BingDictionary.vue';
import NotebookLMPanel from './extensions/NotebookLMPanel.vue';
import GeminiImage from './extensions/GeminiImage.vue';
import ArticleStudyGuide from './extensions/ArticleStudyGuide.vue';
import BookStudyGenerator from './extensions/BookStudyGenerator.vue';
import AiTranslateHub from './extensions/AiTranslateHub.vue';
import WebSearchPanel from './extensions/WebSearchPanel.vue';
import QwenTtsPanel from './extensions/QwenTtsPanel.vue';

// Extension config management. The old in-extension "Local Task Queue" (Process
// API requests locally) was removed — it duplicated the laravel-aligned Bing
// translation worker (own tab pool, own poller, no cross-system dedup). Each
// remaining extension owns its own controls inside its panel.
const {
  extensions,
  toggleExtension,
  registerComponent,
  initialize: initExtensions,
} = useExtensionConfig();

// Horizontal tab selection, persisted so reopening the popup returns to the same
// extension instead of resetting to the first one.
const activeExtId = usePersistedRef<string>('activeExtId', '');
const activeExtension = computed(
  () => extensions.value.find((e) => e.id === activeExtId.value) || extensions.value[0],
);

const registerAllComponents = () => {
  registerComponent('bing-dictionary', BingDictionary);
  registerComponent('notebooklm', NotebookLMPanel);
  registerComponent('gemini-image', GeminiImage);
  registerComponent('article-study-guide', ArticleStudyGuide);
  registerComponent('book-study-generator', BookStudyGenerator);
  registerComponent('ai-translate-hub', AiTranslateHub);
  registerComponent('web-search', WebSearchPanel);
  registerComponent('qwen-tts', QwenTtsPanel);
};

onMounted(async () => {
  await initExtensions();
  registerAllComponents();
  if (!activeExtId.value && extensions.value.length > 0) {
    activeExtId.value = extensions.value[0].id;
  }
  console.log('[ExtensionsPanel] Initialized');
});
</script>
