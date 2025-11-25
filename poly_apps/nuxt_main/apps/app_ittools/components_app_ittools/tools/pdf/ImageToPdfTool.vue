<template>
  <div class="image-to-pdf-tool">
    <div class="tool-header">
      <h3>Image to PDF</h3>
      <p class="tool-description">Convert images to PDF documents</p>
    </div>

    <div class="upload-section">
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <span class="upload-icon">add_photo_alternate</span>
        <p>Drag & drop images here</p>
        <p class="hint">Supports JPG, PNG, GIF, WEBP</p>
        <input 
          ref="fileInput" 
          type="file" 
          accept="image/*" 
          multiple
          @change="handleFileSelect" 
          hidden 
        />
      </div>
    </div>

    <div v-if="images.length > 0" class="images-section">
      <div class="images-header">
        <h4>Selected Images ({{ images.length }})</h4>
        <button @click="clearAll" class="btn-clear">Clear All</button>
      </div>
      
      <div class="images-list">
        <div 
          v-for="(img, index) in images" 
          :key="img.id"
          class="image-item"
          draggable="true"
          @dragstart="dragStart(index)"
          @dragover.prevent
          @drop="drop(index)"
        >
          <span class="drag-handle">drag_indicator</span>
          <div class="image-preview">
            <img :src="img.preview" :alt="img.file.name" />
          </div>
          <div class="image-info">
            <span class="image-name">{{ img.file.name }}</span>
            <span class="image-size">{{ formatFileSize(img.file.size) }}</span>
          </div>
          <button @click="removeImage(index)" class="remove-btn">close</button>
        </div>
      </div>

      <button @click="addMoreImages" class="btn-add-more">
        + Add More Images
      </button>
    </div>

    <div v-if="images.length > 0" class="options-section">
      <h4>PDF Options</h4>
      
      <div class="options-grid">
        <div class="option-group">
          <label>Page Size</label>
          <select v-model="options.pageSize" class="select-field">
            <option value="A4">A4 (210 x 297 mm)</option>
            <option value="Letter">Letter (8.5 x 11 in)</option>
            <option value="A3">A3 (297 x 420 mm)</option>
            <option value="fit">Fit to Image</option>
          </select>
        </div>

        <div class="option-group">
          <label>Orientation</label>
          <div class="orientation-buttons">
            <button 
              :class="['orient-btn', { active: options.orientation === 'portrait' }]"
              @click="options.orientation = 'portrait'"
            >
              Portrait
            </button>
            <button 
              :class="['orient-btn', { active: options.orientation === 'landscape' }]"
              @click="options.orientation = 'landscape'"
            >
              Landscape
            </button>
          </div>
        </div>

        <div class="option-group">
          <label>Margin</label>
          <select v-model="options.margin" class="select-field">
            <option value="none">No Margin</option>
            <option value="small">Small (5mm)</option>
            <option value="medium">Medium (10mm)</option>
            <option value="large">Large (20mm)</option>
          </select>
        </div>

        <div class="option-group">
          <label>Image Fit</label>
          <select v-model="options.imageFit" class="select-field">
            <option value="contain">Fit (Contain)</option>
            <option value="cover">Fill (Cover)</option>
            <option value="stretch">Stretch</option>
          </select>
        </div>
      </div>

      <div class="checkbox-options">
        <label class="checkbox-option">
          <input type="checkbox" v-model="options.oneImagePerPage" />
          One image per page
        </label>
        <label class="checkbox-option">
          <input type="checkbox" v-model="options.addPageNumbers" />
          Add page numbers
        </label>
      </div>
    </div>

    <div v-if="images.length > 0" class="actions">
      <button @click="convertToPdf" :disabled="isProcessing" class="btn-primary">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? 'Creating PDF...' : 'Create PDF' }}
      </button>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const isProcessing = ref(false);
const error = ref('');
let draggedIndex = -1;

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

const images = ref<ImageItem[]>([]);

const options = reactive({
  pageSize: 'A4',
  orientation: 'portrait',
  margin: 'medium',
  imageFit: 'contain',
  oneImagePerPage: true,
  addPageNumbers: false
});

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const triggerFileInput = () => fileInput.value?.click();

const addMoreImages = () => fileInput.value?.click();

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    addImages(Array.from(target.files));
    target.value = '';
  }
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  if (e.dataTransfer?.files) {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addImages(files);
  }
};

const addImages = (files: File[]) => {
  error.value = '';
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      images.value.push({
        id: Math.random().toString(36).substring(7),
        file,
        preview: e.target?.result as string
      });
    };
    reader.readAsDataURL(file);
  });
};

const removeImage = (index: number) => {
  images.value.splice(index, 1);
};

const clearAll = () => {
  images.value = [];
};

const dragStart = (index: number) => {
  draggedIndex = index;
};

const drop = (index: number) => {
  if (draggedIndex === -1) return;
  const item = images.value[draggedIndex];
  images.value.splice(draggedIndex, 1);
  images.value.splice(index, 0, item);
  draggedIndex = -1;
};

const convertToPdf = async () => {
  if (images.value.length === 0) return;

  isProcessing.value = true;
  error.value = '';

  try {
    const formData = new FormData();
    images.value.forEach((img, i) => {
      formData.append(`images[${i}]`, img.file);
    });
    formData.append('options', JSON.stringify(options));

    // This would call the backend API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    alert('PDF created successfully! (Backend integration needed)');
    
  } catch (err) {
    error.value = 'Failed to create PDF. Please try again.';
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style scoped>
.image-to-pdf-tool {
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
.upload-icon {
  font-size: 48px;
  color: #667eea;
  display: block;
  margin-bottom: 12px;
}
.hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}
.images-section {
  margin: 24px 0;
}
.images-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.btn-clear {
  padding: 6px 12px;
  background: #fee2e2;
  color: #ef4444;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.images-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.image-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  cursor: grab;
}
.image-item:active {
  cursor: grabbing;
}
.drag-handle {
  color: #94a3b8;
  cursor: grab;
}
.image-preview {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-info {
  flex: 1;
  min-width: 0;
}
.image-name {
  display: block;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.image-size {
  font-size: 12px;
  color: #64748b;
}
.remove-btn {
  padding: 6px;
  background: transparent;
  color: #94a3b8;
  border: none;
  cursor: pointer;
}
.remove-btn:hover {
  color: #ef4444;
}
.btn-add-more {
  width: 100%;
  padding: 12px;
  margin-top: 12px;
  border: 2px dashed #e2e8f0;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: #64748b;
}
.options-section {
  margin: 24px 0;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
}
.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 16px;
}
.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.option-group label {
  font-weight: 500;
}
.select-field {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.orientation-buttons {
  display: flex;
  gap: 8px;
}
.orient-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}
.orient-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
.checkbox-options {
  display: flex;
  gap: 24px;
  margin-top: 20px;
}
.checkbox-option {
  display: flex;
  align-items: center;
  gap: 8px;
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
  width: 100%;
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
</style>

