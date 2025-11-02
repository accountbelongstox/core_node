<template>
  <BasePanel
    v-if="show"
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
            class="script-item"
            :class="{
              active: scriptStore.currentScript?.id === script.id,
              selected: scriptStore.selectedScriptIds.includes(script.id)
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
      :show="showStepEditor"
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
import BasePanel from '../../../common/components/ui/BasePanel.vue';
import BaseButton from '../../../common/components/ui/BaseButton.vue';
import BaseToggle from '../../../common/components/ui/BaseToggle.vue';
import PyMatrixScriptStepEditor from './PyMatrixScriptStepEditor.vue';
import type { Device, Script, ScriptStep, ScriptStepType } from '../../../types/pymatrix';

interface Props {
  show: boolean;
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

function handleExecuteScript() {
  if (!scriptStore.currentScript || !executionDeviceSerial.value) return;

  if (executionDeviceSerial.value === 'all') {
    // Execute on all devices
    props.availableDevices.forEach(device => {
      scriptStore.startExecution(scriptStore.currentScript!.id, device.serial);
    });
  } else {
    scriptStore.startExecution(scriptStore.currentScript.id, executionDeviceSerial.value);
  }

  // TODO: Implement actual execution logic with device control
  console.log('[ScriptManager] Execute script:', scriptStore.currentScript.id);
}

function handlePauseExecution() {
  if (!executionDeviceSerial.value) return;
  scriptStore.pauseExecution(executionDeviceSerial.value);
}

function handleResumeExecution() {
  if (!executionDeviceSerial.value) return;
  scriptStore.resumeExecution(executionDeviceSerial.value);
}

function handleStopExecution() {
  if (!executionDeviceSerial.value) return;
  scriptStore.completeExecution(executionDeviceSerial.value, false);
  scriptStore.clearExecutionState(executionDeviceSerial.value);
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

<style scoped>
.script-manager-container {
  display: grid;
  grid-template-columns: 300px 1fr 350px;
  gap: 1rem;
  height: calc(100vh - 120px);
  overflow: hidden;
}

/* Left Sidebar */
.script-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.category-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.category-tab.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.category-icon {
  font-size: 1.25rem;
}

.category-name {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
}

.category-count {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.script-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.script-item {
  padding: 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.script-item.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.script-item.selected {
  background: #eff6ff;
}

.script-item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.script-checkbox {
  cursor: pointer;
}

.script-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
}

.script-steps-count {
  font-size: 0.75rem;
  color: #6b7280;
}

.script-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.script-category-badge {
  font-weight: 500;
}

.script-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.script-tag {
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  background: #e5e7eb;
  border-radius: 12px;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

/* Main Editor Area */
.script-editor {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}

.no-script-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: #6b7280;
}

.no-script-selected .empty-icon {
  font-size: 4rem;
}

.no-script-selected h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #374151;
}

.quick-actions {
  display: flex;
  gap: 1rem;
}

.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.script-name-input {
  flex: 1;
  font-size: 1.25rem;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 0.5rem;
  transition: all 0.2s;
}

.script-name-input:hover,
.script-name-input:focus {
  border-color: #3b82f6;
  outline: none;
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.editor-action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.editor-action-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.editor-action-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.editor-action-btn.danger:hover {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.script-metadata {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metadata-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.metadata-row label {
  min-width: 100px;
  font-weight: 500;
  font-size: 0.875rem;
  color: #374151;
}

.metadata-input,
.metadata-select {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

/* Visual Editor */
.visual-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.visual-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.visual-editor-header h4 {
  margin: 0;
  font-size: 1rem;
  color: #374151;
}

.steps-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-item {
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: move;
  transition: all 0.2s;
}

.step-item.disabled {
  opacity: 0.5;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.step-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.step-type-badge {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
  background: #e5e7eb;
}

.step-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
}

.step-actions {
  display: flex;
  gap: 0.25rem;
}

.step-action-btn {
  padding: 0.25rem 0.5rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.step-action-btn:hover {
  border-color: #3b82f6;
}

.step-action-btn.danger:hover {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
}

.step-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.step-details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.step-detail-item {
  padding: 0.25rem 0.5rem;
  background: white;
  border-radius: 4px;
}

/* JSON Editor */
.json-editor {
  flex: 1;
  padding: 1rem;
  overflow: hidden;
}

.json-textarea {
  width: 100%;
  height: 100%;
  padding: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  resize: none;
}

/* Right Control Panel */
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.control-section {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.control-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #374151;
}

.control-section-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-hint {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.device-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.recording-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fee2e2;
  border-radius: 6px;
  font-weight: 600;
  color: #991b1b;
}

.recording-indicator {
  width: 12px;
  height: 12px;
  background: #dc2626;
  border-radius: 50%;
}

.recording-indicator.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.recording-info {
  font-size: 0.875rem;
  color: #374151;
}

.recording-info p {
  margin: 0.25rem 0;
}

.execution-options {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.loop-count-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.execution-status {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.status-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.status-progress {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s;
}

.status-text {
  font-size: 0.875rem;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.execution-actions {
  display: flex;
  gap: 0.5rem;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.setting-item label {
  font-weight: 500;
  color: #374151;
}

.setting-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.setting-value {
  color: #6b7280;
}

/* Help Dialog */
.help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.help-dialog {
  max-width: 600px;
  max-height: 80vh;
  background: white;
  border-radius: 12px;
  padding: 2rem;
  overflow-y: auto;
}

.help-dialog h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  color: #111827;
}

.help-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.help-content section h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  color: #374151;
}

.help-content ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #6b7280;
}

.help-content li {
  margin: 0.5rem 0;
}

.empty-state,
.empty-steps {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
  color: #6b7280;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
}

.header-action-btn {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: inherit;
  cursor: pointer;
  font-size: 1.25rem;
  transition: all 0.2s;
}

.header-action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .script-sidebar {
    background: #1f2937;
  }

  .script-item,
  .category-tab {
    background: #111827;
    border-color: #374151;
  }

  .script-editor,
  .control-section {
    background: #1f2937;
    border-color: #374151;
  }

  .search-input,
  .metadata-input,
  .metadata-select,
  .device-select,
  .setting-input,
  .json-textarea {
    background: #111827;
    border-color: #374151;
    color: #f3f4f6;
  }

  .step-item {
    background: #111827;
    border-color: #374151;
  }
}
</style>
