<template>
  <div v-if="show" class="step-editor-overlay" @click.self="handleClose">
    <div class="pm-card">
      <!-- Header -->
      <div class="pm-card__header">
        <h3>{{ editMode ? 'Edit Step' : 'Add New Step' }}</h3>
        <button class="close-btn" @click="handleClose" title="Close">×</button>
      </div>

      <!-- Content -->
      <div class="pm-card__body">
        <!-- Step Type Selection -->
        <div class="pm-form-group">
          <label for="step-type" class="pm-form-label">Step Type</label>
          <select
            id="step-type"
            v-model="localStep.type"
            :disabled="editMode"
            class="pm-select"
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
        <div class="pm-form-group">
          <label for="step-name" class="pm-form-label">Step Name</label>
          <input
            id="step-name"
            v-model="localStep.name"
            type="text"
            class="pm-input"
            placeholder="Enter step name"
          />
        </div>

        <!-- Step Description -->
        <div class="pm-form-group">
          <label for="step-description" class="pm-form-label">Description (Optional)</label>
          <textarea
            id="step-description"
            v-model="localStep.description"
            class="pm-textarea"
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
              <div class="pm-form-group">
                <label for="touch-action" class="pm-form-label">Action</label>
                <select id="touch-action" v-model="localStep.data.action" class="pm-select">
                  <option value="tap">Tap</option>
                  <option value="long_press">Long Press</option>
                  <option value="down">Touch Down</option>
                  <option value="up">Touch Up</option>
                  <option value="move">Touch Move</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="pm-form-group">
                <label for="touch-x" class="pm-form-label">X Coordinate</label>
                <input
                  id="touch-x"
                  v-model.number="localStep.data.x"
                  type="number"
                  class="pm-input"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div class="pm-form-group">
                <label for="touch-y" class="pm-form-label">Y Coordinate</label>
                <input
                  id="touch-y"
                  v-model.number="localStep.data.y"
                  type="number"
                  class="pm-input"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div class="pm-form-group" v-if="localStep.data.action === 'long_press'">
              <label for="touch-duration" class="pm-form-label">Duration (ms)</label>
              <input
                id="touch-duration"
                v-model.number="localStep.data.duration"
                type="number"
                class="pm-input"
                placeholder="1000"
                min="0"
              />
            </div>
          </template>

          <!-- Key Press Fields -->
          <template v-if="localStep.type === 'key'">
            <div class="form-row">
              <div class="pm-form-group">
                <label for="key-name" class="pm-form-label">Key Name</label>
                <input
                  id="key-name"
                  v-model="localStep.data.keyName"
                  type="text"
                  class="pm-input"
                  placeholder="Enter key name"
                />
              </div>
              <div class="pm-form-group">
                <label for="key-code" class="pm-form-label">Key Code</label>
                <input
                  id="key-code"
                  v-model.number="localStep.data.keyCode"
                  type="number"
                  class="pm-input"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          </template>

          <!-- Text Input Fields -->
          <template v-if="localStep.type === 'text'">
            <div class="pm-form-group">
              <label for="text-input" class="pm-form-label">Text to Input</label>
              <textarea
                id="text-input"
                v-model="localStep.data.text"
                class="pm-textarea"
                rows="3"
                placeholder="Enter text to input on device"
              />
            </div>
          </template>

          <!-- Swipe Gesture Fields -->
          <template v-if="localStep.type === 'swipe'">
            <div class="form-row">
              <div class="pm-form-group">
                <label for="swipe-start-x" class="pm-form-label">Start X</label>
                <input
                  id="swipe-start-x"
                  v-model.number="localStep.data.startX"
                  type="number"
                  class="pm-input"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div class="pm-form-group">
                <label for="swipe-start-y" class="pm-form-label">Start Y</label>
                <input
                  id="swipe-start-y"
                  v-model.number="localStep.data.startY"
                  type="number"
                  class="pm-input"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="pm-form-group">
                <label for="swipe-end-x" class="pm-form-label">End X</label>
                <input
                  id="swipe-end-x"
                  v-model.number="localStep.data.endX"
                  type="number"
                  class="pm-input"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div class="pm-form-group">
                <label for="swipe-end-y" class="pm-form-label">End Y</label>
                <input
                  id="swipe-end-y"
                  v-model.number="localStep.data.endY"
                  type="number"
                  class="pm-input"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div class="pm-form-group">
              <label for="swipe-duration" class="pm-form-label">Duration (ms)</label>
              <input
                id="swipe-duration"
                v-model.number="localStep.data.swipeDuration"
                type="number"
                class="pm-input"
                placeholder="300"
                min="0"
              />
            </div>
          </template>

          <!-- System Key Fields -->
          <template v-if="localStep.type === 'system'">
            <div class="pm-form-group">
              <label for="system-key" class="pm-form-label">System Key</label>
              <select id="system-key" v-model="localStep.data.systemKey" class="pm-select">
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
            <div class="pm-form-group">
              <label for="wait-duration" class="pm-form-label">Wait Duration (ms)</label>
              <input
                id="wait-duration"
                v-model.number="localStep.data.waitDuration"
                type="number"
                class="pm-input"
                placeholder="1000"
                min="0"
              />
            </div>
            <p class="form-hint">Pause script execution for specified duration</p>
          </template>

          <!-- Screenshot Fields -->
          <template v-if="localStep.type === 'screenshot'">
            <div class="pm-form-group">
              <label for="screenshot-format" class="pm-form-label">Format</label>
              <select id="screenshot-format" v-model="localStep.data.screenshotFormat" class="pm-select">
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </div>
          </template>

          <!-- Clipboard Fields -->
          <template v-if="localStep.type === 'clipboard'">
            <div class="pm-form-group">
              <label for="clipboard-action" class="pm-form-label">Action</label>
              <select id="clipboard-action" v-model="localStep.data.clipboardAction" class="pm-select">
                <option value="set">Set Clipboard</option>
                <option value="get">Get Clipboard</option>
              </select>
            </div>
            <div v-if="localStep.data.clipboardAction === 'set'" class="pm-form-group">
              <label for="clipboard-text" class="pm-form-label">Clipboard Text</label>
              <textarea
                id="clipboard-text"
                v-model="localStep.data.clipboardText"
                class="pm-textarea"
                rows="3"
                placeholder="Enter text to set on clipboard"
              />
            </div>
          </template>
        </div>

        <!-- Delay After Step -->
        <div class="pm-form-group">
          <label for="step-delay" class="pm-form-label">Delay After Step (ms)</label>
          <input
            id="step-delay"
            v-model.number="localStep.delay"
            type="number"
            class="pm-input"
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
        <button class="pm-button pm-button--secondary" @click="handleClose">Cancel</button>
        <button class="pm-button pm-button--electric-blue" @click="handleSave">
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

.pm-card {
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease-out;
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

.pm-card__body {
  overflow-y: auto;
  flex: 1;
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

/* Scrollbar Styling */
.pm-card__body::-webkit-scrollbar {
  width: 8px;
}

.pm-card__body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.pm-card__body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.pm-card__body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
