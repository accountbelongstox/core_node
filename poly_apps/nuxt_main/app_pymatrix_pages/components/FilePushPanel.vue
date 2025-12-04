<template>
  <BasePanel
    :model-value="show"
    title="Push File to Device"
    icon="📁"
    size="md"
    variant="primary"
    @close="handleClose"
  >
    <template #body>
      <div class="pm-panel pm-panel--blue">
        <!-- File Selection Area -->
        <div
          class="pm-file-upload"
          :class="{ 'drop-zone-active': isDragging }"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            class="file-input"
            @change="handleFileSelect"
          />
          <div class="drop-zone-content">
            <div class="drop-icon">{{ isDragging ? '📥' : '📤' }}</div>
            <div class="drop-text">
              {{ selectedFile ? selectedFile.name : 'Drop file here or click to browse' }}
            </div>
            <div v-if="selectedFile" class="file-info">
              {{ formatFileSize(selectedFile.size) }}
            </div>
          </div>
        </div>

        <!-- Target Path Input -->
        <div class="form-group">
          <label class="form-label">Target Path on Device</label>
          <div class="path-input-group">
            <input
              v-model="targetPath"
              type="text"
              class="path-input"
              placeholder="/sdcard/Download/"
              @keyup.enter="handlePush"
            />
            <BaseButton
              variant="ghost"
              size="sm"
              @click="targetPath = '/sdcard/Download/'"
            >
              Download
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="sm"
              @click="targetPath = '/sdcard/Documents/'"
            >
              Documents
            </BaseButton>
          </div>
        </div>

        <!-- Options -->
        <div class="form-group">
          <BaseToggle
            v-model="overwrite"
            label="Overwrite if exists"
            description="Replace existing file with the same name"
            size="sm"
          />
        </div>

        <!-- Upload Progress -->
        <div v-if="uploadProgress" class="upload-progress">
          <div class="progress-header">
            <span class="progress-label">Uploading...</span>
            <span class="progress-percent">{{ uploadProgress.progress }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${uploadProgress.progress}%` }"
            ></div>
          </div>
          <div class="progress-stats">
            <span>{{ formatFileSize(uploadProgress.uploadedBytes) }} / {{ formatFileSize(uploadProgress.fileSize) }}</span>
            <span>{{ formatSpeed(uploadProgress.speed) }}</span>
            <span v-if="uploadProgress.estimatedTimeRemaining > 0">
              {{ formatTime(uploadProgress.estimatedTimeRemaining) }} remaining
            </span>
          </div>
        </div>

        <!-- Result Message -->
        <div v-if="resultMessage" class="result-message" :class="resultType">
          <span class="result-icon">{{ resultType === 'success' ? '✅' : '❌' }}</span>
          <span class="result-text">{{ resultMessage }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="panel-actions">
        <button
          class="pm-button pm-button--default"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          class="pm-button pm-button--ocean"
          :disabled="!selectedFile || !targetPath || uploading"
          @click="handlePush"
        >
          {{ uploading ? 'Uploading...' : 'Push File' }}
        </button>
      </div>
    </template>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';
import { pyMatrixFileAPI, type FileUploadProgress } from '~/services/api/pymatrix/pymatrix-file-api';

const props = defineProps<{
  show: boolean;
  deviceSerial: string;
}>();

const emit = defineEmits<{
  close: [];
  success: [filePath: string];
}>();

const fileInput = ref<HTMLInputElement>();
const selectedFile = ref<File | null>(null);
const targetPath = ref('/sdcard/Download/');
const overwrite = ref(false);
const isDragging = ref(false);
const uploading = ref(false);
const uploadProgress = ref<FileUploadProgress | null>(null);
const resultMessage = ref('');
const resultType = ref<'success' | 'error'>('success');

function handleDragOver(event: DragEvent) {
  isDragging.value = true;
}

function handleDragLeave(event: DragEvent) {
  isDragging.value = false;
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    selectedFile.value = files[0];
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0];
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

async function handlePush() {
  if (!selectedFile.value || !targetPath.value) return;

  uploading.value = true;
  uploadProgress.value = null;
  resultMessage.value = '';

  try {
    console.log('[FilePushPanel] Pushing file:', selectedFile.value.name, 'to', targetPath.value);

    const result = await pyMatrixFileAPI.pushFile(
      props.deviceSerial,
      {
        filePath: selectedFile.value as any,
        targetPath: targetPath.value,
        overwrite: overwrite.value
      },
      (progress) => {
        uploadProgress.value = progress;
      }
    );

    if (result.success) {
      resultMessage.value = `File pushed successfully to ${result.targetPath}`;
      resultType.value = 'success';
      emit('success', result.targetPath!);

      // Auto close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } else {
      resultMessage.value = `Failed to push file: ${result.error}`;
      resultType.value = 'error';
    }
  } catch (error) {
    console.error('[FilePushPanel] Push error:', error);
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    resultType.value = 'error';
  } finally {
    uploading.value = false;
  }
}

function handleClose() {
  // Reset state
  selectedFile.value = null;
  targetPath.value = '/sdcard/Download/';
  overwrite.value = false;
  uploadProgress.value = null;
  resultMessage.value = '';
  uploading.value = false;

  emit('close');
}
</script>

<style scoped>
.file-input {
  display: none;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.drop-icon {
  font-size: 48px;
}

.drop-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.file-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.path-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.path-input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.path-input:focus {
  background: rgba(255, 255, 255, 0.15);
  border-color: #3b82f6;
}

.path-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.upload-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.progress-percent {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-stats {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.result-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
}

.result-message.success {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.result-message.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.result-icon {
  font-size: 16px;
}

.panel-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
