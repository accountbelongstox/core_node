<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-purple-50 via-indigo-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-markdown text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Converter</span>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition"
            title="Close"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Markdown input</h3>
              <p class="text-xs text-slate-500">Supports headings, lists, tables, code blocks, etc.</p>
            </div>
            <button
              @click="markdown = defaultMarkdown"
              class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
            >
              Reset example
            </button>
          </header>
          <div class="px-5 py-4">
            <textarea
              v-model="markdown"
              rows="15"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition font-mono text-sm"
            ></textarea>
          </div>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">HTML Preview</h3>
              <p class="text-xs text-slate-500">Rendered HTML with basic styles.</p>
            </div>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <i class="fas fa-stopwatch"></i>
              <span v-if="executionTime">{{ executionTime }} ms</span>
            </div>
          </header>
          <div class="flex-1 overflow-y-auto px-5 py-4 bg-slate-50">
            <div v-if="loading" class="flex items-center justify-center h-full">
              <i class="fas fa-spinner fa-spin text-indigo-500 text-xl"></i>
            </div>
            <div v-else class="prose prose-sm max-w-none" v-html="html"></div>
            <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
          </div>

          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              @click="copyHtml"
              :disabled="!html"
              class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs"
            >
              <i class="fas fa-copy mr-1"></i>
              Copy HTML
            </button>
            <button
              @click="openModal = !openModal"
              :disabled="!html"
              class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition text-xs"
            >
              View raw HTML
            </button>
          </footer>
        </section>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="loading"
        class="px-5 py-2 rounded-lg bg-indigo-500 text-white font-medium shadow hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-code mr-2"></i>
        Convert to HTML
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/web/markdown/to-html</code></span>
    </div>

    <dialog v-if="openModal" class="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h4 class="text-sm font-semibold text-slate-700">Raw HTML</h4>
          <button @click="openModal = false" class="text-slate-400 hover:text-slate-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="px-5 py-4">
          <textarea
            class="w-full h-80 px-4 py-3 border border-slate-200 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs"
            readonly
          >{{ html }}</textarea>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const defaultMarkdown = `# Markdown Preview

- Easy conversion
- Code blocks
- **Bold** / *Italic*

\

1. Step One
2. Step Two


`; // adjust formatting
const markdown = ref(defaultMarkdown);
const html = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);
const openModal = ref(false);

const convert = async () => {
  if (loading.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.markdownToHtml(markdown.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.html !== undefined) {
      html.value = response.data.html;
      emit('executed', response.data);
    } else {
      html.value = '';
      error.value = response.error || response.message || 'Conversion failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    html.value = '';
    error.value = err?.message || 'Markdown service unavailable';
  } finally {
    loading.value = false;
  }
};

const copyHtml = async () => {
  if (!html.value) return;
  try {
    await navigator.clipboard.writeText(html.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

onMounted(() => {
  convert();
});

</script>
