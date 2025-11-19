<template>
  <BasePanel
    v-if="modelValue"
    title="Script Manager"
    size="full"
    color="default"
    :close-on-overlay="false"
    @close="$emit('close')"
  >
    <template #header-actions>
      <button
        class="header-action-btn"
        @click="showHelp = !showHelp"
        title="Help"
      >
        <span>❓</span>
      </button>
    </template>

    <div class="script-manager-container">
      <!-- Left Sidebar: Script List -->
      <div class="script-sidebar">
        <div class="sidebar-header">
          <h3 class="sidebar-title">Scripts</h3>
          <button
            class="icon-btn"
            @click="handleCreateScript"
            title="New Script"
          >
            <span>➕</span>
          </button>
        </div>

        <!-- Search and Filter -->
        <div class="search-section">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search scripts..."
            @input="handleSearch"
          />
        </div>

        <!-- Category Tabs -->
        <div class="category-tabs">
          <button
            v-for="category in scriptStore.categories"
            :key="category.id"
            class="category-tab"
            :class="{ active: selectedCategory === category.id }"
            @click="selectedCategory = category.id"
            :title="category.description"
          >
            <span class="category-icon">{{ category.icon }}</span>
            <span class="category-name">{{ category.name }}</span>
            <span class="category-count">{{ category.scriptCount }}</span>
          </button>
        </div>

        <!-- Script List -->
        <div class="script-list">
          <div
            v-for="script in filteredScripts"
            :key="script.id"
            class="pm-card"
            :class="{
              'pm-card--active': scriptStore.currentScript?.id === script.id,
              'pm-card--selected': scriptStore.selectedScriptIds.includes(script.id)
            }"
            @click="handleSelectScript(script.id)"
            @dblclick="handleEditScript(script.id)"
          >
            <div class="script-item-header">
              <input
                type="checkbox"
                class="script-checkbox"
                :checked="scriptStore.selectedScriptIds.includes(script.id)"
                @click.stop="scriptStore.toggleScriptSelection(script.id)"
              />
              <span class="script-name">{{ script.name }}</span>
              <span class="script-steps-count">{{ script.steps.length }} steps</span>
            </div>
            <div class="script-item-meta">
              <span class="script-category-badge" :style="{ color: getCategoryColor(script.category) }">
                {{ getCategoryIcon(script.category) }} {{ script.category }}
              </span>
              <span class="script-date">{{ formatDate(script.updatedAt) }}</span>
            </div>
            <div v-if="script.tags.length > 0" class="script-tags">
              <span
                v-for="tag in script.tags"
                :key="tag"
                class="script-tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <div v-if="filteredScripts.length === 0" class="empty-state">
            <span class="empty-icon">📝</span>
            <p>No scripts found</p>
            <BaseButton
              size="sm"
              color="primary"
              @click="handleCreateScript"
            >
              Create Script
            </BaseButton>
          </div>
        </div>

        <!-- Sidebar Actions -->
        <div class="sidebar-actions">
          <BaseButton
            size="sm"
            color="primary"
            :disabled="scriptStore.selectedScriptIds.length === 0"
            @click="handleBatchExport"
          >
            Export Selected ({{ scriptStore.selectedScriptIds.length }})
          </BaseButton>
          <BaseButton
            size="sm"
            color="default"
            @click="handleImport"
          >
            Import
          </BaseButton>
        </div>
      </div>

      <!-- Main Area: Script Editor -->
      <div class="script-editor">
        <div v-if="!scriptStore.currentScript" class="no-script-selected">
          <span class="empty-icon">🎬</span>
          <h3>No Script Selected</h3>
          <p>Select a script from the list or create a new one</p>
          <div class="quick-actions">
            <BaseButton
              color="primary"
              @click="handleCreateScript"
            >
              Create New Script
            </BaseButton>
            <BaseButton
              color="default"
              @click="handleStartRecording"
            >
              Start Recording
            </BaseButton>
          </div>
        </div>

        <div v-else class="editor-container">
          <!-- Editor Header -->
          <div class="editor-header">
            <input
              v-model="scriptStore.currentScript.name"
              class="script-name-input"
              placeholder="Script Name"
              @blur="handleUpdateCurrentScript"
            />
            <div class="editor-actions">
              <button
                class="editor-action-btn"
                :class="{ active: editorMode === 'visual' }"
                @click="editorMode = 'visual'"
                title="Visual Editor"
              >
                <span>👁️</span> Visual
              </button>
              <button
                class="editor-action-btn"
                :class="{ active: editorMode === 'json' }"
                @click="editorMode = 'json'"
                title="JSON Editor"
              >
                <span>📝</span> JSON
              </button>
              <button
                class="editor-action-btn"
                @click="handleSaveScript"
                title="Save Script"
              >
                <span>💾</span> Save
              </button>
              <button
                class="editor-action-btn danger"
                @click="handleDeleteCurrentScript"
                title="Delete Script"
              >
                <span>🗑️</span> Delete
              </button>
            </div>
          </div>

          <!-- Script Metadata -->
          <div class="script-metadata">
            <div class="metadata-row">
              <label>Description:</label>
              <input
                v-model="scriptStore.currentScript.description"
                type="text"
                class="metadata-input"
                placeholder="Script description"
                @blur="handleUpdateCurrentScript"
              />
            </div>
            <div class="metadata-row">
              <label>Category:</label>
              <select
                v-model="scriptStore.currentScript.category"
                class="metadata-select"
                @change="handleUpdateCurrentScript"
              >
                <option
                  v-for="category in scriptStore.categories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.icon }} {{ category.name }}
                </option>
              </select>
            </div>
            <div class="metadata-row">
              <label>Tags:</label>
              <input
                v-model="tagsInput"
                type="text"
                class="metadata-input"
                placeholder="Enter tags separated by commas"
                @blur="handleUpdateTags"
              />
            </div>
          </div>

          <!-- Visual Editor -->
          <div v-if="editorMode === 'visual'" class="visual-editor">
            <div class="visual-editor-header">
              <h4>Steps ({{ scriptStore.currentScript.steps.length }})</h4>
              <BaseButton
                size="sm"
                color="primary"
                @click="handleAddStep"
              >
                ➕ Add Step
              </BaseButton>
            </div>

            <div class="steps-list">
              <div
                v-for="(step, index) in scriptStore.currentScript.steps"
                :key="step.id"
                class="step-item"
                :class="{ disabled: !step.enabled }"
                draggable="true"
                @dragstart="handleDragStart($event, index)"
                @dragover.prevent="handleDragOver($event, index)"
                @drop="handleDrop($event, index)"
              >
                <div class="step-header">
                  <span class="step-index">{{ index + 1 }}</span>
                  <input
                    type="checkbox"
                    v-model="step.enabled"
                    class="step-checkbox"
                    @change="handleUpdateCurrentScript"
                  />
                  <span class="step-type-badge" :class="`type-${step.type}`">
                    {{ getStepIcon(step.type) }} {{ step.type }}
                  </span>
                  <span class="step-name">{{ step.name }}</span>
                  <div class="step-actions">
                    <button
                      class="step-action-btn"
                      @click="handleEditStep(step.id)"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      class="step-action-btn"
                      @click="handleDuplicateStep(step.id)"
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      class="step-action-btn danger"
                      @click="handleDeleteStep(step.id)"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div v-if="step.description" class="step-description">
                  {{ step.description }}
                </div>
                <div class="step-details">
                  <span class="step-detail-item">
                    ⏱️ Delay: {{ step.delay }}ms
                  </span>
                  <span v-if="step.data" class="step-detail-item">
                    {{ formatStepData(step) }}
                  </span>
                </div>
              </div>

              <div v-if="scriptStore.currentScript.steps.length === 0" class="empty-steps">
                <span class="empty-icon">📝</span>
                <p>No steps added yet</p>
                <BaseButton
                  size="sm"
                  color="primary"
                  @click="handleAddStep"
                >
                  Add First Step
                </BaseButton>
              </div>
            </div>
          </div>

          <!-- JSON Editor -->
          <div v-if="editorMode === 'json'" class="json-editor">
            <textarea
              v-model="jsonEditorContent"
              class="json-textarea"
              spellcheck="false"
              @blur="handleUpdateFromJSON"
            />
          </div>
        </div>
      </div>

      <!-- Right Panel: Recording & Execution -->
      <div class="control-panel">
        <!-- Recording Controls -->
        <div class="control-section">
          <h4 class="control-section-title">
            <span>🔴</span> Recording
          </h4>
          <div class="control-section-content">
            <div v-if="!scriptStore.recordingState.isRecording" class="recording-idle">
              <p class="control-hint">Record device interactions to create a script</p>
              <select
                v-model="recordingDeviceSerial"
                class="device-select"
                :disabled="availableDevices.length === 0"
              >
                <option value="">Select device...</option>
                <option
                  v-for="device in availableDevices"
                  :key="device.serial"
                  :value="device.serial"
                >
                  {{ device.name }} ({{ device.serial }})
                </option>
              </select>
              <BaseButton
                color="danger"
                :disabled="!recordingDeviceSerial || availableDevices.length === 0"
                @click="handleStartRecording"
              >
                Start Recording
              </BaseButton>
            </div>

            <div v-else class="recording-active">
              <div class="recording-status">
                <span class="recording-indicator pulse"></span>
                <span>Recording...</span>
              </div>
              <div class="recording-info">
                <p><strong>Device:</strong> {{ scriptStore.recordingState.deviceSerial }}</p>
                <p><strong>Steps Recorded:</strong> {{ scriptStore.recordingState.recordedSteps.length }}</p>
                <p><strong>Duration:</strong> {{ formatRecordingDuration() }}</p>
              </div>
              <BaseButton
                color="danger"
                @click="handleStopRecording"
              >
                Stop Recording
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- Execution Controls -->
        <div class="control-section">
          <h4 class="control-section-title">
            <span>▶️</span> Execution
          </h4>
          <div class="control-section-content">
            <div v-if="!scriptStore.currentScript" class="execution-disabled">
              <p class="control-hint">Select a script to execute</p>
            </div>

            <div v-else class="execution-ready">
              <select
                v-model="executionDeviceSerial"
                class="device-select"
                :disabled="availableDevices.length === 0"
              >
                <option value="">Select device...</option>
                <option
                  v-for="device in availableDevices"
                  :key="device.serial"
                  :value="device.serial"
                >
                  {{ device.name }} ({{ device.serial }})
                </option>
                <option value="all">All Devices</option>
              </select>

              <div class="execution-options">
                <BaseToggle
                  v-model="scriptStore.currentScript.loopEnabled"
                  label="Loop"
                  size="sm"
                  @update:modelValue="handleUpdateCurrentScript"
                />
                <input
                  v-if="scriptStore.currentScript.loopEnabled"
                  v-model.number="scriptStore.currentScript.loopCount"
                  type="number"
                  min="1"
                  class="loop-count-input"
                  placeholder="Count"
                  @blur="handleUpdateCurrentScript"
                />
              </div>

              <BaseButton
                color="success"
                :disabled="!executionDeviceSerial || availableDevices.length === 0"
                @click="handleExecuteScript"
              >
                Execute Script
              </BaseButton>

              <!-- Execution Status -->
              <div v-if="currentExecutionState" class="execution-status">
                <div class="status-bar">
                  <div
                    class="status-progress"
                    :style="{ width: `${executionProgress}%` }"
                  ></div>
                </div>
                <p class="status-text">
                  Step {{ currentExecutionState.currentStepIndex + 1 }} / {{ currentExecutionState.totalSteps }}
                  <span v-if="currentExecutionState.loopIteration">
                    (Loop {{ currentExecutionState.loopIteration }})
                  </span>
                </p>
                <div class="execution-actions">
                  <BaseButton
                    v-if="currentExecutionState.status === 'running'"
                    size="sm"
                    color="warning"
                    @click="handlePauseExecution"
                  >
                    ⏸️ Pause
                  </BaseButton>
                  <BaseButton
                    v-if="currentExecutionState.status === 'paused'"
                    size="sm"
                    color="success"
                    @click="handleResumeExecution"
                  >
                    ▶️ Resume
                  </BaseButton>
                  <BaseButton
                    size="sm"
                    color="danger"
                    @click="handleStopExecution"
                  >
                    ⏹️ Stop
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Script Settings -->
        <div class="control-section">
          <h4 class="control-section-title">
            <span>⚙️</span> Settings
          </h4>
          <div v-if="scriptStore.currentScript" class="control-section-content">
            <div class="setting-item">
              <label>Version:</label>
              <input
                v-model="scriptStore.currentScript.version"
                type="text"
                class="setting-input"
                @blur="handleUpdateCurrentScript"
              />
            </div>
            <div class="setting-item">
              <label>Author:</label>
              <input
                v-model="scriptStore.currentScript.author"
                type="text"
                class="setting-input"
                placeholder="Optional"
                @blur="handleUpdateCurrentScript"
              />
            </div>
            <div class="setting-item">
              <label>Created:</label>
              <span class="setting-value">{{ formatDate(scriptStore.currentScript.createdAt) }}</span>
            </div>
            <div class="setting-item">
              <label>Updated:</label>
              <span class="setting-value">{{ formatDate(scriptStore.currentScript.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Help Dialog -->
    <div v-if="showHelp" class="help-overlay" @click.self="showHelp = false">
      <div class="help-dialog">
        <h3>Script Manager Help</h3>
        <div class="help-content">
          <section>
            <h4>📝 Creating Scripts</h4>
            <ul>
              <li>Click "New Script" button to create a blank script</li>
              <li>Or click "Start Recording" to record device interactions</li>
            </ul>
          </section>
          <section>
            <h4>✏️ Editing Scripts</h4>
            <ul>
              <li>Select a script from the list to edit</li>
              <li>Use Visual Editor to add/edit/delete steps</li>
              <li>Use JSON Editor for advanced editing</li>
              <li>Drag and drop to reorder steps</li>
            </ul>
          </section>
          <section>
            <h4>▶️ Executing Scripts</h4>
            <ul>
              <li>Select a device from the dropdown</li>
              <li>Enable "Loop" for repeated execution</li>
              <li>Click "Execute Script" to run</li>
              <li>Pause/Resume/Stop during execution</li>
            </ul>
          </section>
          <section>
            <h4>💾 Import/Export</h4>
            <ul>
              <li>Select scripts and click "Export Selected"</li>
              <li>Click "Import" to load scripts from JSON</li>
              <li>Share scripts with other users</li>
            </ul>
          </section>
        </div>
        <BaseButton
          color="primary"
          @click="showHelp = false"
        >
          Close
        </BaseButton>
      </div>
    </div>

    <!-- Step Editor Dialog -->
    <PyMatrixScriptStepEditor
      :model-value="showStepEditor"
      :step="editingStep"
      :edit-mode="stepEditorMode === 'edit'"
      @close="handleCloseStepEditor"
      @save="handleSaveStep"
    />
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useScriptStore } from '../stores_app_pymatrix/scriptStore';
import { useScriptExecutor } from '../composables_app_pymatrix/useScriptExecutor';
import BasePanel from '@/common/components/ui/BasePanel.vue';
import BaseButton from '@/common/components/ui/BaseButton.vue';
import BaseToggle from '@/common/components/ui/BaseToggle.vue';
import PyMatrixScriptStepEditor from './PyMatrixScriptStepEditor.vue';
import type { Device, Script, ScriptStep, ScriptStepType } from '@/types/pymatrix';

interface Props {
  modelValue: boolean;
  availableDevices: Device[];
}

const props = defineProps<Props>();

defineEmits<{
  close: [];
}>();

const scriptStore = useScriptStore();
const scriptExecutor = useScriptExecutor();

// State
const searchQuery = ref('');
const selectedCategory = ref('all');
const editorMode = ref<'visual' | 'json'>('visual');
const jsonEditorContent = ref('');
const tagsInput = ref('');
const recordingDeviceSerial = ref('');
const executionDeviceSerial = ref('');
const showHelp = ref(false);
const draggedStepIndex = ref<number | null>(null);
const showStepEditor = ref(false);
const editingStep = ref<ScriptStep | undefined>(undefined);
const stepEditorMode = ref<'add' | 'edit'>('add');
const baseUrl = ref('ws://localhost:8000');

// Initialize store
onMounted(() => {
  scriptStore.initialize();
});

// Computed
const filteredScripts = computed(() => {
  let scripts = scriptStore.allScripts;

  // Filter by category
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    scripts = scriptStore.getScriptsByCategory(selectedCategory.value);
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    scripts = scripts.filter(script =>
      script.name.toLowerCase().includes(query) ||
      script.description.toLowerCase().includes(query) ||
      script.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  return scripts;
});

const currentExecutionState = computed(() => {
  if (!executionDeviceSerial.value) return null;
  return scriptStore.getExecutionState(executionDeviceSerial.value);
});

const executionProgress = computed(() => {
  if (!currentExecutionState.value) return 0;
  return Math.round((currentExecutionState.value.currentStepIndex / currentExecutionState.value.totalSteps) * 100);
});

// Watch current script for JSON editor
watch(
  () => scriptStore.currentScript,
  (script) => {
    if (script && editorMode.value === 'json') {
      jsonEditorContent.value = JSON.stringify(script, null, 2);
    }
    if (script) {
      tagsInput.value = script.tags.join(', ');
    }
  },
  { immediate: true }
);

// Methods
function handleSearch() {
  // Search is reactive via computed property
}

function handleSelectScript(scriptId: string) {
  scriptStore.setCurrentScript(scriptId);
}

function handleEditScript(scriptId: string) {
  scriptStore.setCurrentScript(scriptId);
  editorMode.value = 'visual';
}

function handleCreateScript() {
  const script = scriptStore.createScript({
    name: `New Script ${Date.now()}`,
    description: '',
    category: selectedCategory.value === 'all' ? 'custom' : selectedCategory.value,
    tags: [],
    steps: [],
    loopEnabled: false,
    scheduleEnabled: false
  });
  scriptStore.setCurrentScript(script.id);
}

function handleDeleteCurrentScript() {
  if (!scriptStore.currentScript) return;
  if (!confirm(`Delete script "${scriptStore.currentScript.name}"?`)) return;

  scriptStore.deleteScript(scriptStore.currentScript.id);
}

function handleUpdateCurrentScript() {
  if (!scriptStore.currentScript) return;
  scriptStore.updateScript(scriptStore.currentScript.id, scriptStore.currentScript);
}

function handleSaveScript() {
  handleUpdateCurrentScript();
  // Show toast notification
  console.log('[ScriptManager] Script saved');
}

function handleUpdateTags() {
  if (!scriptStore.currentScript) return;
  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);
  scriptStore.currentScript.tags = tags;
  handleUpdateCurrentScript();
}

function handleUpdateFromJSON() {
  try {
    const updated = JSON.parse(jsonEditorContent.value);
    if (scriptStore.currentScript) {
      scriptStore.updateScript(scriptStore.currentScript.id, updated);
    }
  } catch (error) {
    console.error('[ScriptManager] Invalid JSON:', error);
    alert('Invalid JSON format');
  }
}

function handleAddStep() {
  if (!scriptStore.currentScript) return;
  stepEditorMode.value = 'add';
  editingStep.value = undefined;
  showStepEditor.value = true;
}

function handleEditStep(stepId: string) {
  if (!scriptStore.currentScript) return;
  const step = scriptStore.currentScript.steps.find(s => s.id === stepId);
  if (!step) return;

  stepEditorMode.value = 'edit';
  editingStep.value = step;
  showStepEditor.value = true;
}

function handleCloseStepEditor() {
  showStepEditor.value = false;
  editingStep.value = undefined;
}

function handleSaveStep(step: ScriptStep) {
  if (!scriptStore.currentScript) return;

  if (stepEditorMode.value === 'add') {
    scriptStore.addStepToCurrentScript(step);
  } else {
    scriptStore.updateStepInCurrentScript(step.id, step);
  }
}

function handleDuplicateStep(stepId: string) {
  if (!scriptStore.currentScript) return;
  const step = scriptStore.currentScript.steps.find(s => s.id === stepId);
  if (step) {
    scriptStore.addStepToCurrentScript({
      ...step,
      name: `${step.name} (Copy)`
    });
  }
}

function handleDeleteStep(stepId: string) {
  if (!confirm('Delete this step?')) return;
  scriptStore.deleteStepFromCurrentScript(stepId);
}

function handleDragStart(event: DragEvent, index: number) {
  draggedStepIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function handleDragOver(event: DragEvent, index: number) {
  event.preventDefault();
}

function handleDrop(event: DragEvent, toIndex: number) {
  event.preventDefault();
  if (draggedStepIndex.value === null) return;
  scriptStore.reorderStepsInCurrentScript(draggedStepIndex.value, toIndex);
  draggedStepIndex.value = null;
}

function handleStartRecording() {
  if (!recordingDeviceSerial.value) {
    alert('Please select a device');
    return;
  }
  scriptStore.startRecording(recordingDeviceSerial.value);
}

function handleStopRecording() {
  const scriptName = prompt('Enter script name:', `Recorded Script ${new Date().toLocaleString()}`);
  if (scriptName) {
    const script = scriptStore.stopRecording(scriptName);
    if (script) {
      scriptStore.setCurrentScript(script.id);
    }
  } else {
    scriptStore.stopRecording();
  }
}

async function handleExecuteScript() {
  if (!scriptStore.currentScript || !executionDeviceSerial.value) return;

  console.log('[ScriptManager] Execute script:', scriptStore.currentScript.id);

  if (executionDeviceSerial.value === 'all') {
    // Execute on all devices
    const deviceSerials = props.availableDevices.map(d => d.serial);
    await scriptExecutor.executeScriptOnDevices(
      scriptStore.currentScript.id,
      deviceSerials,
      baseUrl.value
    );
  } else {
    // Execute on single device
    await scriptExecutor.executeScript(
      scriptStore.currentScript.id,
      executionDeviceSerial.value,
      baseUrl.value
    );
  }
}

function handlePauseExecution() {
  if (!executionDeviceSerial.value) return;
  scriptExecutor.pauseExecution(executionDeviceSerial.value);
  console.log('[ScriptManager] Execution paused');
}

async function handleResumeExecution() {
  if (!executionDeviceSerial.value) return;
  await scriptExecutor.resumeExecution(executionDeviceSerial.value, baseUrl.value);
  console.log('[ScriptManager] Execution resumed');
}

function handleStopExecution() {
  if (!executionDeviceSerial.value) return;
  scriptExecutor.stopExecution(executionDeviceSerial.value);
  console.log('[ScriptManager] Execution stopped');
}

function handleBatchExport() {
  const json = scriptStore.exportSelectedScripts();
  if (json) {
    downloadJSON(json, `scripts_export_${Date.now()}.json`);
  }
}

function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = scriptStore.importMultipleScripts(text);
    if (result) {
      alert(`Imported ${result.length} scripts`);
    } else {
      // Try single script import
      const single = scriptStore.importScript(text);
      if (single) {
        alert('Imported 1 script');
      } else {
        alert('Import failed');
      }
    }
  };
  input.click();
}

function downloadJSON(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

function formatRecordingDuration(): string {
  if (!scriptStore.recordingState.startTime) return '0s';
  const seconds = Math.floor((Date.now() - scriptStore.recordingState.startTime) / 1000);
  return `${seconds}s`;
}

function formatStepData(step: ScriptStep): string {
  switch (step.type) {
    case 'touch':
      return `${step.data.action} at (${step.data.x}, ${step.data.y})`;
    case 'key':
      return `Key: ${step.data.keyName || step.data.keyCode}`;
    case 'text':
      return `Text: "${step.data.text}"`;
    case 'swipe':
      return `From (${step.data.startX}, ${step.data.startY}) to (${step.data.endX}, ${step.data.endY})`;
    case 'system':
      return `${step.data.systemKey}`;
    case 'wait':
      return `Wait ${step.data.waitDuration}ms`;
    case 'screenshot':
      return `Format: ${step.data.screenshotFormat || 'png'}`;
    case 'clipboard':
      return `${step.data.clipboardAction}`;
    default:
      return '';
  }
}

function getStepIcon(type: ScriptStepType): string {
  const icons: Record<ScriptStepType, string> = {
    touch: '👆',
    key: '⌨️',
    text: '📝',
    swipe: '👉',
    system: '🔘',
    wait: '⏱️',
    screenshot: '📸',
    clipboard: '📋'
  };
  return icons[type] || '❓';
}

function getCategoryIcon(categoryId: string): string {
  const category = scriptStore.getCategoryById(categoryId);
  return category?.icon || '📁';
}

function getCategoryColor(categoryId: string): string {
  const category = scriptStore.getCategoryById(categoryId);
  return category?.color || '#6b7280';
}
</script>

