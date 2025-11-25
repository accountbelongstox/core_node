<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-700 to-slate-800">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fas fa-shield-alt text-green-400"></i>
            <h2 class="text-2xl font-semibold text-white">Chmod Calculator</h2>
          </div>
          <p class="text-sm text-slate-300">Calculate Linux file permissions</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Permission Matrix -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Permissions</h3>
          
          <div class="bg-slate-50 rounded-xl p-4">
            <table class="w-full">
              <thead>
                <tr class="text-xs text-slate-500">
                  <th class="text-left py-2">Entity</th>
                  <th class="text-center py-2">Read (4)</th>
                  <th class="text-center py-2">Write (2)</th>
                  <th class="text-center py-2">Execute (1)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entity, idx) in entities" :key="entity.name" class="border-t border-slate-200">
                  <td class="py-3 font-medium text-slate-700">{{ entity.label }}</td>
                  <td class="text-center py-3">
                    <input type="checkbox" v-model="permissions[idx].read" @change="calculate"
                      class="w-5 h-5 rounded text-green-600 cursor-pointer" />
                  </td>
                  <td class="text-center py-3">
                    <input type="checkbox" v-model="permissions[idx].write" @change="calculate"
                      class="w-5 h-5 rounded text-green-600 cursor-pointer" />
                  </td>
                  <td class="text-center py-3">
                    <input type="checkbox" v-model="permissions[idx].execute" @change="calculate"
                      class="w-5 h-5 rounded text-green-600 cursor-pointer" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Quick Presets -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Common Presets</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="preset in presets" :key="preset.value" @click="applyPreset(preset.value)"
                class="px-3 py-2 bg-slate-100 hover:bg-green-100 rounded-lg text-sm transition text-center">
                <div class="font-mono font-bold">{{ preset.value }}</div>
                <div class="text-xs text-slate-500">{{ preset.desc }}</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-700">Result</h3>

          <!-- Numeric Mode -->
          <div class="bg-slate-900 rounded-xl p-6 text-center">
            <div class="text-sm text-green-400 mb-2">Numeric Mode</div>
            <div class="text-5xl font-mono font-bold text-white">{{ numericMode }}</div>
          </div>

          <!-- Symbolic Mode -->
          <div class="bg-slate-100 rounded-xl p-4">
            <div class="text-sm text-slate-500 mb-2">Symbolic Mode</div>
            <div class="font-mono text-2xl text-slate-800 text-center">{{ symbolicMode }}</div>
          </div>

          <!-- Command Examples -->
          <div class="bg-slate-50 rounded-lg p-4 space-y-3">
            <div class="text-sm text-slate-500">Command Examples</div>
            
            <div class="bg-slate-900 rounded p-3 font-mono text-sm text-green-400 flex items-center justify-between">
              <span>chmod {{ numericMode }} filename</span>
              <button @click="copy(`chmod ${numericMode} filename`)" class="text-slate-400 hover:text-white">
                <i class="fas fa-copy"></i>
              </button>
            </div>
            
            <div class="bg-slate-900 rounded p-3 font-mono text-sm text-green-400 flex items-center justify-between">
              <span>chmod -R {{ numericMode }} directory/</span>
              <button @click="copy(`chmod -R ${numericMode} directory/`)" class="text-slate-400 hover:text-white">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>

          <!-- Permission Breakdown -->
          <div class="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div v-for="(entity, idx) in entities" :key="entity.name" class="flex justify-between">
              <span class="text-slate-600">{{ entity.label }}</span>
              <span class="font-mono">
                {{ permissions[idx].read ? 'r' : '-' }}{{ permissions[idx].write ? 'w' : '-' }}{{ permissions[idx].execute ? 'x' : '-' }}
                ({{ getPermValue(idx) }})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

interface Permission {
  read: boolean;
  write: boolean;
  execute: boolean;
}

const entities = [
  { name: 'owner', label: 'Owner' },
  { name: 'group', label: 'Group' },
  { name: 'others', label: 'Others' }
];

const permissions = ref<Permission[]>([
  { read: true, write: true, execute: true },
  { read: true, write: false, execute: true },
  { read: true, write: false, execute: true }
]);

const presets = [
  { value: '777', desc: 'Full access' },
  { value: '755', desc: 'Standard' },
  { value: '644', desc: 'Files' },
  { value: '600', desc: 'Private' },
  { value: '700', desc: 'Private exec' },
  { value: '664', desc: 'Group write' }
];

const getPermValue = (idx: number): number => {
  const p = permissions.value[idx];
  return (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0);
};

const numericMode = computed(() => {
  return permissions.value.map((_, idx) => getPermValue(idx)).join('');
});

const symbolicMode = computed(() => {
  const type = '-'; // regular file
  const perms = permissions.value.map(p => 
    (p.read ? 'r' : '-') + (p.write ? 'w' : '-') + (p.execute ? 'x' : '-')
  ).join('');
  return type + perms;
});

const applyPreset = (value: string) => {
  const digits = value.split('').map(Number);
  digits.forEach((d, idx) => {
    permissions.value[idx] = {
      read: (d & 4) > 0,
      write: (d & 2) > 0,
      execute: (d & 1) > 0
    };
  });
};

const calculate = () => {
  // Reactivity handles this automatically
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
};
</script>

