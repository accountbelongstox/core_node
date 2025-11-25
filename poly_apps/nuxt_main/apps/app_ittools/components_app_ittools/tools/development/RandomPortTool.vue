<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-teal-500 to-cyan-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-network-wired text-white"></i>
            <h2 class="text-2xl font-semibold text-white">Random Port Generator</h2>
          </div>
          <p class="text-sm text-teal-100">Generate random available ports</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-teal-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <!-- Options -->
      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-2">Port Range</label>
          <select v-model="portRange" class="w-full px-4 py-2 border border-slate-200 rounded-lg">
            <option value="user">User Ports (1024-49151)</option>
            <option value="dynamic">Dynamic Ports (49152-65535)</option>
            <option value="all">All Ports (1024-65535)</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
        
        <div v-if="portRange === 'custom'" class="col-span-2 grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Min Port</label>
            <input v-model.number="minPort" type="number" min="1" max="65535"
              class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Max Port</label>
            <input v-model.number="maxPort" type="number" min="1" max="65535"
              class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
          </div>
        </div>
        
        <div v-else>
          <label class="block text-sm font-medium text-slate-700 mb-2">Count</label>
          <input v-model.number="count" type="number" min="1" max="20"
            class="w-full px-4 py-2 border border-slate-200 rounded-lg" />
        </div>
      </div>

      <div class="flex items-center space-x-4">
        <label class="flex items-center space-x-2">
          <input v-model="excludeCommon" type="checkbox" class="rounded text-teal-600" />
          <span class="text-sm text-slate-700">Exclude common ports</span>
        </label>
      </div>

      <!-- Generated Ports -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-700">Generated Ports</h3>
          <button @click="generate" class="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition text-sm">
            <i class="fas fa-sync-alt mr-2"></i>Generate
          </button>
        </div>

        <div v-if="ports.length" class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div v-for="port in ports" :key="port" 
            class="bg-slate-50 rounded-lg p-4 flex items-center justify-between hover:bg-teal-50 transition cursor-pointer"
            @click="copy(port)">
            <div>
              <div class="font-mono text-2xl font-bold text-teal-600">{{ port }}</div>
              <div class="text-xs text-slate-500">{{ getPortType(port) }}</div>
            </div>
            <button class="p-2 text-slate-400 hover:text-teal-600">
              <i :class="copied === port ? 'fas fa-check text-green-500' : 'fas fa-copy'"></i>
            </button>
          </div>
        </div>

        <div v-else class="bg-slate-50 rounded-xl p-8 text-center text-slate-400">
          <i class="fas fa-network-wired text-4xl mb-2"></i>
          <p>Click Generate to create random ports</p>
        </div>
      </div>

      <!-- Common Ports Reference -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-slate-700">Common Ports Reference</h3>
        <div class="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
          <div v-for="common in commonPorts" :key="common.port" 
            class="bg-slate-50 rounded-lg p-2 flex items-center space-x-3 text-sm">
            <span class="font-mono font-bold text-slate-800 w-14">{{ common.port }}</span>
            <span class="text-slate-600">{{ common.service }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const portRange = ref('user');
const minPort = ref(1024);
const maxPort = ref(49151);
const count = ref(5);
const excludeCommon = ref(true);
const ports = ref<number[]>([]);
const copied = ref<number | null>(null);

const commonPorts = [
  { port: 22, service: 'SSH' },
  { port: 80, service: 'HTTP' },
  { port: 443, service: 'HTTPS' },
  { port: 3000, service: 'Dev Server' },
  { port: 3306, service: 'MySQL' },
  { port: 5432, service: 'PostgreSQL' },
  { port: 6379, service: 'Redis' },
  { port: 8080, service: 'Alt HTTP' },
  { port: 27017, service: 'MongoDB' },
  { port: 5000, service: 'Flask' },
  { port: 8000, service: 'Django' },
  { port: 9000, service: 'PHP-FPM' }
];

const commonPortNumbers = commonPorts.map(p => p.port);

const getRange = (): [number, number] => {
  switch (portRange.value) {
    case 'user': return [1024, 49151];
    case 'dynamic': return [49152, 65535];
    case 'all': return [1024, 65535];
    case 'custom': return [minPort.value, maxPort.value];
    default: return [1024, 49151];
  }
};

const generate = () => {
  const [min, max] = getRange();
  const result: number[] = [];
  let attempts = 0;
  
  while (result.length < count.value && attempts < 1000) {
    const port = Math.floor(Math.random() * (max - min + 1)) + min;
    
    if (excludeCommon.value && commonPortNumbers.includes(port)) {
      attempts++;
      continue;
    }
    
    if (!result.includes(port)) {
      result.push(port);
    }
    attempts++;
  }
  
  ports.value = result.sort((a, b) => a - b);
};

const getPortType = (port: number): string => {
  if (port < 1024) return 'Well-known';
  if (port < 49152) return 'Registered';
  return 'Dynamic';
};

const copy = async (port: number) => {
  try {
    await navigator.clipboard.writeText(port.toString());
    copied.value = port;
    setTimeout(() => { copied.value = null; }, 1500);
  } catch {}
};

onMounted(generate);
</script>

