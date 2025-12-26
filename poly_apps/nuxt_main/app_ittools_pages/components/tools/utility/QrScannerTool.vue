<template>
  <div class="qr-scanner-tool">
    <div class="tool-header">
      <h3>QR Code Scanner</h3>
      <p class="tool-description">Scan QR codes from image files or camera</p>
    </div>

    <div class="scanner-tabs">
      <button 
        :class="['tab-btn', { active: activeTab === 'upload' }]"
        @click="activeTab = 'upload'"
      >
        Upload Image
      </button>
      <button 
        :class="['tab-btn', { active: activeTab === 'camera' }]"
        @click="activeTab = 'camera'"
      >
        Use Camera
      </button>
    </div>

    <div v-if="activeTab === 'upload'" class="upload-section">
      <div 
        class="drop-zone"
        :class="{ 'drag-over': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <div class="drop-content">
          <span class="upload-icon">upload</span>
          <p>Drag & drop an image or click to upload</p>
          <p class="hint">Supports PNG, JPG, GIF</p>
        </div>
        <input 
          ref="fileInput" 
          type="file" 
          accept="image/*" 
          @change="handleFileSelect" 
          hidden 
        />
      </div>

      <div v-if="previewUrl" class="preview-section">
        <img :src="previewUrl" alt="QR Code Preview" class="preview-image" />
      </div>
    </div>

    <div v-if="activeTab === 'camera'" class="camera-section">
      <div v-if="!cameraActive" class="camera-prompt">
        <button @click="startCamera" class="btn-primary">Start Camera</button>
      </div>
      <div v-else class="camera-view">
        <video ref="videoEl" autoplay playsinline></video>
        <canvas ref="canvasEl" hidden></canvas>
        <button @click="stopCamera" class="btn-stop">Stop Camera</button>
      </div>
    </div>

    <div v-if="scanning" class="scanning-indicator">
      <span class="spinner"></span>
      Scanning...
    </div>

    <div v-if="result" class="result-section">
      <h4>Scan Result</h4>
      <div class="result-content">
        <div class="result-text">{{ result }}</div>
        <div class="result-actions">
          <button @click="copyResult" class="btn-copy">Copy</button>
          <button v-if="isUrl" @click="openUrl" class="btn-open">Open Link</button>
        </div>
      </div>
      <div v-if="resultType" class="result-type">
        Type: {{ resultType }}
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="copied" class="copy-notification">Copied to clipboard!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';

const activeTab = ref('upload');
const fileInput = ref<HTMLInputElement | null>(null);
const videoEl = ref<HTMLVideoElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const isDragging = ref(false);
const previewUrl = ref('');
const result = ref('');
const error = ref('');
const scanning = ref(false);
const copied = ref(false);
const cameraActive = ref(false);
let stream: MediaStream | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;

const isUrl = computed(() => {
  try {
    new URL(result.value);
    return true;
  } catch {
    return false;
  }
});

const resultType = computed(() => {
  if (!result.value) return '';
  if (isUrl.value) return 'URL';
  if (result.value.startsWith('mailto:')) return 'Email';
  if (result.value.startsWith('tel:')) return 'Phone';
  if (result.value.startsWith('WIFI:')) return 'WiFi';
  if (result.value.startsWith('BEGIN:VCARD')) return 'vCard';
  return 'Text';
});

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) {
    processImage(target.files[0]);
  }
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('image/')) {
    processImage(file);
  }
};

const processImage = async (file: File) => {
  error.value = '';
  result.value = '';
  scanning.value = true;
  
  previewUrl.value = URL.createObjectURL(file);
  
  // Simulated QR decoding (in production, use a library like jsQR)
  setTimeout(() => {
    scanning.value = false;
    // This is a placeholder - real implementation would use jsQR or similar
    result.value = 'https://example.com (QR scanning requires jsQR library)';
  }, 1500);
};

const startCamera = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
      cameraActive.value = true;
      startScanning();
    }
  } catch (err) {
    error.value = 'Could not access camera. Please check permissions.';
  }
};

const stopCamera = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  cameraActive.value = false;
};

const startScanning = () => {
  scanInterval = setInterval(() => {
    if (videoEl.value && canvasEl.value) {
      const canvas = canvasEl.value;
      const video = videoEl.value;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        // Here you would use jsQR to scan the canvas
        // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // const code = jsQR(imageData.data, imageData.width, imageData.height);
      }
    }
  }, 100);
};

const copyResult = async () => {
  await navigator.clipboard.writeText(result.value);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};

const openUrl = () => {
  window.open(result.value, '_blank');
};

onUnmounted(() => {
  stopCamera();
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
});
</script>

<style scoped>
.qr-scanner-tool {
  padding: 20px;
}
.scanner-tabs {
  display: flex;
  gap: 8px;
  margin: 20px 0;
}
.tab-btn {
  flex: 1;
  padding: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}
.tab-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
.drop-zone {
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  padding: 60px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}
.drop-zone:hover, .drop-zone.drag-over {
  border-color: #667eea;
  background: #f8fafc;
}
.drop-content {
  color: #64748b;
}
.upload-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}
.hint {
  font-size: 12px;
  color: #94a3b8;
}
.preview-section {
  margin-top: 20px;
  text-align: center;
}
.preview-image {
  max-width: 300px;
  max-height: 300px;
  border-radius: 8px;
}
.camera-section {
  text-align: center;
}
.camera-view {
  position: relative;
}
.camera-view video {
  max-width: 100%;
  border-radius: 8px;
}
.btn-primary, .btn-stop {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-primary {
  background: #667eea;
  color: white;
}
.btn-stop {
  background: #ef4444;
  color: white;
  margin-top: 12px;
}
.scanning-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  color: #667eea;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.result-section {
  margin-top: 24px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 8px;
}
.result-content {
  display: flex;
  gap: 12px;
  align-items: center;
}
.result-text {
  flex: 1;
  padding: 12px;
  background: white;
  border-radius: 6px;
  word-break: break-all;
  font-family: monospace;
}
.result-actions {
  display: flex;
  gap: 8px;
}
.btn-copy, .btn-open {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-copy {
  background: #667eea;
  color: white;
}
.btn-open {
  background: #22c55e;
  color: white;
}
.result-type {
  margin-top: 12px;
  font-size: 12px;
  color: #64748b;
}
.error-message {
  margin-top: 20px;
  padding: 12px;
  background: #fef2f2;
  color: #ef4444;
  border-radius: 6px;
}
.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #22c55e;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
}
</style>

