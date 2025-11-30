<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-violet-50 to-purple-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-fingerprint text-violet-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-violet-100 text-violet-700">Crypto</span>
          <button
            @click="$emit('close')"
            class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/80 transition"
            title="Close"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-5">
        <div class="lg:col-span-2 space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Number of UUIDs</label>
            <input
              v-model.number="count"
              type="number"
              min="1"
              max="100"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
            <p class="mt-1 text-xs text-slate-400">Generate between 1 and 100 UUIDs per request.</p>
          </div>

          <div class="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <input
              id="uuid-uppercase"
              v-model="uppercase"
              type="checkbox"
              class="h-4 w-4 text-violet-600 focus:ring-violet-500 border-slate-300 rounded"
            />
            <label for="uuid-uppercase" class="ml-3 text-sm text-slate-700">Output uppercase UUIDs</label>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">UUID version</label>
            <select
              v-model.number="version"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-xl shadow-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            >
              <option :value="4">Version 4 (Random)</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Currently only v4 UUIDs are supported.</p>
          </div>
        </div>

        <div class="lg:col-span-3">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-700">Generated UUIDs</h3>
            <div class="flex items-center space-x-2 text-xs text-slate-400">
              <i class="fas fa-stopwatch"></i>
              <span v-if="executionTime">{{ executionTime }} ms</span>
            </div>
          </div>

          <div class="border border-slate-200 rounded-xl bg-white shadow-sm min-h-[220px] flex flex-col">
            <div v-if="uuids.length === 0 && !loading" class="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
              <i class="fas fa-fingerprint text-2xl mb-2"></i>
              Generate UUIDs to display them here.
            </div>

            <div v-else class="flex-1 overflow-y-auto divide-y divide-slate-100">
              <div
                v-for="uuid in uuids"
                :key="uuid"
                class="flex items-center justify-between px-4 py-2.5 group"
              >
                <span class="font-mono text-sm text-slate-700 break-all">{{ uuid }}</span>
                <button
                  class="opacity-0 group-hover:opacity-100 transition text-violet-600 hover:text-violet-700"
                  @click="copySingle(uuid)"
                  title="Copy UUID"
                >
                  <i class="fas fa-copy"></i>
                </button>
              </div>
            </div>

            <div v-if="loading" class="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <i class="fas fa-spinner fa-spin text-violet-600 text-xl"></i>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <p class="text-xs text-slate-500">Request produces RFC-4122 compliant UUID v{{ version }} strings.</p>
            <div class="space-x-2">
              <button
                @click="copyAll"
                :disabled="uuids.length === 0"
                class="px-3 py-2 rounded-lg border border-violet-200 text-violet-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Copy all
              </button>
              <button
                @click="generate"
                :disabled="loading"
                class="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium shadow hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                <i v-if="loading" class="fas fa-spinner fa-spin mr-2"></i>
                <i v-else class="fas fa-bolt mr-2"></i>
                Generate UUIDs
              </button>
            </div>
          </div>

          <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
        </div>
      </div>
    </div>

    <div class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
      <span>Endpoint: <code class="text-slate-700">/crypto/uuid/generate</code></span>
      <span>{{ uuids.length }} UUIDs in current batch</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Tool } from '../../../types';
import { ItToolsMainAPI } from '../../../services/ittools-main-api';

const props = defineProps<{
  tool: Tool;
  api: ItToolsMainAPI;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const count = ref(10);
const uppercase = ref(false);
const version = ref(4);
const uuids = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const executionTime = ref<number | null>(null);

watch(count, (value) => {
  if (value < 1) count.value = 1;
  if (value > 100) count.value = 100;
});

const generate = async () => {
  loading.value = true;
  error.value = null;
  executionTime.value = null;

  const start = performance.now();

  try {
    const response = await props.api.generateUUID(count.value, uppercase.value, version.value);
    executionTime.value = Math.round(performance.now() - start);

    if (response.success && response.data?.uuids) {
      uuids.value = response.data.uuids;
      emit('executed', response.data);
    } else {
      uuids.value = [];
      error.value = response.error || response.message || 'UUID generation failed';
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - start);
    uuids.value = [];
    error.value = err?.message || 'Unable to generate UUIDs right now';
  } finally {
    loading.value = false;
  }
};

const copySingle = async (uuid: string) => {
  try {
    await navigator.clipboard.writeText(uuid);
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

const copyAll = async () => {
  if (uuids.value.length === 0) return;
  try {
    await navigator.clipboard.writeText(uuids.value.join('\n'));
  } catch (err) {
    console.error('Copy failed:', err);
  }
};

</script>
