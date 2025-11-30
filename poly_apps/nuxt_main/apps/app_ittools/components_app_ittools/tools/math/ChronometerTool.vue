<template>
  <div class="h-full flex flex-col bg-white">
    <header class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-stopwatch text-purple-600"></i>
            <h2 class="text-2xl font-semibold text-slate-900">{{ tool.name }}</h2>
          </div>
          <p class="text-sm text-slate-600">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Math</span>
          <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition" title="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <div class="px-5 py-4 flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">Session</p>
            <p class="text-lg font-semibold text-slate-800">{{ sessionId || 'No active session' }}</p>
          </div>
          <div class="flex items-center space-x-3">
            <button
              @click="start"
              :disabled="loading || !!sessionId"
              class="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium shadow disabled:opacity-60"
            >
              <i v-if="loading && action === 'start'" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-play mr-2"></i>
              Start
            </button>
            <button
              @click="lap"
              :disabled="loading || !sessionId"
              class="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <i v-if="loading && action === 'lap'" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-flag mr-2"></i>
              Lap
            </button>
            <button
              @click="stop"
              :disabled="loading || !sessionId"
              class="px-4 py-2 rounded-lg bg-rose-500 text-white font-medium shadow hover:bg-rose-600 disabled:opacity-60"
            >
              <i v-if="loading && action === 'stop'" class="fas fa-spinner fa-spin mr-2"></i>
              <i v-else class="fas fa-stop mr-2"></i>
              Stop
            </button>
          </div>
        </div>
        <p v-if="error" class="px-5 pb-4 text-sm text-red-600">{{ error }}</p>
      </section>

      <section class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Laps</h3>
            <p class="text-xs text-slate-500">Backend-calculated lap durations.</p>
          </div>
        </header>
        <div class="max-h-72 overflow-y-auto">
          <ul>
            <li v-for="lapEntry in laps" :key="lapEntry.timestamp" class="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-sm">
              <span class="font-semibold text-slate-700">Lap {{ lapEntry.index }}</span>
              <span class="font-mono text-purple-600">{{ lapEntry.duration }} ms</span>
            </li>
          </ul>
          <p v-if="laps.length === 0" class="px-5 py-6 text-sm text-slate-500">Run laps to see results.</p>
        </div>
      </section>

      <section v-if="summary" class="border border-slate-200 rounded-xl bg-white shadow-sm">
        <header class="px-5 py-4 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">Summary</h3>
        </header>
        <div class="grid md:grid-cols-3 gap-4 p-5">
          <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <p class="text-xs uppercase tracking-wide text-slate-500">Elapsed</p>
            <p class="mt-2 text-lg font-semibold text-purple-600">{{ summary.elapsed }} ms</p>
          </article>
          <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <p class="text-xs uppercase tracking-wide text-slate-500">Started</p>
            <p class="mt-2 text-sm font-semibold text-slate-800">{{ summary.startedAt }}</p>
          </article>
          <article class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <p class="text-xs uppercase tracking-wide text-slate-500">Stopped</p>
            <p class="mt-2 text-sm font-semibold text-slate-800">{{ summary.stoppedAt }}</p>
          </article>
        </div>
      </section>
    </div>

    <footer class="px-6 py-4 border-t bg-slate-50 text-xs text-slate-500">
      Endpoints: <code class="text-slate-700">/math/chronometer/start</code>, <code class="text-slate-700">/stop</code>, <code class="text-slate-700">/lap</code>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Tool } from '../../../types_app_ittools';
import { ItToolsMainAPI } from '../../../services_app_ittools/ittools-main-api';

interface LapEntry {
  index: number;
  duration: number;
  timestamp: string;
}

const props = defineProps<{ tool: Tool; api: ItToolsMainAPI }>();
const emit = defineEmits<{ close: []; executed: [result: any] }>();

const sessionId = ref<string | null>(null);
const laps = ref<LapEntry[]>([]);
const summary = ref<Record<string, any> | null>(null);
const loading = ref(false);
const action = ref<'start' | 'lap' | 'stop' | null>(null);
const error = ref<string | null>(null);

const start = async () => {
  loading.value = true;
  action.value = 'start';
  error.value = null;
  try {
    const response = await props.api.startChronometer();
    if (response.success && response.data?.sessionId) {
      sessionId.value = response.data.sessionId;
      laps.value = [];
      summary.value = null;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to start chronometer');
    }
  } catch (err: any) {
    error.value = err?.message || 'Chronometer start failed';
  } finally {
    loading.value = false;
    action.value = null;
  }
};

const lap = async () => {
  if (!sessionId.value) return;
  loading.value = true;
  action.value = 'lap';
  error.value = null;
  try {
    const response = await props.api.lapChronometer(sessionId.value);
    if (response.success && response.data) {
      const lapData = response.data;
      laps.value = [
        ...laps.value,
        {
          index: laps.value.length + 1,
          duration: lapData.duration,
          timestamp: lapData.timestamp || new Date().toISOString()
        }
      ];
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to record lap');
    }
  } catch (err: any) {
    error.value = err?.message || 'Lap failed';
  } finally {
    loading.value = false;
    action.value = null;
  }
};

const stop = async () => {
  if (!sessionId.value) return;
  loading.value = true;
  action.value = 'stop';
  error.value = null;
  try {
    const response = await props.api.stopChronometer(sessionId.value);
    if (response.success && response.data) {
      summary.value = response.data;
      emit('executed', response.data);
    } else {
      throw new Error(response.error || response.message || 'Unable to stop chronometer');
    }
  } catch (err: any) {
    error.value = err?.message || 'Stop failed';
  } finally {
    loading.value = false;
    action.value = null;
    sessionId.value = null;
  }
};
</script>
