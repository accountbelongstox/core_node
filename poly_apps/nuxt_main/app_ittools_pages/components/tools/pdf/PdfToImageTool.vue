<template>
  <div class="pdf-to-image-tool">
    <div class="tool-header">
      <h3>PDF to Image</h3>
      <p class="tool-description">Convert PDF pages to JPG or PNG images</p>
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
          <span class="upload-icon">picture_as_pdf</span>
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

    <div v-if="selectedFile" class="options-section">
      <div class="option-group">
        <label>Output Format</label>
        <div class="format-buttons">
          <button 
            :class="['format-btn', { active: outputFormat === 'jpg' }]"
            @click="outputFormat = 'jpg'"
          >
            <span class="format-icon">image</span>
            JPG
          </button>
          <button 
            :class="['format-btn', { active: outputFormat === 'png' }]"
            @click="outputFormat = 'png'"
          >
            <span class="format-icon">image</span>
            PNG
          </button>
        </div>
      </div>

      <div class="option-group">
        <label>Image Quality</label>
        <div class="quality-options">
          <button 
            v-for="q in qualities" 
            :key="q.value"
            :class="['quality-btn', { active: quality === q.value }]"
            @click="quality = q.value"
          >
            <span class="quality-label">{{ q.label }}</span>
            <span class="quality-desc">{{ q.desc }}</span>
          </button>
        </div>
      </div>

      <div class="option-group">
        <label>Pages to Convert</label>
        <div class="page-options">
          <label class="radio-option">
            <input type="radio" v-model="pageOption" value="all" />
            All Pages
          </label>
          <label class="radio-option">
            <input type="radio" v-model="pageOption" value="range" />
            Page Range
          </label>
        </div>
        <input 
          v-if="pageOption === 'range'"
          type="text" 
          v-model="pageRange"
          placeholder="e.g., 1-5 or 1,3,5"
          class="input-field"
        />
      </div>

      <div class="option-group">
        <label>DPI (Resolution)</label>
        <select v-model.number="dpi" class="select-field">
          <option :value="72">72 DPI (Screen)</option>
          <option :value="150">150 DPI (Standard)</option>
          <option :value="300">300 DPI (Print Quality)</option>
          <option :value="600">600 DPI (High Quality)</option>
        </select>
      </div>
    </div>

    <div v-if="selectedFile" class="actions">
      <button @click="convertPdf" :disabled="isProcessing" class="btn-primary">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? 'Converting...' : 'Convert to Images' }}
      </button>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>

    <div v-if="convertedImages.length > 0" class="results-section">
      <h4>Converted Images</h4>
      <div class="images-grid">
        <div v-for="(img, index) in convertedImages" :key="index" class="image-card">
          <div class="image-preview">
            <img :src="img.url" :alt="`Page ${index + 1}`" />
          </div>
          <div class="image-info">
            <span>Page {{ index + 1 }}</span>
            <button @click="downloadImage(img)" class="download-btn">Download</button>
          </div>
        </div>
      </div>
      <button @click="downloadAll" class="btn-secondary">Download All as ZIP</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const isDragging = ref(false);
const isProcessing = ref(false);
const error = ref('');

const outputFormat = ref('jpg');
const quality = ref('standard');
const pageOption = ref('all');
const pageRange = ref('');
const dpi = ref(150);

interface ConvertedImage {
  url: string;
  filename: string;
}

const convertedImages = ref<ConvertedImage[]>([]);

const qualities = [
  { value: 'low', label: 'Low', desc: 'Smaller file size' },
  { value: 'standard', label: 'Standard', desc: 'Balanced quality' },
  { value: 'high', label: 'High', desc: 'Best quality' }
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const triggerFileInput = () => fileInput.value?.click();

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    selectedFile.value = target.files[0];
    error.value = '';
    convertedImages.value = [];
  }
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file && file.type === 'application/pdf') {
    selectedFile.value = file;
    error.value = '';
    convertedImages.value = [];
  }
};

const removeFile = () => {
  selectedFile.value = null;
  convertedImages.value = [];
  error.value = '';
};

const convertPdf = async () => {
  if (!selectedFile.value) return;

  isProcessing.value = true;
  error.value = '';

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('format', outputFormat.value);
    formData.append('quality', quality.value);
    formData.append('dpi', dpi.value.toString());
    formData.append('pages', pageOption.value === 'all' ? 'all' : pageRange.value);

    // This would call the backend API
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulated results - backend would return actual images
    convertedImages.value = [
      { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', filename: 'page_1.jpg' },
    ];
    
  } catch (err) {
    error.value = 'Failed to convert PDF. Please try again.';
  } finally {
    isProcessing.value = false;
  }
};

const downloadImage = (img: ConvertedImage) => {
  const a = document.createElement('a');
  a.href = img.url;
  a.download = img.filename;
  a.click();
};

const downloadAll = () => {
  // In real implementation, this would create a ZIP
  alert('Download all as ZIP (requires backend)');
};
</script>

<style scoped>
.pdf-to-image-tool {
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
.options-section {
  margin: 24px 0;
}
.option-group {
  margin-bottom: 24px;
}
.option-group label {
  display: block;
  margin-bottom: 12px;
  font-weight: 500;
}
.format-buttons {
  display: flex;
  gap: 12px;
}
.format-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.format-btn.active {
  border-color: #667eea;
  background: #f0f4ff;
}
.format-icon {
  font-size: 32px;
  color: #667eea;
}
.quality-options {
  display: flex;
  gap: 12px;
}
.quality-btn {
  flex: 1;
  padding: 16px;
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
}
.quality-btn.active {
  border-color: #667eea;
  background: #f0f4ff;
}
.quality-label {
  display: block;
  font-weight: 600;
}
.quality-desc {
  font-size: 12px;
  color: #64748b;
}
.page-options {
  display: flex;
  gap: 20px;
  margin-bottom: 12px;
}
.radio-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.input-field, .select-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.actions {
  margin: 24px 0;
}
.btn-primary, .btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 32px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.btn-primary {
  background: #667eea;
  color: white;
}
.btn-secondary {
  background: #e2e8f0;
  color: #334155;
  margin-top: 16px;
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
.results-section {
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid #e2e8f0;
}
.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin: 16px 0;
}
.image-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.image-preview {
  aspect-ratio: 3/4;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-preview img {
  max-width: 100%;
  max-height: 100%;
}
.image-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8fafc;
}
.download-btn {
  padding: 6px 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.hint {
  font-size: 12px;
  color: #94a3b8;
}
</style>

