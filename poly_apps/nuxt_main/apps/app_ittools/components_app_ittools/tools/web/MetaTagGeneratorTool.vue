<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-pink-50 to-orange-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-tags text-pink-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-pink-100 text-pink-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-5">
        <section class="lg:col-span-2 border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">Page data</h3>
            <p class="text-xs text-slate-500">Populate SEO & social metadata.</p>
          </header>
          <div class="px-5 py-4 space-y-4">
            <label class="space-y-1 text-sm text-slate-600">
              <span>Title</span>
              <input v-model="title" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-pink-500 focus:border-transparent" placeholder="Awesome Landing Page">
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Description</span>
              <textarea v-model="description" rows="4" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-pink-500 focus:border-transparent" placeholder="Concise summary for search and social cards."></textarea>
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Keywords (comma separated)</span>
              <input v-model="keywords" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-pink-500 focus:border-transparent" placeholder="seo,meta,tags">
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Author</span>
              <input v-model="author" type="text" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-pink-500 focus:border-transparent" placeholder="Jane Doe">
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Open Graph Image URL</span>
              <input v-model="image" type="url" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-pink-500 focus:border-transparent" placeholder="https://example.com/cover.png">
            </label>
            <label class="space-y-1 text-sm text-slate-600">
              <span>Open Graph Type</span>
              <select v-model="ogType" class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-pink-500 focus:border-transparent">
                <option value="website">Website</option>
                <option value="article">Article</option>
                <option value="product">Product</option>
              </select>
            </label>
            <button
              @click="generate"
              :disabled="!canGenerate"
              class="w-full px-4 py-2 rounded-lg bg-pink-500 text-white font-medium shadow hover:bg-pink-600 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-magic mr-2"></i>
              Generate Meta Tags
            </button>
            <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          </div>
        </section>

        <section class="lg:col-span-3 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Generated Markup</h3>
              <p class="text-xs text-slate-500">Copy and paste into your HTML &lt;head&gt;.</p>
            </div>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
              <button
                @click="copyHtml"
                :disabled="!html"
                class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy HTML
              </button>
            </div>
          </header>
          <pre class="flex-1 bg-slate-900 text-pink-100 p-4 text-xs overflow-auto">{{ html || '&lt;!-- Fill in content and generate tags --&gt;' }}</pre>
        </section>
      </div>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/web/meta-tags/generate</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const title = ref('IT Tools Playground');
const description = ref('Developer-first utilities for crypto, text, converters, and diagnostics.');
const keywords = ref('tools,developer,utilities');
const author = ref('IT Tools');
const image = ref('https://example.com/og-image.png');
const ogType = ref('website');
const html = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canGenerate = computed(() => title.value.trim().length > 0 && description.value.trim().length > 0 && !loading.value);

const generate = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateMetaTags({
      title: title.value.trim(),
      description: description.value.trim(),
      keywords: keywords.value
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      author: author.value.trim() || undefined,
      image: image.value.trim() || undefined,
      ogType: ogType.value
    });
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.html) {
      html.value = response.data.html;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to generate meta tags');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'Meta tag service unavailable';
    html.value = '';
  } finally {
    loading.value = false;
  }
};

const copyHtml = async () => {
  if (!html.value) return;
  try {
    await navigator.clipboard.writeText(html.value);
  } catch (err) {
    console.error('Copy failed', err);
  }
};

generate();
</script>
