<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-lime-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-file-code text-amber-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Web</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">YAML Input</h3>
              <p class="text-xs text-slate-500">Paste config snippets, Kubernetes manifests, etc.</p>
            </div>
            <button
              @click="validate"
              :disabled="!canValidate"
              class="px-4 py-2 rounded-lg bg-amber-500 text-white font-medium shadow hover:bg-amber-600 disabled:opacity-60"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-check mr-2"></i>
              Validate
            </button>
          </header>
          <textarea
            v-model="yaml"
            rows="18"
            class="w-full px-4 py-3 border-0 rounded-b-xl font-mono text-xs bg-slate-900 text-amber-100 focus:outline-none"
          ></textarea>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">Parsed JSON</h3>
              <p class="text-xs text-slate-500">Use the structured preview for debugging.</p>
            </div>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <span v-if="executionTime"><i class="fas fa-stopwatch mr-1"></i>{{ executionTime }} ms</span>
              <button @click="copyJson" :disabled="!parsed" class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <i class="fas fa-copy mr-1"></i>
                Copy JSON
              </button>
            </div>
          </header>
          <div class="relative flex-1">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
              <i class="fas fa-spinner fa-spin text-amber-600 text-xl"></i>
            </div>
            <pre class="w-full h-full px-4 py-4 bg-slate-900 text-lime-200 font-mono text-xs overflow-auto">{{ formattedJson }}</pre>
          </div>
          <footer class="px-5 py-4 border-t border-slate-200">
            <span v-if="valid === true" class="text-emerald-600 text-sm font-semibold"><i class="fas fa-check-circle mr-1"></i>Valid YAML</span>
            <span v-else-if="valid === false" class="text-rose-600 text-sm font-semibold"><i class="fas fa-times-circle mr-1"></i>Invalid YAML</span>
            <span v-else class="text-slate-500 text-sm">Awaiting validation</span>
            <p v-if="error" class="mt-2 text-sm text-rose-600">{{ error }}</p>
          </footer>
        </section>
      </div>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoint: <code class="text-slate-700">/web/yaml/validate</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const yaml = ref('name: IT Tools\nfeatures:\n  - crypto\n  - converters');
const parsed = ref<Record<string, any> | null>(null);
const valid = ref<boolean | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const canValidate = computed(() => yaml.value.trim().length > 0 && !loading.value);

const formattedJson = computed(() => {
  if (!parsed.value) return '{\n  // Run validation to view parsed JSON\n}';
  try {
    return JSON.stringify(parsed.value, null, 2);
  } catch (err) {
    return String(parsed.value);
  }
});

const validate = async () => {
  if (!canValidate.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.validateYaml(yaml.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      valid.value = response.data.valid;
      parsed.value = response.data.parsed || null;
      if (response.data.error) error.value = response.data.error;
      emit('executed', response.data);
      if (!response.data.valid) {
        error.value = response.data.error || 'Invalid YAML content';
      }
    } else {
      throw new Error(response.error || response.message || 'Unable to validate YAML');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'YAML validator unavailable';
    valid.value = false;
    parsed.value = null;
  } finally {
    loading.value = false;
  }
};

const copyJson = async () => {
  if (!parsed.value) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(parsed.value, null, 2));
  } catch (err) {
    console.error('Copy failed', err);
  }
};

validate();
</script>
