<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-slate-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-link text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Converter</span>
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
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Text to slugify</label>
            <textarea
              v-model="text"
              rows="4"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              placeholder="Hello World! This is a Test."
            ></textarea>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Separator</label>
              <input
                v-model="separator"
                type="text"
                maxlength="2"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition text-center"
              />
            </div>
            <div class="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <input
                id="slugify-lowercase"
                v-model="lowercase"
                type="checkbox"
                class="h-4 w-4 text-amber-500 focus:ring-amber-500 border-slate-300 rounded"
              />
              <label for="slugify-lowercase" class="ml-2 text-sm text-slate-700">Lowercase output</label>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Slug result</h3>
                <p class="text-xs text-slate-500">Copy and use in URLs, filenames, or identifiers.</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="px-5 py-4">
              <div class="bg-slate-900 text-emerald-300 text-sm font-mono rounded-xl p-4 min-h-[80px] flex items-center justify-between">
                <span class="break-all">{{ slug || 'slug-output-will-appear-here' }}</span>
                <button
                  @click="copySlug"
                  :disabled="!slug"
                  class="ml-4 text-xs text-amber-400 hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i class="fas fa-copy"></i>
                </button>
              </div>
              <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="generate"
        :disabled="text.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-link mr-2"></i>
        Generate slug
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/slugify</code></span>
    </div>
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

const text = ref('Hello World! This is a Test.');
const separator = ref('-');
const lowercase = ref(true);
const slug = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const generate = async () => {
  if (!text.value.trim() || loading.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.slugify(text.value, separator.value || '-', lowercase.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.slug) {
      slug.value = response.data.slug;
      emit('executed', response.data);
    } else {
      slug.value = '';
      error.value = response.error || response.message || 'Failed to generate slug';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    slug.value = '';
    error.value = err?.message || 'Slug service unavailable';
  } finally {
    loading.value = false;
  }
};

const copySlug = async () => {
  if (!slug.value) return;
  try {
    await navigator.clipboard.writeText(slug.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

onMounted(() => {
  generate();
});

</script>
