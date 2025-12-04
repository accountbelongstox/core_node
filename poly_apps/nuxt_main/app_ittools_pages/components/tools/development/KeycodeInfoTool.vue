<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-violet-500 to-purple-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-keyboard text-white"></i>
            <h2 class="text-2xl font-semibold text-white">Keycode Info</h2>
          </div>
          <p class="text-sm text-violet-100">Press any key to see its code</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-violet-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <!-- Key Display -->
      <div 
        ref="keyArea"
        tabindex="0"
        @keydown="handleKeyDown"
        class="bg-slate-900 rounded-xl p-8 text-center cursor-pointer focus:ring-4 focus:ring-violet-500 focus:outline-none"
      >
        <div v-if="!lastKey" class="text-slate-400">
          <i class="fas fa-keyboard text-6xl mb-4"></i>
          <p class="text-lg">Click here and press any key</p>
        </div>
        <div v-else>
          <div class="text-7xl font-bold text-white mb-4">{{ displayKey }}</div>
          <div class="text-violet-400 text-lg">{{ lastKey.code }}</div>
        </div>
      </div>

      <!-- Key Details -->
      <div v-if="lastKey" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">event.key</div>
          <div class="font-mono text-xl text-violet-600">{{ lastKey.key }}</div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">event.code</div>
          <div class="font-mono text-xl text-violet-600">{{ lastKey.code }}</div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">event.keyCode (deprecated)</div>
          <div class="font-mono text-xl text-violet-600">{{ lastKey.keyCode }}</div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">event.which (deprecated)</div>
          <div class="font-mono text-xl text-violet-600">{{ lastKey.which }}</div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">event.location</div>
          <div class="font-mono text-xl text-violet-600">{{ getLocationName(lastKey.location) }}</div>
        </div>
        <div class="bg-slate-50 rounded-lg p-4">
          <div class="text-xs text-slate-500 mb-1">Modifiers</div>
          <div class="flex flex-wrap gap-1">
            <span v-if="lastKey.ctrlKey" class="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs">Ctrl</span>
            <span v-if="lastKey.shiftKey" class="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs">Shift</span>
            <span v-if="lastKey.altKey" class="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs">Alt</span>
            <span v-if="lastKey.metaKey" class="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs">Meta</span>
            <span v-if="!lastKey.ctrlKey && !lastKey.shiftKey && !lastKey.altKey && !lastKey.metaKey" 
              class="text-slate-400 text-sm">None</span>
          </div>
        </div>
      </div>

      <!-- Code Snippets -->
      <div v-if="lastKey" class="space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">Code Snippets</h3>
        
        <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm">
          <div class="text-slate-400 mb-2">// Modern approach (recommended)</div>
          <div class="text-green-400">if (event.key === '{{ lastKey.key }}') { ... }</div>
        </div>
        
        <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm">
          <div class="text-slate-400 mb-2">// Using code</div>
          <div class="text-green-400">if (event.code === '{{ lastKey.code }}') { ... }</div>
        </div>
        
        <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm">
          <div class="text-slate-400 mb-2">// Legacy (deprecated)</div>
          <div class="text-yellow-400">if (event.keyCode === {{ lastKey.keyCode }}) { ... }</div>
        </div>
      </div>

      <!-- History -->
      <div v-if="history.length > 0" class="space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">Recent Keys</h3>
        <div class="flex flex-wrap gap-2">
          <div v-for="(key, idx) in history" :key="idx" 
            class="px-3 py-2 bg-slate-100 rounded-lg text-sm font-mono cursor-pointer hover:bg-violet-100"
            @click="lastKey = key">
            {{ key.key === ' ' ? 'Space' : key.key }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

interface KeyInfo {
  key: string;
  code: string;
  keyCode: number;
  which: number;
  location: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

const keyArea = ref<HTMLElement>();
const lastKey = ref<KeyInfo | null>(null);
const history = ref<KeyInfo[]>([]);

const displayKey = computed(() => {
  if (!lastKey.value) return '';
  const key = lastKey.value.key;
  if (key === ' ') return 'Space';
  if (key === 'Enter') return 'Enter';
  if (key === 'Tab') return 'Tab';
  if (key === 'Escape') return 'Esc';
  if (key === 'Backspace') return 'Backspace';
  if (key === 'Delete') return 'Del';
  return key.length === 1 ? key.toUpperCase() : key;
});

const handleKeyDown = (e: KeyboardEvent) => {
  e.preventDefault();
  
  const keyInfo: KeyInfo = {
    key: e.key,
    code: e.code,
    keyCode: e.keyCode,
    which: e.which,
    location: e.location,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey
  };
  
  lastKey.value = keyInfo;
  
  // Add to history (avoid duplicates)
  if (!history.value.some(k => k.code === keyInfo.code)) {
    history.value = [keyInfo, ...history.value].slice(0, 10);
  }
};

const getLocationName = (location: number): string => {
  const locations: Record<number, string> = {
    0: 'Standard',
    1: 'Left',
    2: 'Right',
    3: 'Numpad'
  };
  return locations[location] || 'Unknown';
};

onMounted(() => {
  keyArea.value?.focus();
});
</script>

