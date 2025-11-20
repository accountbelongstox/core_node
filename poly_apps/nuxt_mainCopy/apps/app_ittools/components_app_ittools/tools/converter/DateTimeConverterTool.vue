<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50/70">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-clock text-blue-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Converter</span>
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
      <div class="grid gap-6 lg:grid-cols-12">
        <div class="lg:col-span-4 space-y-5">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Input Date &amp; Time</h3>
                <p class="text-xs text-slate-500">Paste a timestamp or let us generate one.</p>
              </div>
              <div class="flex items-center space-x-2">
                <button
                  @click="setFromNow()"
                  class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                >
                  Now
                </button>
                <button
                  @click="setFromUnix()"
                  class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                >
                  Unix
                </button>
              </div>
            </header>
            <div class="px-5 py-4 space-y-3">
              <textarea
                v-model="inputValue"
                rows="4"
                class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition font-mono text-sm"
                placeholder="2025-01-07T12:00:00Z"
              ></textarea>
              <p class="text-xs text-slate-400">
                Supports ISO 8601, Unix timestamps (seconds or milliseconds), RFC 2822 strings, and more. Choose the matching input format below.
              </p>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200">
              <h3 class="text-sm font-semibold text-slate-700">Parsing Options</h3>
              <p class="text-xs text-slate-500">Help the converter interpret your value correctly.</p>
            </header>
            <div class="px-5 py-4 space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Input Format</label>
                <select
                  v-model="inputFormat"
                  class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="auto">Auto detect</option>
                  <option value="iso">ISO 8601</option>
                  <option value="unix">Unix (seconds)</option>
                  <option value="unix_ms">Unix (milliseconds)</option>
                  <option value="rfc2822">RFC 2822</option>
                  <option value="custom">Custom format</option>
                </select>
              </div>

              <div v-if="requiresCustomInput" class="space-y-2">
                <label class="block text-xs font-medium text-slate-600">Custom Input Pattern</label>
                <input
                  v-model="customInputFormat"
                  type="text"
                  placeholder="YYYY-MM-DD HH:mm:ss"
                  class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                <p class="text-xs text-slate-400">Use tokens compatible with the backend formatter (e.g., Day.js or Moment patterns).</p>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Output Format</label>
                <select
                  v-model="outputFormat"
                  class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">All representations</option>
                  <option value="iso">ISO 8601</option>
                  <option value="timestamp">Unix (seconds)</option>
                  <option value="unix">Unix (milliseconds)</option>
                  <option value="utc">UTC string</option>
                  <option value="locale">Locale string</option>
                  <option value="relative">Relative time</option>
                  <option value="custom">Custom pattern</option>
                </select>
              </div>

              <div v-if="requiresCustomOutput" class="space-y-2">
                <label class="block text-xs font-medium text-slate-600">Custom Output Pattern</label>
                <input
                  v-model="customOutputFormat"
                  type="text"
                  placeholder="dddd, MMMM D YYYY HH:mm"
                  class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                <p class="text-xs text-slate-400">Patterns follow the backend formatter (e.g., <code>YYYY-MM-DD</code>).</p>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Timezone</label>
                <select
                  v-model="timezone"
                  class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="utc">UTC</option>
                  <option value="local">Device local</option>
                  <option value="est">EST (UTC-5)</option>
                  <option value="pst">PST (UTC-8)</option>
                  <option value="gmt">GMT (UTC+0)</option>
                  <option value="cet">CET (UTC+1)</option>
                </select>
              </div>
            </div>
          </section>

          <div class="flex items-center justify-between">
            <button
              @click="convert"
              :disabled="!canConvert"
              class="flex-1 px-5 py-2 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-exchange-alt mr-2"></i>
              Convert
            </button>
            <button
              @click="clear"
              class="ml-3 px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
            >
              Reset
            </button>
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </div>

        <div class="lg:col-span-8 space-y-5">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm min-h-[18rem]">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Converted Values</h3>
                <p class="text-xs text-slate-500">
                  Comprehensive breakdown of the parsed timestamp across formats.
                </p>
              </div>
              <div class="flex items-center space-x-3 text-xs text-slate-400">
                <span v-if="convertedAt">Updated {{ convertedAt }}</span>
                <div class="flex items-center space-x-1">
                  <i class="fas fa-stopwatch"></i>
                  <span v-if="executionTime">{{ executionTime }} ms</span>
                </div>
              </div>
            </header>
            <div class="relative px-5 py-6">
              <div v-if="loading" class="absolute inset-0 bg-white/70 flex items-center justify-center">
                <i class="fas fa-spinner fa-spin text-blue-600 text-xl"></i>
              </div>

              <template v-if="resultCards.length">
                <div class="grid gap-4 md:grid-cols-2">
                  <div
                    v-for="card in resultCards"
                    :key="card.key"
                    class="border border-slate-200 rounded-lg p-4 bg-slate-50/70 hover:bg-white transition shadow-sm"
                  >
                    <div class="flex items-start justify-between">
                      <div>
                        <p class="text-xs uppercase tracking-wide text-slate-500 font-semibold">{{ card.label }}</p>
                        <p class="mt-2 text-sm text-slate-700 font-mono break-all">{{ card.value }}</p>
                      </div>
                      <i :class="card.icon + ' text-slate-400 text-lg'" aria-hidden="true"></i>
                    </div>
                    <p v-if="card.helper" class="mt-3 text-xs text-slate-400">{{ card.helper }}</p>
                  </div>
                </div>
              </template>

              <p v-else class="text-sm text-slate-400">Run a conversion to see formatted results.</p>
            </div>
          </section>

          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Raw Response</h3>
                <p class="text-xs text-slate-500">Inspect or copy the API payload for debugging.</p>
              </div>
              <button
                @click="copyJson"
                :disabled="!results"
                class="text-xs px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <i class="fas fa-copy mr-1"></i>
                Copy JSON
              </button>
            </header>
            <div class="px-5 py-4">
              <pre class="bg-slate-900 text-emerald-300 rounded-lg p-4 text-xs max-h-64 overflow-auto">{{ formattedJson }}</pre>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-500">
      <span>Endpoint: <code class="text-slate-700">/converter/datetime</code></span>
      <span v-if="results">Timezone applied: {{ timezone.toUpperCase() }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
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

const inputValue = ref('');
const inputFormat = ref<'auto' | 'iso' | 'unix' | 'unix_ms' | 'rfc2822' | 'custom'>('auto');
const outputFormat = ref<'all' | 'iso' | 'timestamp' | 'unix' | 'utc' | 'locale' | 'relative' | 'custom'>('all');
const timezone = ref<'utc' | 'local' | 'est' | 'pst' | 'gmt' | 'cet'>('utc');
const customInputFormat = ref('');
const customOutputFormat = ref('');
const results = ref<Record<string, any> | null>(null);
const executionTime = ref<number | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);
const convertedAt = ref<string | null>(null);

