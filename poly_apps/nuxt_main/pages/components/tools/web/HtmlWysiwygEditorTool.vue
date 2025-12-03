<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-rose-50 to-purple-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-pen-nib text-rose-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-rose-100 text-rose-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-5">
        <section class="lg:col-span-2 border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Source</h3>
              <p class="text-xs text-slate-500">Write Markdown or raw HTML.</p>
            </div>
            <div class="inline-flex rounded-xl border border-slate-200 bg-white">
              <button
                class="px-3 py-1.5 text-xs font-semibold rounded-l-xl"
                :class="mode === 'markdown' ? 'bg-rose-600 text-white' : 'text-slate-600'"
                @click="mode = 'markdown'"
              >Markdown</button>
              <button
                class="px-3 py-1.5 text-xs font-semibold rounded-r-xl"
                :class="mode === 'html' ? 'bg-rose-600 text-white' : 'text-slate-600'"
                @click="mode = 'html'"
              >HTML</button>
            </div>
          </header>
          <div class="px-5 py-4 space-y-3">
            <textarea
              v-model="content"
              rows="16"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="# Welcome to IT Tools"
            ></textarea>
            <label class="flex items-center justify-between text-xs text-slate-600">
              <span>Sanitize output</span>
              <input type="checkbox" v-model="sanitize" class="rounded text-rose-600 focus:ring-rose-500">
            </label>
            <button
              @click="renderContent"
              :disabled="!canRender"
              class="w-full px-4 py-2 rounded-lg bg-rose-500 text-white font-medium shadow hover:bg-rose-600 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-eye mr-2"></i>
              Render Preview
            </button>
            <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
          </div>
        </section>

        <section class="lg:col-span-3 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Preview</h3>
              <p class="text-xs text-slate-500">Rendered HTML straight from the backend.</p>
            </div>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
              <button @click="copyHtml" :disabled="!rendered" class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <i class="fas fa-copy mr-1"></i>
                Copy HTML
              </button>
            </div>
          </header>
          <div class="relative flex-1 overflow-auto">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <i class="fas fa-spinner fa-spin text-rose-600 text-xl"></i>
            </div>
            <div class="prose max-w-none px-6 py-6" v-html="rendered || '<p class=\'text-slate-400\'>Write something to see the preview.</p>'"></div>
          </div>
        </section>
      </div>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/web/html/render</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const mode = ref<'markdown' | 'html'>('markdown');
const sanitize = ref(true);
const content = ref('# IT Tools\n\n**Powerful** developer Swiss army knife.');
const rendered = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canRender = computed(() => content.value.trim().length > 0 && !loading.value);

const renderContent = async () => {
  if (!canRender.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.renderHtml(content.value, mode.value, sanitize.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.html) {
      rendered.value = response.data.html;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to render markup');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'HTML rendering service unavailable';
    rendered.value = '';
  } finally {
    loading.value = false;
  }
};

const copyHtml = async () => {
  if (!rendered.value) return;
  try {
    await navigator.clipboard.writeText(rendered.value);
  } catch (err) {
    console.error('Copy failed', err);
  }
};

renderContent();
</script>
