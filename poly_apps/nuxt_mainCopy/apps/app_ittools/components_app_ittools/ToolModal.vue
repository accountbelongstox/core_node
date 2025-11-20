<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">{{ tool.name }}</h2>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6">
        <p class="text-gray-600 mb-4">{{ tool.description }}</p>

        <!-- Tool Parameters -->
        <div v-if="tool.parameters && tool.parameters.length > 0" class="space-y-4">
          <h3 class="text-lg font-medium text-gray-900">Parameters</h3>
          <div
            v-for="param in tool.parameters"
            :key="param.name"
            class="space-y-2"
          >
            <label class="block text-sm font-medium text-gray-700">
              {{ param.label || param.name }}
              <span v-if="param.required" class="text-red-500">*</span>
            </label>

            <!-- Text Input -->
            <input
              v-if="param.type === 'text' || param.type === 'url'"
              v-model="parameters[param.name]"
              type="text"
              :placeholder="param.placeholder"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <!-- Number Input -->
            <input
              v-else-if="param.type === 'number'"
              v-model.number="parameters[param.name]"
              type="number"
              :placeholder="param.placeholder"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <!-- Textarea -->
            <textarea
              v-else-if="param.type === 'textarea'"
              v-model="parameters[param.name]"
              :placeholder="param.placeholder"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <!-- Select -->
            <select
              v-else-if="param.type === 'select'"
              v-model="parameters[param.name]"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select an option</option>
              <option
                v-for="option in param.options"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- Checkbox -->
            <div v-else-if="param.type === 'checkbox'" class="flex items-center">
              <input
                v-model="parameters[param.name]"
                type="checkbox"
                :id="param.name"
                class="mr-2"
              />
              <label :for="param.name" class="text-sm text-gray-700">
                {{ param.checkboxLabel || param.label }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t bg-gray-50">
        <div class="text-sm text-gray-500">
          <i class="fas fa-info-circle mr-1"></i>
          {{ tool.category }} • {{ tool.method?.toUpperCase() }}
        </div>
        <div class="space-x-3">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition"
          >
            Cancel
          </button>
          <button
            @click="handleExecute"
            :disabled="isExecuting || !isFormValid"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <i v-if="isExecuting" class="fas fa-spinner fa-spin mr-2"></i>
            {{ isExecuting ? 'Executing...' : 'Execute' }}
          </button>
        </div>
      </div>

      <!-- Results -->
      <div v-if="result" class="p-6 border-t">
        <h3 class="text-lg font-medium text-gray-900 mb-3">Results</h3>
        <div class="bg-gray-50 rounded-lg p-4">
          <pre class="text-sm text-gray-800 whitespace-pre-wrap">{{ JSON.stringify(result, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface ToolParameter {
  name: string;
  label?: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'url';
  required?: boolean;
  placeholder?: string;
  default?: any;
  options?: Array<{ value: any; label: string }>;
  checkboxLabel?: string;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  method?: string;
  endpoint: string;
  parameters?: ToolParameter[];
}

const props = defineProps<{
  tool: Tool;
}>();

const emit = defineEmits<{
  close: [];
  execute: [toolId: string, params: Record<string, any>];
}>();

const parameters = ref<Record<string, any>>({});
const result = ref<any>(null);
const isExecuting = ref(false);

// Initialize parameters with default values
if (props.tool.parameters) {
  props.tool.parameters.forEach(param => {
    parameters.value[param.name] = param.default ?? (param.type === 'checkbox' ? false : '');
  });
}

const isFormValid = computed(() => {
  if (!props.tool.parameters) return true;

  return props.tool.parameters.every(param => {
    if (param.required && !parameters.value[param.name]) {
      return false;
    }
    return true;
  });
});

const handleExecute = async () => {
  if (!isFormValid.value) return;

  isExecuting.value = true;
  result.value = null;

  try {
    emit('execute', props.tool.id, parameters.value);
  } finally {
    isExecuting.value = false;
  }
};
</script>