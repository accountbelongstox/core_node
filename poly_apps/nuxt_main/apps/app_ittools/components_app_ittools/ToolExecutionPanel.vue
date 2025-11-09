<template>
  <component
    v-if="tool && SpecializedComponent"
    :is="SpecializedComponent"
    :tool="tool"
    :api="api"
    @close="emit('close')"
    @executed="handleExternalExecuted"
  />
  <div v-else-if="tool" class="h-full flex flex-col bg-white">
    <!-- Tool Header -->
    <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">{{ tool.name }}</h2>
          <p class="text-sm text-gray-600 mt-1">{{ tool.description }}</p>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
            {{ tool.category }}
          </span>
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 transition rounded-lg hover:bg-gray-100"
            title="Close"
          >
            <i class="fas fa-times text-lg"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Tool Body -->
    <div class="flex-1 overflow-y-auto p-6">
      <!-- Input Section -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          <i class="fas fa-edit text-blue-600 mr-2"></i>Input
        </h3>
        <UniversalToolForm
          :tool-id="tool.id"
          :params="toolParams"
          v-model="parameters"
        />
      </div>

      <!-- Output Section -->
      <div v-if="result && !error" class="mt-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          <i class="fas fa-check-circle text-green-600 mr-2"></i>Output
        </h3>
        <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div class="flex justify-between items-start mb-3">
            <div class="flex items-center space-x-3">
              <span class="text-xs font-medium text-gray-500">Result</span>
              <span class="text-xs text-gray-400">
                <i class="fas fa-clock mr-1"></i>
                {{ executionTime }}ms
              </span>
            </div>
            <button
              @click="copyToClipboard"
              class="text-xs text-blue-600 hover:text-blue-800 transition flex items-center"
            >
              <i class="fas fa-copy mr-1"></i>
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <pre class="text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto max-h-96">{{ formatResult(result) }}</pre>
        </div>
      </div>

      <!-- Error Section -->
      <div v-if="error" class="mt-6">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-start">
            <i class="fas fa-exclamation-circle text-red-600 mt-1 mr-3"></i>
            <div class="flex-1">
              <h4 class="text-sm font-semibold text-red-900">Error</h4>
              <p class="text-sm text-red-700 mt-1">{{ error }}</p>
            </div>
            <button
              @click="error = null"
              class="text-red-400 hover:text-red-600 transition"
            >
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isExecuting" class="mt-6">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-center">
            <i class="fas fa-spinner fa-spin text-blue-600 mr-3"></i>
            <div>
              <h4 class="text-sm font-semibold text-blue-900">Processing...</h4>
              <p class="text-sm text-blue-700 mt-1">Executing {{ tool.name }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
      <div class="text-sm text-gray-500">
        <i class="fas fa-info-circle mr-1"></i>
        {{ tool.method?.toUpperCase() }} {{ tool.endpoint }}
      </div>
      <div class="space-x-3">
        <button
          v-if="result && !isExecuting"
          @click="reset"
          class="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition font-medium"
        >
          <i class="fas fa-redo mr-2"></i>Reset
        </button>
        <button
          @click="handleExecute"
          :disabled="isExecuting || !canExecute"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shadow-sm hover:shadow"
        >
          <i v-if="isExecuting" class="fas fa-spinner fa-spin mr-2"></i>
          <i v-else class="fas fa-play mr-2"></i>
          {{ isExecuting ? 'Executing...' : 'Execute' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Tool } from '../types_app_ittools';
import { ItToolsMainAPI } from '../services_app_ittools/ittools-main-api';
import { TOOL_PARAMS } from '../config_app_ittools/tool-params';
import UniversalToolForm from './tools/UniversalToolForm.vue';
import { getToolComponent } from './tools/tool-registry';
import { appLogger } from '../services_app_ittools/logger';

const props = defineProps<{
  tool: Tool | null;
}>();

const emit = defineEmits<{
  close: [];
  executed: [result: any];
}>();

const parameters = ref<Record<string, any>>({});
const result = ref<any>(null);
const error = ref<string | null>(null);
const isExecuting = ref(false);
const executionTime = ref<number>(0);
const copied = ref(false);
const api = new ItToolsMainAPI();

const SpecializedComponent = computed(() => {
  if (!props.tool) return null;
  return getToolComponent(props.tool.id);
});

// Get tool parameters from configuration
const toolParams = computed(() => {
  if (!props.tool) return [];
  return TOOL_PARAMS[props.tool.id] || [];
});

// Reset when tool changes
watch(() => props.tool, (newTool) => {
  if (newTool) {
    reset();
  }
});

const canExecute = computed(() => {
  if (!props.tool || !toolParams.value) return true;

  // Check if all required parameters are filled
  for (const param of toolParams.value) {
    if (param.required) {
      const value = parameters.value[param.name];
      if (value === undefined || value === null || value === '') {
        return false;
      }
    }
  }

  return true;
});

const handleExecute = async () => {
  if (!props.tool || isExecuting.value || !canExecute.value) return;

  isExecuting.value = true;
  result.value = null;
  error.value = null;
  copied.value = false;

  const startTime = performance.now();
  appLogger.info(`Executing ${props.tool.name}`);

  try {
    const response = await api.executeTool(
      `/tools/${props.tool.id}/execute`,
      'POST',
      parameters.value
    );

    executionTime.value = Math.round(performance.now() - startTime);

    if (response.success) {
      result.value = response.data;
      emit('executed', response.data);
      appLogger.success(`${props.tool.name} executed successfully`);
    } else {
      error.value = response.error || 'Unknown error occurred';
      appLogger.error(`${props.tool.name} failed: ${error.value}`);
    }
  } catch (err: any) {
    executionTime.value = Math.round(performance.now() - startTime);
    error.value = err.message || 'Failed to execute tool';
    console.error('Tool execution error:', err);
    appLogger.error(`${props.tool?.name || 'Tool'} execution error: ${error.value}`);
  } finally {
    isExecuting.value = false;
  }
};

const reset = () => {
  parameters.value = {};
  result.value = null;
  error.value = null;
  executionTime.value = 0;
  copied.value = false;
};

const handleExternalExecuted = (data: any) => {
  emit('executed', data);
  if (props.tool) {
    appLogger.success(`${props.tool.name} completed`);
  }
};

const copyToClipboard = async () => {
  if (!result.value) return;

  const text = typeof result.value === 'string'
    ? result.value
    : JSON.stringify(result.value, null, 2);

  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    appLogger.info('Result copied to clipboard');
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

const formatResult = (data: any): string => {
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);
  return JSON.stringify(data, null, 2);
};
</script>
