<template>
  <component
    v-if="tool && SpecializedComponent"
    :is="SpecializedComponent"
    :tool="tool"
    :api="api"
    @close="emit('close')"
    @executed="handleExternalExecuted"
  />
  <div v-else-if="tool" class="tool-panel">
    <!-- Tool Header -->
    <div class="panel-header">
      <div class="header-info">
        <h2>{{ tool.name }}</h2>
        <p>{{ tool.description }}</p>
      </div>
      <div class="header-actions">
        <span class="category-tag">
          <i :class="getCategoryIcon(tool.category)"></i>
          {{ tool.category }}
        </span>
        <button @click="$emit('close')" class="close-btn" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <!-- Tool Body -->
    <div class="panel-body glass-scroll">
      <!-- Input Section -->
      <div class="input-section">
        <h3 class="section-title">
          <i class="fas fa-edit"></i>
          <span>Input</span>
        </h3>
        <div class="form-wrapper">
          <UniversalToolForm
            :tool-id="tool.id"
            :params="toolParams"
            v-model="parameters"
          />
        </div>
      </div>

      <!-- Output Section -->
      <div v-if="result && !error" class="output-section">
        <h3 class="section-title success">
          <i class="fas fa-check-circle"></i>
          <span>Output</span>
        </h3>
        <div class="result-card">
          <div class="result-header">
            <div class="result-meta">
              <span class="meta-label">Result</span>
              <span class="execution-time">
                <i class="fas fa-clock"></i>
                {{ executionTime }}ms
              </span>
            </div>
            <button @click="copyToClipboard" class="copy-btn">
              <i :class="['fas', copied ? 'fa-check' : 'fa-copy']"></i>
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <pre class="result-content">{{ formatResult(result) }}</pre>
        </div>
      </div>

      <!-- Error Section -->
      <div v-if="error" class="error-section">
        <div class="error-card">
          <div class="error-header">
            <i class="fas fa-exclamation-circle"></i>
            <h4>Error</h4>
          </div>
          <p class="error-message">{{ error }}</p>
          <button @click="error = null" class="dismiss-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isExecuting" class="loading-section">
        <div class="loading-card">
          <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
          <div class="loading-text">
            <h4>Processing...</h4>
            <p>Executing {{ tool.name }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="panel-footer">
      <div class="footer-info">
        <i class="fas fa-info-circle"></i>
        <span>{{ tool.method?.toUpperCase() || 'POST' }} {{ tool.endpoint || `/tools/${tool.id}` }}</span>
      </div>
      <div class="footer-actions">
        <button
          v-if="result && !isExecuting"
          @click="reset"
          class="btn-secondary"
        >
          <i class="fas fa-redo"></i>
          Reset
        </button>
        <button
          @click="handleExecute"
          :disabled="isExecuting || !canExecute"
          class="btn-primary"
        >
          <i :class="['fas', isExecuting ? 'fa-spinner fa-spin' : 'fa-play']"></i>
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

const toolParams = computed(() => {
  if (!props.tool) return [];
  return TOOL_PARAMS[props.tool.id] || [];
});

watch(() => props.tool, (newTool) => {
  if (newTool) reset();
});

const canExecute = computed(() => {
  if (!props.tool || !toolParams.value) return true;
  for (const param of toolParams.value) {
    if (param.required) {
      const value = parameters.value[param.name];
      if (value === undefined || value === null || value === '') return false;
    }
  }
  return true;
});

const getCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    crypto: 'fas fa-lock', converter: 'fas fa-exchange-alt', web: 'fas fa-globe',
    text: 'fas fa-font', math: 'fas fa-calculator', network: 'fas fa-network-wired',
    media: 'fas fa-photo-video', development: 'fas fa-code', measurement: 'fas fa-ruler',
    data: 'fas fa-database'
  };
  return icons[category] || 'fas fa-folder';
};

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
  if (props.tool) appLogger.success(`${props.tool.name} completed`);
};

const copyToClipboard = async () => {
  if (!result.value) return;
  const text = typeof result.value === 'string' ? result.value : JSON.stringify(result.value, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    appLogger.info('Result copied to clipboard');
    setTimeout(() => { copied.value = false; }, 2000);
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

<style scoped>
.tool-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.06) 100%);
  border-bottom: 1px solid rgba(229, 231, 235, 0.5);
}

.header-info h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.header-info p {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.375rem 0 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.category-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #4f46e5;
  text-transform: capitalize;
}

.close-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(107, 114, 128, 0.08);
  border: none;
  border-radius: 10px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem;
}

.section-title i {
  color: #6366f1;
}

.section-title.success i {
  color: #22c55e;
}

.form-wrapper {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 16px;
  padding: 1.25rem;
}

.output-section {
  margin-top: 1.5rem;
}

.result-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 16px;
  overflow: hidden;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: rgba(34, 197, 94, 0.05);
  border-bottom: 1px solid rgba(34, 197, 94, 0.1);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.meta-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.execution-time {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #4f46e5;
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-btn:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.3);
}

.result-content {
  padding: 1.25rem;
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}

.error-section {
  margin-top: 1.5rem;
}

.error-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 16px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #dc2626;
}

.error-header i {
  font-size: 1.25rem;
}

.error-header h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.error-message {
  flex: 1;
  font-size: 0.875rem;
  color: #b91c1c;
  margin: 0;
}

.dismiss-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #dc2626;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dismiss-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.loading-section {
  margin-top: 1.5rem;
}

.loading-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 10px;
  color: white;
  font-size: 1rem;
}

.loading-text h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e40af;
  margin: 0;
}

.loading-text p {
  font-size: 0.8125rem;
  color: #3b82f6;
  margin: 0.25rem 0 0;
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: rgba(249, 250, 251, 0.8);
  border-top: 1px solid rgba(229, 231, 235, 0.5);
}

.footer-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.footer-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: rgba(107, 114, 128, 0.1);
  border: 1px solid rgba(107, 114, 128, 0.2);
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(107, 114, 128, 0.15);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
