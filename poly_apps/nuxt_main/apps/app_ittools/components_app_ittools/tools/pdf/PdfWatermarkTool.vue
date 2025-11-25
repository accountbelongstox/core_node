<template>
  <div class="pdf-watermark-tool">
    <div class="tool-header">
      <h3>PDF Watermark</h3>
      <p class="tool-description">Add text or image watermarks to PDF files</p>
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
          <span class="upload-icon">water_drop</span>
          <p>Drag & drop a PDF file here</p>
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

    <div v-if="selectedFile" class="watermark-options">
      <div class="tabs">
        <button 
          :class="['tab-btn', { active: watermarkType === 'text' }]"
          @click="watermarkType = 'text'"
        >
          Text Watermark
        </button>
        <button 
          :class="['tab-btn', { active: watermarkType === 'image' }]"
          @click="watermarkType = 'image'"
        >
          Image Watermark
        </button>
      </div>

      <div v-if="watermarkType === 'text'" class="text-options">
        <div class="form-group">
          <label>Watermark Text</label>
          <input 
            type="text" 
            v-model="textOptions.text" 
            placeholder="e.g., CONFIDENTIAL, DRAFT, Copyright"
            class="input-field"
          />
        </div>
        <div class="options-row">
          <div class="form-group">
            <label>Font Size</label>
            <input type="number" v-model.number="textOptions.fontSize" min="8" max="200" class="input-field small" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" v-model="textOptions.color" class="color-input" />
          </div>
          <div class="form-group">
            <label>Opacity</label>
            <input type="range" v-model.number="textOptions.opacity" min="0" max="100" class="range-input" />
            <span class="range-value">{{ textOptions.opacity }}%</span>
          </div>
        </div>
        <div class="options-row">
          <div class="form-group">
            <label>Rotation</label>
            <input type="range" v-model.number="textOptions.rotation" min="-180" max="180" class="range-input" />
            <span class="range-value">{{ textOptions.rotation }}deg</span>
          </div>
        </div>
      </div>

      <div v-else class="image-options">
        <div 
          class="image-upload"
          @click="triggerImageInput"
          :class="{ 'has-image': watermarkImage }"
        >
          <div v-if="!watermarkImage">
            <span class="upload-icon">image</span>
            <p>Upload watermark image</p>
          </div>
          <img v-else :src="watermarkImagePreview" alt="Watermark" class="preview-image" />
          <input 
            ref="imageInput" 
            type="file" 
            accept="image/*" 
            @change="handleImageSelect" 
            hidden 
          />
        </div>
        <div class="form-group">
          <label>Opacity</label>
          <input type="range" v-model.number="imageOptions.opacity" min="0" max="100" class="range-input" />
          <span class="range-value">{{ imageOptions.opacity }}%</span>
        </div>
        <div class="form-group">
          <label>Scale</label>
          <input type="range" v-model.number="imageOptions.scale" min="10" max="200" class="range-input" />
          <span class="range-value">{{ imageOptions.scale }}%</span>
        </div>
      </div>

      <div class="position-options">
        <label>Position</label>
        <div class="position-grid">
          <button 
            v-for="pos in positions" 
            :key="pos.value"
            :class="['position-btn', { active: position === pos.value }]"
            @click="position = pos.value"
          >
            {{ pos.label }}
          </button>
        </div>
      </div>

      <div class="page-options">
        <label>Apply to Pages</label>
        <div class="page-buttons">
          <button 
            :class="['page-btn', { active: pageOption === 'all' }]"
            @click="pageOption = 'all'"
          >
            All Pages
          </button>
          <button 
            :class="['page-btn', { active: pageOption === 'first' }]"
            @click="pageOption = 'first'"
          >
            First Page
          </button>
          <button 
            :class="['page-btn', { active: pageOption === 'custom' }]"
            @click="pageOption = 'custom'"
          >
            Custom
          </button>
        </div>
        <input 
          v-if="pageOption === 'custom'"
          type="text" 
          v-model="customPages"
          placeholder="e.g., 1,3,5-10"
          class="input-field"
        />
      </div>
    </div>

    <div v-if="selectedFile" class="actions">
      <button @click="addWatermark" :disabled="isProcessing" class="btn-primary">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? 'Processing...' : 'Add Watermark' }}
      </button>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const fileInput = ref<HTMLInputElement | null>(null);
const imageInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const watermarkImage = ref<File | null>(null);
const watermarkImagePreview = ref('');
const isDragging = ref(false);
const isProcessing = ref(false);
const error = ref('');

const watermarkType = ref('text');
const position = ref('center');
const pageOption = ref('all');
const customPages = ref('');

const textOptions = reactive({
  text: 'CONFIDENTIAL',
  fontSize: 48,
  color: '#ff0000',
  opacity: 30,
  rotation: -45
});

const imageOptions = reactive({
  opacity: 30,
  scale: 100
});

const positions = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center-left', label: 'Center Left' },
  { value: 'center', label: 'Center' },
  { value: 'center-right', label: 'Center Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' }
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const triggerFileInput = () => fileInput.value?.click();
const triggerImageInput = () => imageInput.value?.click();

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    selectedFile.value = target.files[0];
    error.value = '';
  }
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file && file.type === 'application/pdf') {
    selectedFile.value = file;
    error.value = '';
  }
};

const handleImageSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    watermarkImage.value = target.files[0];
    watermarkImagePreview.value = URL.createObjectURL(target.files[0]);
  }
};

const removeFile = () => {
  selectedFile.value = null;
  error.value = '';
};

const addWatermark = async () => {
  if (!selectedFile.value) return;
  if (watermarkType.value === 'text' && !textOptions.text) {
    error.value = 'Please enter watermark text';
    return;
  }
  if (watermarkType.value === 'image' && !watermarkImage.value) {
    error.value = 'Please upload a watermark image';
    return;
  }

  isProcessing.value = true;
  error.value = '';

  try {
    // This would call the backend API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Trigger download
    alert('Watermark added successfully! (Backend integration needed)');
  } catch (err) {
    error.value = 'Failed to add watermark. Please try again.';
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style scoped>
.pdf-watermark-tool {
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
.upload-icon, .file-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}
.file-info {
  display: flex;
  align-items: center;
  gap: 16px;
}
.file-details {
  flex: 1;
  text-align: left;
}
.file-name {
  display: block;
  font-weight: 600;
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
.watermark-options {
  margin: 24px 0;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}
.tab-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
}
.tab-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.input-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.input-field.small {
  width: 100px;
}
.options-row {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.color-input {
  width: 60px;
  height: 40px;
  border: none;
  cursor: pointer;
}
.range-input {
  width: 150px;
}
.range-value {
  font-size: 12px;
  color: #64748b;
  margin-left: 8px;
}
.image-upload {
  border: 2px dashed #e2e8f0;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  margin-bottom: 16px;
}
.image-upload.has-image {
  padding: 10px;
  border-style: solid;
}
.preview-image {
  max-width: 200px;
  max-height: 150px;
}
.position-options {
  margin: 24px 0;
}
.position-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.position-btn {
  padding: 10px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.position-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
.page-options {
  margin: 24px 0;
}
.page-buttons {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.page-btn {
  padding: 10px 20px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}
.page-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
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
.error-message {
  padding: 16px;
  background: #fef2f2;
  color: #ef4444;
  border-radius: 8px;
}
.hint {
  font-size: 12px;
  color: #94a3b8;
}
</style>

