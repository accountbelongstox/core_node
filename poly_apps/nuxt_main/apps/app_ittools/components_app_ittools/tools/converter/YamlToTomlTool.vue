<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-teal-50 to-emerald-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-leaf text-teal-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">Converter</span>
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
              <h3 class="text-sm font-semibold text-slate-700">YAML input</h3>
              <p class="text-xs text-slate-500">Provide YAML configuration to convert into TOML.</p>
            </div>
            <button
              @click="yamlInput = defaultYaml"
              class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
            >
              Reset example
            </button>
          </header>
          <div class="px-5 py-4">
            <textarea
              v-model="yamlInput"
              rows="12"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition font-mono text-sm"
            ></textarea>
          </div>
        </section>

        <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
          <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-slate-700">TOML output</h3>
              <p class="text-xs text-slate-500">TOML-formatted configuration.</p>
            </div>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <i class="fas fa-stopwatch"></i>
              <span v-if="executionTime">{{ executionTime }} ms</span>
            </div>
          </header>
          <div class="relative px-5 py-4">
            <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-teal-500 text-xl"></i>
            </div>
            <textarea
              v-model="tomlOutput"
              rows="12"
              readonly
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm bg-slate-900 text-emerald-300 font-mono text-sm"
            ></textarea>
            <div class="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{{ tomlOutput ? 'Length: ' + tomlOutput.length + ' chars' : 'No output yet' }}</span>
              <button
                @click="copyToml"
                :disabled="!tomlOutput"
                class="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy TOML
              </button>
            </div>
            <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
          </div>
        </section>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="yamlInput.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-teal-500 text-white font-medium shadow hover:bg-teal-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-exchange-alt mr-2"></i>
        Convert to TOML
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/yaml-to-toml</code></span>
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

const defaultYaml = `database:
  host: localhost
  port: 5432
`;
const yamlInput = ref(defaultYaml);
const tomlOutput = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const convert = async () => {
  if (!yamlInput.value.trim() || loading.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.yamlToToml(yamlInput.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data?.toml !== undefined) {
      tomlOutput.value = response.data.toml;
      emit('executed', response.data);
    } else {
      tomlOutput.value = '';
      error.value = response.error || response.message || 'Conversion failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    tomlOutput.value = '';
    error.value = err?.message || 'YAML → TOML service unavailable';
  } finally {
    loading.value = false;
  }
};

const copyToml = async () => {
  if (!tomlOutput.value) return;
  try {
    await navigator.clipboard.writeText(tomlOutput.value);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

onMounted(() => {
  convert();
});

</script>
