<template>
  <div class="group-batch-operations" v-if="groupStore.hasGroup && groupStore.enabled">
    <div class="batch-toolbar">
      <div class="toolbar-header">
        <div class="header-icon">⚡</div>
        <h3 class="header-title">Batch Operations</h3>
        <div class="device-count">
          {{ groupStore.slaveDevices.length + 1 }} devices
        </div>
      </div>

      <div class="toolbar-actions">
        <!-- Screenshot -->
        <BaseButton
          variant="info"
          size="sm"
          icon="📸"
          :loading="processing && currentOperation === 'screenshot'"
          :disabled="processing"
          @click="handleBatchScreenshot"
          title="Batch Screenshot"
        >
          Screenshot
        </BaseButton>

        <!-- Recording -->
        <BaseButton
          v-if="!isRecording"
          variant="danger"
          size="sm"
          icon="⏺️"
          :loading="processing && currentOperation === 'recording_start'"
          :disabled="processing"
          @click="handleBatchRecordingStart"
          title="Start Batch Recording"
        >
          Record
        </BaseButton>
        <BaseButton
          v-else
          variant="warning"
          size="sm"
          icon="⏹️"
          :loading="processing && currentOperation === 'recording_stop'"
          :disabled="processing"
          @click="handleBatchRecordingStop"
          title="Stop Batch Recording"
        >
          Stop
        </BaseButton>

        <!-- System Keys -->
        <div class="system-keys-group">
          <BaseButton
            variant="ghost"
            size="sm"
            icon="🏠"
            :loading="processing && currentOperation === 'home'"
            :disabled="processing"
            @click="handleBatchSystemKey('home')"
            title="Home"
          />
          <BaseButton
            variant="ghost"
            size="sm"
            icon="◀️"
            :loading="processing && currentOperation === 'back'"
            :disabled="processing"
            @click="handleBatchSystemKey('back')"
            title="Back"
          />
          <BaseButton
            variant="ghost"
            size="sm"
            icon="⚙️"
            :loading="processing && currentOperation === 'recent'"
            :disabled="processing"
            @click="handleBatchSystemKey('recent')"
            title="Recent Apps"
          />
        </div>

        <!-- Screen Power -->
        <div class="screen-power-group">
          <BaseButton
            variant="success"
            size="sm"
            icon="🔆"
            :loading="processing && currentOperation === 'screen_on'"
            :disabled="processing"
            @click="handleBatchScreenPower('on')"
            title="Screen On"
          />
          <BaseButton
            variant="default"
            size="sm"
            icon="🌙"
            :loading="processing && currentOperation === 'screen_off'"
            :disabled="processing"
            @click="handleBatchScreenPower('off')"
            title="Screen Off"
          />
        </div>

        <!-- Brightness Presets -->
        <div class="brightness-group">
          <span class="group-label">💡</span>
          <BaseButton
            v-for="preset in brightnessPresets"
            :key="preset.value"
            variant="ghost"
            size="sm"
            :loading="processing && currentOperation === `brightness_${preset.value}`"
            :disabled="processing"
            @click="handleBatchBrightness(preset.value)"
            :title="`Set brightness to ${preset.label}`"
          >
            {{ preset.label }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Results Panel -->
    <div v-if="lastResult" class="result-panel" :class="{ success: lastResult.success }">
      <div class="result-header">
        <span class="result-icon">{{ lastResult.success ? '✅' : '⚠️' }}</span>
        <span class="result-summary">
          {{ lastResult.successfulDevices }}/{{ lastResult.totalDevices }} devices succeeded
        </span>
      </div>
      <div v-if="lastResult.failedDevices > 0" class="result-details">
        <div v-for="result in failedResults" :key="result.serial" class="failed-device">
          <span class="device-serial">{{ result.serial }}</span>
          <span class="error-message">{{ result.error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGroupStore } from '../stores_app_pymatrix/groupStore';
import { useToast } from '../composables_app_pymatrix/useToast';
import { pyMatrixGroupAPI, type BatchOperationResult } from '~/services/api/pymatrix/pymatrix-group-api';
import BaseButton from '~/common/components/ui/BaseButton.vue';

const groupStore = useGroupStore();
const toast = useToast();

const processing = ref(false);
const currentOperation = ref<string>('');
const lastResult = ref<BatchOperationResult | null>(null);
const isRecording = ref(false);

const brightnessPresets = [
  { label: '0%', value: 0 },
  { label: '50%', value: 128 },
  { label: '100%', value: 255 }
];

const failedResults = computed(() => {
  if (!lastResult.value) return [];
  return lastResult.value.results.filter(r => !r.success);
});

async function handleBatchScreenshot() {
  if (!groupStore.groupId || processing.value) return;

  processing.value = true;
  currentOperation.value = 'screenshot';

  try {
    console.log('[GroupBatchOperations] Batch screenshot...', groupStore.groupId);
    const result = await pyMatrixGroupAPI.batchScreenshot(groupStore.groupId, {
      format: 'png'
    });

    lastResult.value = result;
    console.log('[GroupBatchOperations] Batch screenshot result:', result);

    if (result.success) {
      toast.success(`Screenshot saved for ${result.successfulDevices}/${result.totalDevices} devices!`, 'Batch Screenshot');
    } else {
      toast.warning(`Screenshot completed with errors: ${result.failedDevices} devices failed`, 'Batch Screenshot');
    }
  } catch (error) {
    console.error('[GroupBatchOperations] Batch screenshot error:', error);
    toast.error('Failed to perform batch screenshot', 'Batch Screenshot Error');
  } finally {
    processing.value = false;
    currentOperation.value = '';
  }
}

async function handleBatchRecordingStart() {
  if (!groupStore.groupId || processing.value) return;

  processing.value = true;
  currentOperation.value = 'recording_start';

  try {
    console.log('[GroupBatchOperations] Batch recording start...', groupStore.groupId);
    const result = await pyMatrixGroupAPI.batchRecording(groupStore.groupId, {
      action: 'start',
      format: 'mp4',
      quality: 'high'
    });

    lastResult.value = result;
    console.log('[GroupBatchOperations] Batch recording start result:', result);

    if (result.success) {
      isRecording.value = true;
      toast.success(`Recording started for ${result.successfulDevices}/${result.totalDevices} devices!`, 'Batch Recording');
    }
  } catch (error) {
    console.error('[GroupBatchOperations] Batch recording start error:', error);
    toast.error('Failed to start batch recording', 'Batch Recording Error');
  } finally {
    processing.value = false;
    currentOperation.value = '';
  }
}

async function handleBatchRecordingStop() {
  if (!groupStore.groupId || processing.value) return;

  processing.value = true;
  currentOperation.value = 'recording_stop';

  try {
    console.log('[GroupBatchOperations] Batch recording stop...', groupStore.groupId);
    const result = await pyMatrixGroupAPI.batchRecording(groupStore.groupId, {
      action: 'stop'
    });

    lastResult.value = result;
    console.log('[GroupBatchOperations] Batch recording stop result:', result);

    if (result.success) {
      isRecording.value = false;
      toast.success(`Recording stopped for ${result.successfulDevices}/${result.totalDevices} devices!`, 'Batch Recording');
    }
  } catch (error) {
    console.error('[GroupBatchOperations] Batch recording stop error:', error);
    toast.error('Failed to stop batch recording', 'Batch Recording Error');
  } finally {
    processing.value = false;
    currentOperation.value = '';
  }
}

async function handleBatchSystemKey(action: 'home' | 'back' | 'recent') {
  if (!groupStore.groupId || processing.value) return;

  processing.value = true;
  currentOperation.value = action;

  try {
    console.log('[GroupBatchOperations] Batch system key:', action);
    const result = await pyMatrixGroupAPI.batchSystemKey(groupStore.groupId, { action });

    lastResult.value = result;
    console.log('[GroupBatchOperations] Batch system key result:', result);
  } catch (error) {
    console.error('[GroupBatchOperations] Batch system key error:', error);
  } finally {
    processing.value = false;
    currentOperation.value = '';
  }
}

async function handleBatchScreenPower(action: 'on' | 'off') {
  if (!groupStore.groupId || processing.value) return;

  processing.value = true;
  currentOperation.value = `screen_${action}`;

  try {
    console.log('[GroupBatchOperations] Batch screen power:', action);
    const result = await pyMatrixGroupAPI.batchScreenPower(groupStore.groupId, { action });

    lastResult.value = result;
    console.log('[GroupBatchOperations] Batch screen power result:', result);
  } catch (error) {
    console.error('[GroupBatchOperations] Batch screen power error:', error);
    toast.error(`Failed to control screen power: ${error}`, 'Screen Power Error');
  } finally {
    processing.value = false;
    currentOperation.value = '';
  }
}

async function handleBatchBrightness(level: number) {
  if (!groupStore.groupId || processing.value) return;

  processing.value = true;
  currentOperation.value = `brightness_${level}`;

  try {
    console.log('[GroupBatchOperations] Batch brightness:', level);
    const result = await pyMatrixGroupAPI.batchBrightness(groupStore.groupId, { level });

    lastResult.value = result;
    console.log('[GroupBatchOperations] Batch brightness result:', result);
  } catch (error) {
    console.error('[GroupBatchOperations] Batch brightness error:', error);
  } finally {
    processing.value = false;
    currentOperation.value = '';
  }
}
</script>

<style scoped>
.group-batch-operations {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
  animation: slideInUp 0.3s ease-out;
}

.batch-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px;
}

.toolbar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
}

.header-icon {
  font-size: 24px;
}

.header-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  flex: 1;
}

.device-count {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.system-keys-group,
.screen-power-group,
.brightness-group {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.group-label {
  font-size: 14px;
  margin-right: 4px;
}

.result-panel {
  margin-top: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.2);
  border-top: 2px solid rgba(239, 68, 68, 0.5);
}

.result-panel.success {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
  font-weight: 600;
}

.result-icon {
  font-size: 18px;
}

.result-details {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.failed-device {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.device-serial {
  font-weight: 600;
  min-width: 120px;
}

.error-message {
  color: rgba(255, 255, 255, 0.7);
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
