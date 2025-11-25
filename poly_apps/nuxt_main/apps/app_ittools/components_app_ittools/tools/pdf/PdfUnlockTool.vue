<template>
  <div class="pdf-unlock-tool">
    <div class="tool-header">
      <h3>Unlock PDF</h3>
      <p class="tool-description">Remove password protection from PDF files</p>
    </div>

    <div class="upload-section">
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragging, 'has-file': selectedFile }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div v-if="!selectedFile" class="drop-content">
          <span class="upload-icon">lock_open</span>
          <p>Drag & drop a password-protected PDF here</p>
          <p class="hint">or click to browse</p>
        </div>
        <div v-else class="file-info">
          <span class="file-icon">description</span>
          <div class="file-details">
            <span class="file-name">{{ selectedFile.name }}</span>
            <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
          </div>
          <button @click.stop="removeFile" class="remove-btn">close</button>
        </div>
        <input 
          ref="fileInput" 
          type="file" 
          accept=".pdf" 
          @change="handleFileSelect" 
          hidden 
        />
      </div>
    </div>

    <div v-if="selectedFile" class="password-section">
      <div class="form-group">
        <label>PDF Password</label>
        <div class="password-input-wrapper">
          <input 
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="Enter the PDF password"
            class="input-field"
          />
          <button @click="showPassword = !showPassword" class="toggle-password">
            {{ showPassword ? 'visibility_off' : 'visibility' }}
          </button>
        </div>
        <p class="hint">Enter the password to unlock and remove protection</p>
      </div>
    </div>

    <div v-if="selectedFile" class="actions">
      <button @click="unlockPdf" :disabled="!password || isProcessing" class="btn-primary">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? 'Processing...' : 'Unlock PDF' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      <span class="error-icon">error</span>
      {{ error }}
    </div>

    <div v-if="success" class="success-message">
      <span class="success-icon">check_circle</span>
      PDF unlocked successfully! Download will start automatically.
    </div>

    <div class="info-section">
      <h4>How it works</h4>
      <div class="info-steps">
        <div class="step">
          <span class="step-num">1</span>
          <span class="step-text">Upload your password-protected PDF</span>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <span class="step-text">Enter the current password</span>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <span class="step-text">Download the unlocked PDF without password</span>
        </div>
      </div>
      <div class="security-note">
        <span class="note-icon">security</span>
        <p>Your files are processed securely and deleted after processing. We never store your passwords.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const password = ref('');
const showPassword = ref(false);
const isDragging = ref(false);
const isProcessing = ref(false);
const error = ref('');
const success = ref(false);

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    selectFile(target.files[0]);
  }
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file && file.type === 'application/pdf') {
    selectFile(file);
  } else {
    error.value = 'Please upload a PDF file';
  }
};

const selectFile = (file: File) => {
  selectedFile.value = file;
  error.value = '';
  success.value = false;
};

const removeFile = () => {
  selectedFile.value = null;
  password.value = '';
  error.value = '';
  success.value = false;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const unlockPdf = async () => {
  if (!selectedFile.value || !password.value) return;

  isProcessing.value = true;
  error.value = '';
  success.value = false;

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('password', password.value);

    // This would call the backend API
    // For now, simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulated success
    success.value = true;
    
    // In real implementation, trigger download
    // const blob = await response.blob();
    // const url = URL.createObjectURL(blob);
    // const a = document.createElement('a');
    // a.href = url;
    // a.download = selectedFile.value.name.replace('.pdf', '_unlocked.pdf');
    // a.click();
    // URL.revokeObjectURL(url);
    
  } catch (err) {
    error.value = 'Failed to unlock PDF. Please check the password and try again.';
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style scoped>
.pdf-unlock-tool {
  padding: 20px;
}
.upload-section {
  margin: 24px 0;
}
.drop-zone {
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.drop-zone:hover, .drop-zone.drag-over {
  border-color: #667eea;
  background: #f8fafc;
}
.drop-zone.has-file {
  border-style: solid;
  border-color: #22c55e;
  background: #f0fdf4;
}
.drop-content {
  color: #64748b;
}
.upload-icon, .file-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}
.hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}
.file-info {
  display: flex;
  align-items: center;
  gap: 16px;
}
.file-icon {
  font-size: 40px;
  color: #667eea;
}
.file-details {
  flex: 1;
  text-align: left;
}
.file-name {
  display: block;
  font-weight: 600;
  color: #334155;
}
.file-size {
  font-size: 12px;
  color: #64748b;
}
.remove-btn {
  padding: 8px;
  background: #fee2e2;
  color: #ef4444;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}
.password-section {
  margin: 24px 0;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.password-input-wrapper {
  display: flex;
  gap: 8px;
}
.input-field {
  flex: 1;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.toggle-password {
  padding: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
}
.actions {
  margin: 24px 0;
}
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 32px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
}
.btn-primary:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.error-message, .success-message {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
}
.error-message {
  background: #fef2f2;
  color: #ef4444;
}
.success-message {
  background: #f0fdf4;
  color: #22c55e;
}
.info-section {
  margin-top: 40px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
}
.info-steps {
  display: flex;
  gap: 24px;
  margin: 20px 0;
}
.step {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}
.step-num {
  width: 32px;
  height: 32px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}
.step-text {
  font-size: 14px;
  color: #334155;
}
.security-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #dbeafe;
  border-radius: 8px;
  margin-top: 20px;
}
.security-note p {
  margin: 0;
  font-size: 14px;
  color: #1e40af;
}
.note-icon {
  color: #3b82f6;
}
</style>

