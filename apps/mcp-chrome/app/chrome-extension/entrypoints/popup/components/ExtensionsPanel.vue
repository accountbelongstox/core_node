<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-gray-800">Extensions</h2>
      <div class="flex gap-2">
        <button class="px-4 py-2 bg-gray-100 text-gray-700 font-mono text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors" @click="toggleExpandAll">
          {{ allExpanded ? '[COLLAPSE ALL]' : '[EXPAND ALL]' }}
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <div
        v-for="extension in extensions"
        :key="extension.id"
        class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
      >
        <div class="flex items-start justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors" @click="toggleExtension(extension.id)">
          <div class="flex-1 space-y-1">
            <h3 class="text-base font-semibold text-gray-800">{{ extension.name }}</h3>
            <p class="text-sm text-gray-600">{{ extension.description }}</p>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span v-if="extension.status === 'active'" class="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">ACTIVE</span>
            <span v-else-if="extension.status === 'todo'" class="px-2.5 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full">TODO</span>
            <span v-else class="px-2.5 py-1 bg-gray-200 text-gray-600 text-xs font-bold rounded-full">INACTIVE</span>
            <span class="text-lg font-mono text-gray-500">{{ expandedExtensions.includes(extension.id) ? '[-]' : '[+]' }}</span>
          </div>
        </div>

        <div v-if="expandedExtensions.includes(extension.id)" class="p-5 pt-0 border-t border-gray-100">
          <component :is="extension.component" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import ApiSettings from './ApiSettings.vue';
import BingDictionary from './extensions/BingDictionary.vue';
import DeepseekChat from './extensions/DeepseekChat.vue';
import LocalTaskQueue from './extensions/LocalTaskQueue.vue';

interface Extension {
  id: string;
  name: string;
  description: string;
  component: any;
  status: 'active' | 'todo' | 'inactive';
}

const extensions: Extension[] = [
  {
    id: 'api-settings',
    name: 'API Settings',
    description: 'Configure API endpoints for extensions',
    component: ApiSettings,
    status: 'active',
  },
  {
    id: 'local-task-queue',
    name: 'Local Task Queue',
    description: 'Unified task queue for all extensions (serial processing)',
    component: LocalTaskQueue,
    status: 'active',
  },
  {
    id: 'bing-dictionary',
    name: 'Bing Dictionary',
    description: 'Look up word definitions and translations',
    component: BingDictionary,
    status: 'active',
  },
  {
    id: 'deepseek-chat',
    name: 'Deepseek Chat',
    description: 'AI-powered chat assistant (Coming Soon)',
    component: DeepseekChat,
    status: 'todo',
  },
];

const expandedExtensions = ref<string[]>([]);
const allExpanded = ref(false);

const toggleExtension = (id: string) => {
  const index = expandedExtensions.value.indexOf(id);

  if (index > -1) {
    expandedExtensions.value.splice(index, 1);
  } else {
    expandedExtensions.value.push(id);
  }

  updateExpandAllState();
};

const toggleExpandAll = () => {
  if (allExpanded.value) {
    expandedExtensions.value = [];
    allExpanded.value = false;
  } else {
    expandedExtensions.value = extensions.map(ext => ext.id);
    allExpanded.value = true;
  }
};

const updateExpandAllState = () => {
  allExpanded.value = expandedExtensions.value.length === extensions.length;
};
</script>

