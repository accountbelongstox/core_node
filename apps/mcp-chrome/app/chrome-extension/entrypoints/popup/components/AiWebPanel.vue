<template>
  <div class="space-y-2">
    <!-- Provider + one-click assist -->
    <div class="tk-card rounded-lg p-2.5 border">
      <div class="flex items-center justify-end mb-2">
        <span
          :class="[
            'text-[9px] font-bold px-1.5 py-0.5 rounded',
            running ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-400',
          ]"
        >{{ running ? 'Online' : 'Idle' }}</span>
      </div>

      <div class="flex gap-1.5 mb-2">
        <button
          v-for="p in providers"
          :key="p"
          @click="selectProvider(p)"
          :class="[
            'flex-1 px-2 py-1 rounded text-[9px] font-bold border transition-all',
            provider === p
              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
              : 'text-slate-400 border-slate-700 hover:bg-slate-800/50',
          ]"
        >{{ p === 'chatgpt' ? 'ChatGPT' : 'Gemini' }}</button>
      </div>

      <div class="flex items-center gap-1.5 mb-2">
        <span class="text-[8px] text-slate-500 uppercase font-bold">{{ getMessage('backendLabel') }}</span>
        <input
          v-model="apiUrl"
          placeholder="http://localhost:9000"
          class="flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-200 font-mono"
        />
      </div>

      <button
        @click="toggleAssist"
        :disabled="busy"
        :class="[
          'w-full px-2 py-1.5 rounded text-[9px] font-bold transition-all',
          running ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white',
          busy && 'opacity-60 cursor-not-allowed',
        ]"
      >{{ busy ? '…' : running ? 'Stop assist' : '一键开启 · Start assist' }}</button>

      <p v-if="stats" class="text-[8px] mt-1.5 text-slate-500 font-mono">
        translated {{ stats.translated }} · failed {{ stats.failed }} · pending {{ stats.pending }} ·
        {{ stats.isOnline ? 'online' : 'offline' }}
      </p>
    </div>

    <!-- Ad-hoc test -->
    <div class="tk-card rounded-lg p-2.5 border">
      <h4 class="text-[9px] font-bold uppercase tracking-tight mb-1.5" style="color: var(--text-muted)">
        Test ({{ provider }})
      </h4>
      <textarea
        v-model="prompt"
        rows="2"
        :placeholder="getMessage('aiWebPromptPlaceholder')"
        class="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-200 resize-none mb-1.5"
      ></textarea>
      <div class="flex items-center gap-2 mb-1.5">
        <label class="flex items-center gap-1 text-[9px] text-slate-400 cursor-pointer">
          <input type="checkbox" v-model="withAudio" /> with audio
        </label>
        <button
          @click="runTest"
          :disabled="testing || !prompt.trim()"
          class="ml-auto px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-bold rounded disabled:opacity-50"
        >{{ testing ? 'Testing…' : 'Test' }}</button>
      </div>
      <div
        v-if="testResult"
        class="bg-slate-950 border border-slate-800 rounded p-1.5 text-[9px] text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap"
      >{{ testResult }}</div>
      <p v-if="testError" class="text-[9px] text-rose-400 mt-1">{{ testError }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';

type Provider = 'chatgpt' | 'gemini';
const providers: Provider[] = ['chatgpt', 'gemini'];

const provider = ref<Provider>('chatgpt');
const { apiBaseUrl } = useApiEndpoint();
const apiUrl = ref('');
watch(apiBaseUrl, (url) => {
  if (url) apiUrl.value = url;
}, { immediate: true });
const prompt = ref('');
const withAudio = ref(false);
const running = ref(false);
const busy = ref(false);
const testing = ref(false);
const testResult = ref('');
const testError = ref('');
const stats = ref<any>(null);

const send = (action: string, extra: Record<string, any> = {}): Promise<any> =>
  chrome.runtime.sendMessage({ type: FEATURE_MESSAGE_TYPES.AI_WEB_WORKER, action, ...extra });

const refreshStatus = async () => {
  const r = await send('get_status');
  if (r && r.success) {
    running.value = !!r.isRunning;
    stats.value = r.stats || null;
    if (r.provider) provider.value = r.provider;
  }
};

const selectProvider = async (p: Provider) => {
  provider.value = p;
  await send('set_provider', { provider: p });
};

const toggleAssist = async () => {
  busy.value = true;
  testError.value = '';
  try {
    if (running.value) {
      await send('stop');
    } else {
      const r = await send('start', { apiUrl: apiUrl.value });
      if (!r || !r.success) testError.value = (r && r.error) || 'Start failed';
    }
    await refreshStatus();
  } finally {
    busy.value = false;
  }
};

const runTest = async () => {
  testing.value = true;
  testResult.value = '';
  testError.value = '';
  try {
    const r = await send('test', { provider: provider.value, prompt: prompt.value, withAudio: withAudio.value });
    if (r && r.success) {
      const audio = r.audio ? `\n\n[audio uploaded=${r.audio.uploaded} path=${r.audio.path || '-'}]` : '';
      testResult.value = (r.answer || '(no answer)') + audio;
    } else {
      testError.value = (r && r.error) || 'Test failed';
    }
  } catch (e: any) {
    testError.value = e?.message || 'Error';
  } finally {
    testing.value = false;
  }
};

onMounted(async () => {
  const p = await send('get_provider');
  if (p && p.success && p.provider) provider.value = p.provider;
  await refreshStatus();
});
</script>
