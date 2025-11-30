<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-emerald-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-list text-emerald-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Converter</span>
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
            <label class="block text-sm font-medium text-slate-700 mb-2">List input</label>
            <textarea
              v-model="listInput"
              rows="4"
              class="w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              placeholder="apple, banana, orange"
            ></textarea>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Input format</label>
              <select
                v-model="from"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="comma">Comma separated</option>
                <option value="newline">New line</option>
                <option value="space">Space separated</option>
                <option value="semicolon">Semicolon</option>
                <option value="pipe">Pipe</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-2">Highlight format</label>
              <select
                v-model="highlight"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="comma">Comma separated</option>
                <option value="newline">New line</option>
                <option value="space">Space separated</option>
                <option value="semicolon">Semicolon</option>
                <option value="pipe">Pipe</option>
              </select>
            </div>
          </div>
        </div>

        <div class="lg:col-span-3 space-y-4">
          <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
            <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-700">Converted lists</h3>
                <p class="text-xs text-slate-500">All formats generated from the provided list.</p>
              </div>
              <div class="flex items-center space-x-2 text-xs text-slate-400">
                <i class="fas fa-stopwatch"></i>
                <span v-if="executionTime">{{ executionTime }} ms</span>
              </div>
            </header>
            <div class="px-5 py-4">
              <div class="grid sm:grid-cols-2 gap-3">
                <ListRow label="Comma" :value="result?.comma" :highlight="highlight === 'comma'" />
                <ListRow label="New line" :value="result?.newline" :highlight="highlight === 'newline'" />
                <ListRow label="Space" :value="result?.space" :highlight="highlight === 'space'" />
                <ListRow label="Semicolon" :value="result?.semicolon" :highlight="highlight === 'semicolon'" />
                <ListRow label="Pipe" :value="result?.pipe" :highlight="highlight === 'pipe'" />
              </div>
              <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
      <button
        @click="convert"
        :disabled="listInput.trim().length === 0 || loading"
        class="px-5 py-2 rounded-lg bg-emerald-500 text-white font-medium shadow hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
        <i v-else class="fas fa-sync-alt mr-2"></i>
        Convert list
      </button>
      <span class="text-xs text-slate-500">Endpoint: <code class="text-slate-700">/converter/list</code></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, onMounted, ref, h } from 'vue';
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

const listInput = ref('apple, banana, orange');
const from = ref<'comma' | 'newline' | 'space' | 'semicolon' | 'pipe'>('comma');
const highlight = ref<'comma' | 'newline' | 'space' | 'semicolon' | 'pipe'>('comma');
const result = ref<Record<string, string> | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

const convert = async () => {
  if (!listInput.value.trim() || loading.value) return;
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.convertList(listInput.value, from.value, highlight.value);
    executionTime.value = Math.round(performance.now() - start);
    if (response.success && response.data) {
      result.value = response.data;
      emit('executed', response.data);
    } else {
      result.value = null;
      error.value = response.error || response.message || 'Conversion failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    result.value = null;
    error.value = err?.message || 'List converter unavailable';
  } finally {
    loading.value = false;
  }
};

const ListRow = defineComponent({
  name: 'ListRow',
  props: {
    label: { type: String, required: true },
    value: { type: String, default: '' },
    highlight: { type: Boolean, default: false }
  },
  setup(props) {
    const classes = computed(() => [
      'border',
      'rounded-lg',
      'p-3',
      'flex',
      'items-center',
      'justify-between',
      props.highlight ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'
    ]);

    const copyValue = async () => {
      if (!props.value) return;
      try {
        await navigator.clipboard.writeText(props.value);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    };

    return () => h('div', { class: classes.value }, [
      h('div', { class: 'flex-1 mr-3' }, [
        h('span', { class: 'text-xs text-slate-500' }, props.label),
        h('p', { class: 'font-mono text-sm text-slate-700 break-all mt-1' }, props.value || '—')
      ]),
      h('button', {
        class: 'text-xs text-emerald-500 hover:text-emerald-600',
        disabled: !props.value,
        onClick: copyValue
      }, [
        h('i', { class: 'fas fa-copy' })
      ])
    ]);
  }
});

onMounted(() => {
  convert();
});

</script>
