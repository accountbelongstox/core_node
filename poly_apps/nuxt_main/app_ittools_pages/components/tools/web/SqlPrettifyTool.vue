<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-database text-indigo-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200">
            <h3 class="text-sm font-semibold text-slate-700">Input SQL</h3>
            <p class="text-xs text-slate-500">Supports multi-line statements and DDL/DML.</p>
          </header>
          <textarea
            v-model="sql"
            rows="18"
            class="w-full px-4 py-3 border-0 rounded-b-xl font-mono text-xs bg-slate-900 text-indigo-100 focus:outline-none"
            spellcheck="false"
          ></textarea>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Formatted SQL</h3>
              <p class="text-xs text-slate-500">Consistent casing, indentation, and spacing.</p>
            </div>
            <div class="flex items-center space-x-3 text-xs text-slate-600">
              <label class="inline-flex items-center space-x-2">
                <span>Indent</span>
                <select v-model="indent" class="px-2 py-1 border border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-transparent">
                  <option value="  ">2 spaces</option>
                  <option value="    ">4 spaces</option>
                  <option value="\t">Tabs</option>
                </select>
              </label>
              <label class="inline-flex items-center space-x-2">
                <input type="checkbox" v-model="uppercase" class="rounded text-indigo-600 focus:ring-indigo-500">
                <span>Uppercase keywords</span>
              </label>
              <button
                @click="prettify"
                :disabled="!canPrettify"
                class="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium shadow hover:bg-indigo-700 disabled:opacity-60"
              >
                <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
                <i v-else class="fas fa-magic mr-2"></i>
                Format
              </button>
            </div>
          </header>
          <div class="relative flex-1">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <i class="fas fa-spinner fa-spin text-indigo-600 text-xl"></i>
            </div>
            <textarea
              v-model="output"
              readonly
              class="w-full h-full px-4 py-4 border-0 rounded-b-xl bg-slate-900 text-emerald-200 font-mono text-xs"
            ></textarea>
          </div>
          <footer class="px-5 py-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
            <button @click="copyOutput" :disabled="!output" class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <i class="fas fa-copy mr-1"></i>
              Copy
            </button>
          </footer>
          <p v-if="error" class="px-5 pb-4 text-sm text-red-600">{{ error }}</p>
        </section>
      </div>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/web/sql/format</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const sql = ref("select id, name, price from products where price > 100 order by created_at desc;");
const indent = ref<'  ' | '    ' | '\t'>('  ');
const uppercase = ref(true);
const output = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canPrettify = computed(() => sql.value.trim().length > 0 && !loading.value);

const prettify = async () => {
  if (!canPrettify.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.formatSql(sql.value, indent.value, uppercase.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.formatted) {
      output.value = response.data.formatted;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to format SQL');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'SQL formatter unavailable';
    output.value = '';
  } finally {
    loading.value = false;
  }
};

const copyOutput = async () => {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
  } catch (err) {
    console.error('Copy failed', err);
  }
};

prettify();
</script>