const requiresCustomInput = computed(() => inputFormat.value === 'custom');
const requiresCustomOutput = computed(() => outputFormat.value === 'custom');

const canConvert = computed(() => {
  if (loading.value) return false;
  if (!inputValue.value.trim()) return false;
  if (requiresCustomInput.value && !customInputFormat.value.trim()) return false;
  if (requiresCustomOutput.value && !customOutputFormat.value.trim()) return false;
  return true;
});

const setFromNow = () => {
  const now = new Date();
  inputValue.value = now.toISOString();
  inputFormat.value = 'iso';
};

const setFromUnix = () => {
  const seconds = Math.floor(Date.now() / 1000);
  inputValue.value = String(seconds);
  inputFormat.value = 'unix';
};

const convert = async () => {
  if (!canConvert.value) return;

  loading.value = true;
  error.value = null;
  executionTime.value = null;
  results.value = null;

  const start = performance.now();

  try {
    const payload: {
      input: string;
      inputFormat?: string;
      outputFormat?: string;
      timezone?: string;
      customFormat?: string;
      customInputFormat?: string;
    } = {
      input: inputValue.value.trim()
    };

    if (inputFormat.value !== 'auto') {
      payload.inputFormat = inputFormat.value;
      if (inputFormat.value === 'custom' && customInputFormat.value.trim()) {
        payload.customInputFormat = customInputFormat.value.trim();
      }
    }

    if (outputFormat.value !== 'all') {
      payload.outputFormat = outputFormat.value;
      if (outputFormat.value === 'custom' && customOutputFormat.value.trim()) {
        payload.customFormat = customOutputFormat.value.trim();
      }
    }

    if (timezone.value) {
      payload.timezone = timezone.value;
    }

    const response = await props.api.convertDateTime(payload);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data) {
      results.value = response.data;
      convertedAt.value = new Date().toLocaleString();
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Conversion failed');
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    error.value = err?.message || 'DateTime service unavailable';
  } finally {
    loading.value = false;
  }
};

const clear = () => {
  inputValue.value = '';
  results.value = null;
  executionTime.value = null;
  error.value = null;
  customInputFormat.value = '';
  customOutputFormat.value = '';
  convertedAt.value = null;
  inputFormat.value = 'auto';
  outputFormat.value = 'all';
  timezone.value = 'utc';
};

const copyJson = async () => {
  if (!results.value) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(results.value, null, 2));
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const standardFields = [
  {
    key: 'iso',
    label: 'ISO 8601',
    icon: 'fas fa-globe',
    helper: 'Machine-friendly UTC timestamp.'
  },
  {
    key: 'timestamp',
    label: 'Unix (seconds)',
    icon: 'fas fa-hourglass-half',
    helper: 'Seconds since 1 Jan 1970.'
  },
  {
    key: 'unix',
    label: 'Unix (milliseconds)',
    icon: 'fas fa-stopwatch',
    helper: 'Milliseconds since 1 Jan 1970.'
  },
  {
    key: 'utc',
    label: 'UTC String',
    icon: 'fas fa-globe-americas',
    helper: 'Coordinated Universal Time representation.'
  },
  {
    key: 'locale',
    label: 'Locale',
    icon: 'fas fa-map-marker-alt',
    helper: 'Localized string respecting chosen timezone.'
  },
  {
    key: 'relative',
    label: 'Relative',
    icon: 'fas fa-history',
    helper: 'Friendly time delta from now.'
  },
  {
    key: 'formatted',
    label: 'Custom Format',
    icon: 'fas fa-calendar-check',
    helper: 'Pattern-based output when supplied.'
  }
];

const resultCards = computed(() => {
  if (!results.value) return [] as Array<{ key: string; label: string; icon: string; value: string; helper?: string }>;
  const cards = standardFields
    .filter((field) => results.value && results.value[field.key] !== undefined && results.value[field.key] !== null)
    .map((field) => ({
      ...field,
      value: String(results.value![field.key])
    }));

  const knownKeys = new Set(standardFields.map((field) => field.key));
  Object.entries(results.value).forEach(([key, value]) => {
    if (!knownKeys.has(key)) {
      cards.push({
        key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        icon: 'fas fa-info-circle',
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        helper: undefined
      });
    }
  });

  return cards;
});

const formattedJson = computed(() => {
  if (!results.value) return '{\n  // Run the converter to view the API response\n}';
  try {
    return JSON.stringify(results.value, null, 2);
  } catch (err) {
    return String(results.value);
  }
});
</script>
