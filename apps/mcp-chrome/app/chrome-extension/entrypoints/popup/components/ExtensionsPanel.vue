<template>
  <div class="flex flex-col gap-2.5 h-[420px]">
    <!-- ============================================================ -->
    <!-- Horizontal extension tabs -->
    <!-- ============================================================ -->
    <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 shrink-0">
      <button
        v-for="extension in extensions"
        :key="extension.id"
        @click="activeExtId = extension.id"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors shrink-0"
        :style="
          activeExtId === extension.id
            ? 'background: var(--accent-soft); color: var(--accent-fg); border: 1px solid var(--accent)'
            : 'color: var(--text-muted); border: 1px solid transparent'
        "
      >
        <span class="text-sm leading-none">{{ extension.icon }}</span>
        {{ extension.name }}
      </button>
    </div>

    <!-- ============================================================ -->
    <!-- Active extension panel -->
    <!-- ============================================================ -->
    <div
      v-if="activeExtension"
      class="flex-1 min-h-0 overflow-y-auto no-scrollbar rounded-lg"
      style="background: var(--surface); border: 1px solid var(--border)"
    >
      <!-- Panel header: name + enable toggle -->
      <div
        class="flex items-center justify-between px-3 py-2 sticky top-0 z-10"
        style="background: var(--surface); border-bottom: 1px solid var(--border)"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-sm leading-none">{{ activeExtension.icon }}</span>
          <div class="min-w-0">
            <div class="text-[11px] font-semibold truncate" style="color: var(--text)">
              {{ activeExtension.name }}
            </div>
            <div class="text-[9px] truncate" style="color: var(--text-faint)">
              {{ activeExtension.description }}
            </div>
          </div>
        </div>
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

      <!-- Active component -->
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
