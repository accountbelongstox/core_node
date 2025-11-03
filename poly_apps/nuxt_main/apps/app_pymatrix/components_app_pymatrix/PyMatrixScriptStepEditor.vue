<template>
  <div v-if="show" class="step-editor-overlay" @click.self="handleClose">
    <div class="step-editor-modal">
      <!-- Header -->
      <div class="step-editor-header">
        <h3>{{ editMode ? 'Edit Step' : 'Add New Step' }}</h3>
        <button class="close-btn" @click="handleClose" title="Close">×</button>
      </div>

      <!-- Content -->
      <div class="step-editor-content">
        <!-- Step Type Selection -->
        <div class="form-group">
          <label for="step-type">Step Type</label>
          <select
            id="step-type"
            v-model="localStep.type"
            :disabled="editMode"
            class="form-control"
            @change="handleTypeChange"
          >
            <option value="touch">Touch Action</option>
            <option value="key">Key Press</option>
            <option value="text">Text Input</option>
            <option value="swipe">Swipe Gesture</option>
            <option value="system">System Key</option>
            <option value="wait">Wait/Delay</option>
            <option value="screenshot">Screenshot</option>
            <option value="clipboard">Clipboard</option>
          </select>
        </div>

        <!-- Step Name -->
        <div class="form-group">
          <label for="step-name">Step Name</label>
          <input
            id="step-name"
            v-model="localStep.name"
            type="text"
            class="form-control"
            placeholder="Enter step name"
          />
        </div>

        <!-- Step Description -->
        <div class="form-group">
          <label for="step-description">Description (Optional)</label>
          <textarea
            id="step-description"
            v-model="localStep.description"
            class="form-control"
            rows="2"
            placeholder="Enter step description"
          />
        </div>

        <!-- Type-Specific Fields -->
        <div class="form-group-section">
          <h4 class="section-title">{{ getStepTypeLabel(localStep.type) }} Settings</h4>

          <!-- Touch Action Fields -->
          <template v-if="localStep.type === 'touch'">
            <div class="form-row">
              <div class="form-group">
                <label for="touch-action">Action</label>
                <select id="touch-action" v-model="localStep.data.action" class="form-control">
                  <option value="tap">Tap</option>
                  <option value="long_press">Long Press</option>
                  <option value="down">Touch Down</option>
                  <option value="up">Touch Up</option>
                  <option value="move">Touch Move</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="touch-x">X Coordinate</label>
                <input
                  id="touch-x"
                  v-model.number="localStep.data.x"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div class="form-group">
                <label for="touch-y">Y Coordinate</label>
                <input
                  id="touch-y"
                  v-model.number="localStep.data.y"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div class="form-group" v-if="localStep.data.action === 'long_press'">
              <label for="touch-duration">Duration (ms)</label>
              <input
                id="touch-duration"
                v-model.number="localStep.data.duration"
                type="number"
                class="form-control"
                placeholder="1000"
                min="0"
              />
            </div>
          </template>

          <!-- Key Press Fields -->
          <template v-if="localStep.type === 'key'">
            <div class="form-row">
              <div class="form-group">
                <label for="key-name">Key Name</label>
                <input
                  id="key-name"
                  v-model="localStep.data.keyName"
                  type="text"
                  class="form-control"
                  placeholder="Enter key name"
                />
              </div>
              <div class="form-group">
                <label for="key-code">Key Code</label>
                <input
                  id="key-code"
                  v-model.number="localStep.data.keyCode"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          </template>

          <!-- Text Input Fields -->
          <template v-if="localStep.type === 'text'">
            <div class="form-group">
              <label for="text-input">Text to Input</label>
              <textarea
                id="text-input"
                v-model="localStep.data.text"
                class="form-control"
                rows="3"
                placeholder="Enter text to input on device"
              />
            </div>
          </template>

          <!-- Swipe Gesture Fields -->
          <template v-if="localStep.type === 'swipe'">
            <div class="form-row">
              <div class="form-group">
                <label for="swipe-start-x">Start X</label>
                <input
                  id="swipe-start-x"
                  v-model.number="localStep.data.startX"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div class="form-group">
                <label for="swipe-start-y">Start Y</label>
                <input
                  id="swipe-start-y"
                  v-model.number="localStep.data.startY"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="swipe-end-x">End X</label>
                <input
                  id="swipe-end-x"
                  v-model.number="localStep.data.endX"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div class="form-group">
                <label for="swipe-end-y">End Y</label>
                <input
                  id="swipe-end-y"
                  v-model.number="localStep.data.endY"
                  type="number"
                  class="form-control"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div class="form-group">
              <label for="swipe-duration">Duration (ms)</label>
              <input
                id="swipe-duration"
                v-model.number="localStep.data.swipeDuration"
                type="number"
                class="form-control"
                placeholder="300"
                min="0"
              />
            </div>
          </template>

          <!-- System Key Fields -->
          <template v-if="localStep.type === 'system'">
            <div class="form-group">
              <label for="system-key">System Key</label>
              <select id="system-key" v-model="localStep.data.systemKey" class="form-control">
                <option value="home">Home</option>
                <option value="back">Back</option>
                <option value="recent">Recent Apps</option>
                <option value="power">Power</option>
                <option value="volume_up">Volume Up</option>
                <option value="volume_down">Volume Down</option>
              </select>
            </div>
          </template>

          <!-- Wait Fields -->
          <template v-if="localStep.type === 'wait'">
            <div class="form-group">
              <label for="wait-duration">Wait Duration (ms)</label>
              <input
                id="wait-duration"
                v-model.number="localStep.data.waitDuration"
                type="number"
                class="form-control"
                placeholder="1000"
                min="0"
              />
            </div>
            <p class="form-hint">Pause script execution for specified duration</p>
          </template>

          <!-- Screenshot Fields -->
          <template v-if="localStep.type === 'screenshot'">
            <div class="form-group">
              <label for="screenshot-format">Format</label>
              <select id="screenshot-format" v-model="localStep.data.screenshotFormat" class="form-control">
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </div>
          </template>

          <!-- Clipboard Fields -->
          <template v-if="localStep.type === 'clipboard'">
            <div class="form-group">
              <label for="clipboard-action">Action</label>
              <select id="clipboard-action" v-model="localStep.data.clipboardAction" class="form-control">
                <option value="set">Set Clipboard</option>
                <option value="get">Get Clipboard</option>
              </select>
            </div>
            <div v-if="localStep.data.clipboardAction === 'set'" class="form-group">
              <label for="clipboard-text">Clipboard Text</label>
              <textarea
                id="clipboard-text"
                v-model="localStep.data.clipboardText"
                class="form-control"
                rows="3"
                placeholder="Enter text to set on clipboard"
              />
            </div>
          </template>
        </div>

        <!-- Delay After Step -->
        <div class="form-group">
          <label for="step-delay">Delay After Step (ms)</label>
          <input
            id="step-delay"
            v-model.number="localStep.delay"
            type="number"
            class="form-control"
            placeholder="500"
            min="0"
          />
          <p class="form-hint">Time to wait before executing the next step</p>
        </div>

        <!-- Enabled Toggle -->
        <div class="form-group-checkbox">
          <label class="checkbox-label">
            <input v-model="localStep.enabled" type="checkbox" />
            <span>Step Enabled</span>
          </label>
          <p class="form-hint">Disabled steps will be skipped during execution</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="step-editor-footer">
        <button class="btn btn-secondary" @click="handleClose">Cancel</button>
        <button class="btn btn-primary" @click="handleSave">
          {{ editMode ? 'Save Changes' : 'Add Step' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { ScriptStep, ScriptStepType, ScriptStepData } from '@/types/pymatrix';

interface Props {
  show: boolean;
  step?: ScriptStep;
  editMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  editMode: false
});

const emit = defineEmits<{
  close: [];
  save: [step: ScriptStep];
}>();

// Local step state
const localStep = ref<ScriptStep>(createDefaultStep('touch'));

// Watch for prop changes
watch(() => props.step, (newStep) => {
  if (newStep) {
    localStep.value = JSON.parse(JSON.stringify(newStep));
  } else {
    localStep.value = createDefaultStep('touch');
  }
}, { immediate: true });

watch(() => props.show, (newShow) => {
  if (newShow && !props.step) {
    localStep.value = createDefaultStep('touch');
  }
});

function createDefaultStep(type: ScriptStepType): ScriptStep {
  const baseStep: ScriptStep = {
    id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    name: `New ${type} step`,
    description: '',
    data: {},
    delay: 500,
    enabled: true
  };

  // Set default data based on type
  switch (type) {
    case 'touch':
      baseStep.data = { action: 'tap', x: 0, y: 0 };
      break;
    case 'key':
      baseStep.data = { keyCode: 0, keyName: '' };
      break;
    case 'text':
      baseStep.data = { text: '' };
      break;
    case 'swipe':
      baseStep.data = { startX: 0, startY: 0, endX: 0, endY: 0, swipeDuration: 300 };
      break;
    case 'system':
      baseStep.data = { systemKey: 'home' };
      break;
    case 'wait':
      baseStep.data = { waitDuration: 1000 };
      break;
    case 'screenshot':
      baseStep.data = { screenshotFormat: 'png' };
      break;
    case 'clipboard':
      baseStep.data = { clipboardAction: 'set', clipboardText: '' };
      break;
  }

  return baseStep;
}

function getStepTypeLabel(type: ScriptStepType): string {
  const labels: Record<ScriptStepType, string> = {
    touch: 'Touch Action',
    key: 'Key Press',
    text: 'Text Input',
    swipe: 'Swipe Gesture',
    system: 'System Key',
    wait: 'Wait/Delay',
    screenshot: 'Screenshot',
    clipboard: 'Clipboard'
  };
  return labels[type] || type;
}

function handleTypeChange() {
  // Reset data when type changes
  const newStep = createDefaultStep(localStep.value.type);
  localStep.value.data = newStep.data;
  localStep.value.name = newStep.name;
}

function handleClose() {
  emit('close');
}

function handleSave() {
  // Validate step
  if (!localStep.value.name.trim()) {
    alert('Please enter a step name');
    return;
  }

  // Validate type-specific data
  if (!validateStepData(localStep.value)) {
    return;
  }

  emit('save', { ...localStep.value });
  handleClose();
}

function validateStepData(step: ScriptStep): boolean {
  switch (step.type) {
    case 'touch':
      if (step.data.x === undefined || step.data.y === undefined) {
        alert('Please enter valid touch coordinates');
        return false;
      }
      break;
    case 'key':
      if (!step.data.keyCode) {
        alert('Please enter a valid key code');
        return false;
      }
      break;
    case 'text':
      if (!step.data.text) {
        alert('Please enter text to input');
        return false;
      }
      break;
    case 'swipe':
      if (step.data.startX === undefined || step.data.startY === undefined ||
          step.data.endX === undefined || step.data.endY === undefined) {
        alert('Please enter valid swipe coordinates');
        return false;
      }
      break;
    case 'wait':
      if (!step.data.waitDuration || step.data.waitDuration < 0) {
        alert('Please enter a valid wait duration');
        return false;
      }
      break;
  }
  return true;
}
</script>

<style scoped>
.step-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.step-editor-modal {
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border-radius: 16px;
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.step-editor-header h3 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #ffffff;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.step-editor-content {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.95rem;
  transition: all 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #3b82f6;
  background: rgba(255, 255, 255, 0.08);
}

.form-control::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.form-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

select.form-control {
  cursor: pointer;
}

textarea.form-control {
  resize: vertical;
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}

.section-title {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #3b82f6;
}

.form-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

.form-group-checkbox {
  margin-bottom: 1.25rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-label span {
  font-weight: 500;
}

.step-editor-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #ffffff;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

/* Scrollbar Styling */
.step-editor-content::-webkit-scrollbar {
  width: 8px;
}

.step-editor-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.step-editor-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.step-editor-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
