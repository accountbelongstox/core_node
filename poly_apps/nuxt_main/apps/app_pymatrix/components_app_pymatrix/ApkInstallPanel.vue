<template>
  <BasePanel
    :show="show"
    title="Install APK"
    icon="📦"
    size="md"
    variant="success"
    @close="handleClose"
  >
    <template #body>
      <div class="apk-install-panel">
        <!-- APK Selection Area -->
        <div
          class="drop-zone"
          :class="{ 'drop-zone-active': isDragging }"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".apk"
            class="file-input"
            @change="handleFileSelect"
          />
          <div class="drop-zone-content">
            <div class="drop-icon">{{ isDragging ? '📥' : '📦' }}</div>
            <div class="drop-text">
              {{ selectedApk ? selectedApk.name : 'Drop APK file here or click to browse' }}
            </div>
            <div v-if="selectedApk" class="file-info">
              {{ formatFileSize(selectedApk.size) }}
            </div>
          </div>
        </div>

        <!-- Install Options -->
        <div class="install-options">
          <BaseToggle
            v-model="reinstall"
            label="Reinstall if exists"
            description="Replace existing app with the same package name"
            icon="🔄"
            size="sm"
          />
          <BaseToggle
            v-model="grantPermissions"
            label="Grant all permissions"
            description="Automatically grant runtime permissions"
            icon="🔓"
            size="sm"
          />
        </div>

        <!-- Install Progress -->
        <div v-if="installProgress" class="install-progress">
          <div class="progress-header">
            <span class="progress-label">
              {{ getProgressLabel(installProgress.status) }}
            </span>
            <span class="progress-percent">{{ installProgress.progress }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="{ 'progress-installing': installProgress.status === 'installing' }"
              :style="{ width: `${installProgress.progress}%` }"
            ></div>
          </div>
          <div v-if="installProgress.message" class="progress-message">
            {{ installProgress.message }}
          </div>
        </div>

        <!-- Result Message -->
        <div v-if="resultMessage" class="result-message" :class="resultType">
          <span class="result-icon">{{ resultType === 'success' ? '✅' : '❌' }}</span>
          <div class="result-content">
            <div class="result-text">{{ resultMessage }}</div>
            <div v-if="installedPackage" class="package-info">
              <div class="package-name">{{ installedPackage.packageName }}</div>
              <div class="package-version">
                Version {{ installedPackage.versionName }} ({{ installedPackage.versionCode }})
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="panel-actions">
        <BaseButton
          variant="default"
          @click="handleClose"
        >
          Cancel
        </BaseButton>
        <BaseButton
          variant="success"
          :loading="installing"
          :disabled="!selectedApk || installing"
          @click="handleInstall"
        >
          {{ installing ? 'Installing...' : 'Install APK' }}
        </BaseButton>
      </div>
    </template>
  </BasePanel>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BasePanel from '~/common/components/ui/BasePanel.vue';
import BaseButton from '~/common/components/ui/BaseButton.vue';
import BaseToggle from '~/common/components/ui/BaseToggle.vue';
import { pyMatrixFileAPI, type ApkInstallProgress } from '~/services/api/pymatrix/pymatrix-file-api';

const props = defineProps<{
  show: boolean;
  deviceSerial: string;
}>();

const emit = defineEmits<{
  close: [];
  success: [packageName: string];
}>();

const fileInput = ref<HTMLInputElement>();
const selectedApk = ref<File | null>(null);
const reinstall = ref(false);
const grantPermissions = ref(true);
const isDragging = ref(false);
const installing = ref(false);
const installProgress = ref<ApkInstallProgress | null>(null);
const resultMessage = ref('');
const resultType = ref<'success' | 'error'>('success');
const installedPackage = ref<{
  packageName: string;
  versionName: string;
  versionCode: number;
} | null>(null);

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
    const file = files[0];
    if (file.name.endsWith('.apk')) {
      selectedApk.value = file;
    } else {
      resultMessage.value = 'Please select a valid APK file';
      resultType.value = 'error';
    }
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    if (file.name.endsWith('.apk')) {
      selectedApk.value = file;
      resultMessage.value = '';
    } else {
      resultMessage.value = 'Please select a valid APK file';
      resultType.value = 'error';
    }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

function getProgressLabel(status: ApkInstallProgress['status']): string {
  switch (status) {
    case 'uploading':
      return 'Uploading APK...';
    case 'installing':
      return 'Installing...';
    case 'completed':
      return 'Installation completed';
    case 'failed':
      return 'Installation failed';
    default:
      return 'Processing...';
  }
}

async function handleInstall() {
  if (!selectedApk.value) return;

  installing.value = true;
  installProgress.value = null;
  resultMessage.value = '';
  installedPackage.value = null;

  try {
    console.log('[ApkInstallPanel] Installing APK:', selectedApk.value.name);

    const result = await pyMatrixFileAPI.installApk(
      props.deviceSerial,
      {
        apkPath: selectedApk.value as any,
        reinstall: reinstall.value,
        grantPermissions: grantPermissions.value
      },
      (progress) => {
        installProgress.value = progress;
      }
    );

    if (result.success) {
      resultMessage.value = 'APK installed successfully';
      resultType.value = 'success';

      if (result.packageName) {
        installedPackage.value = {
          packageName: result.packageName,
          versionName: result.versionName || 'Unknown',
          versionCode: result.versionCode || 0
        };
        emit('success', result.packageName);
      }

      // Auto close after 3 seconds
      setTimeout(() => {
        handleClose();
      }, 3000);
    } else {
      resultMessage.value = `Installation failed: ${result.error}`;
      resultType.value = 'error';
    }
  } catch (error) {
    console.error('[ApkInstallPanel] Install error:', error);
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    resultType.value = 'error';
  } finally {
    installing.value = false;
  }
}

function handleClose() {
  // Reset state
  selectedApk.value = null;
  reinstall.value = false;
  grantPermissions.value = true;
  installProgress.value = null;
  resultMessage.value = '';
  installing.value = false;
  installedPackage.value = null;

  emit('close');
}
</script>

<style scoped>
.apk-install-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 400px;
}

/* Drop Zone */
.drop-zone {
  border: 2px dashed rgba(34, 197, 94, 0.3);
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(34, 197, 94, 0.05);
}

.drop-zone:hover,
.drop-zone-active {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

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

/* Install Options */
.install-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Install Progress */
.install-progress {
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
  color: #22c55e;
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
  background: linear-gradient(90deg, #22c55e, #4ade80);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.progress-installing {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.progress-message {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
}

/* Result Message */
.result-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
}

.result-message.success {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.result-message.error {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.result-icon {
  font-size: 16px;
  margin-top: 2px;
}

.result-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-text {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.package-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.package-name {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-family: monospace;
}

.package-version {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

/* Panel Actions */
.panel-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
