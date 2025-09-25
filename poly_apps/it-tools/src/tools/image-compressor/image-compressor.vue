<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMessage } from 'naive-ui';
import { useCopy } from '@/composable/copy';
import { imageCompressionService, type CompressionOptions } from './image-compressor.service';

interface CompressedImage {
  id: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  downloadUrl: string;
  compressionRatio: number;
  originalFormat: string;
  compressedFormat: string;
}

const message = useMessage();
const { copy } = useCopy();

const fileList = ref<File[]>([]);
const compressedImages = ref<CompressedImage[]>([]);
const isCompressing = ref(false);
const currentProgress = ref(0);
const totalFiles = ref(0);
const currentFileIndex = ref(0);

// Compression options
const compressionMode = ref<'extreme' | 'target-size' | 'target-percentage'>('extreme');
const targetSize = ref(500); // KB
const targetPercentage = ref(50); // %
const maxResolution = ref('1080p');
const quality = ref(80);
const format = ref<'original' | 'jpeg' | 'png' | 'webp'>('original');

const canStartCompression = computed(() => fileList.value.length > 0 && !isCompressing.value);

const handleFileSelect = (files: File[]) => {
  const newFiles = files.filter(file => 
    file.type.startsWith('image/')
  );
  fileList.value = [...fileList.value, ...newFiles];
  message.success(`Added ${newFiles.length} image(s)`);
};

const removeFile = (index: number) => {
  fileList.value.splice(index, 1);
};

const clearAllFiles = () => {
  fileList.value = [];
  compressedImages.value = [];
};

const formatFileSize = (bytes: number): string => {
  return imageCompressionService.formatFileSize(bytes);
};

const compressImage = async (file: File): Promise<CompressedImage> => {
  const options: CompressionOptions = {
    mode: compressionMode.value,
    targetSize: targetSize.value,
    targetPercentage: targetPercentage.value,
    maxResolution: maxResolution.value,
    quality: quality.value,
    format: format.value
  };
  
  const result = await imageCompressionService.compressImage(file, options);
  return {
    id: result.id,
    originalName: result.originalName,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    downloadUrl: result.downloadUrl,
    compressionRatio: result.compressionRatio,
    originalFormat: result.originalFormat,
    compressedFormat: result.compressedFormat
  };
};

const startCompression = async () => {
  if (fileList.value.length === 0) {
    message.warning('Please select images first');
    return;
  }
  
  isCompressing.value = true;
  compressedImages.value = [];
  totalFiles.value = fileList.value.length;
  currentFileIndex.value = 0;
  
  try {
    for (let i = 0; i < fileList.value.length; i++) {
      currentFileIndex.value = i + 1;
      currentProgress.value = ((i + 1) / totalFiles.value) * 100;
      
      const compressedImage = await compressImage(fileList.value[i]);
      compressedImages.value.push(compressedImage);
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    message.success(`Successfully compressed ${compressedImages.value.length} image(s)`);
  } catch (error) {
    message.error('Error during compression: ' + (error as Error).message);
  } finally {
    isCompressing.value = false;
    currentProgress.value = 0;
  }
};

const downloadImage = (image: CompressedImage) => {
  const link = document.createElement('a');
  link.href = image.downloadUrl;
  const extension = image.compressedFormat === 'jpeg' ? 'jpg' : image.compressedFormat;
  link.download = `compressed_${image.originalName.replace(/\.[^/.]+$/, '')}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyDownloadUrl = (image: CompressedImage) => {
  copy(image.downloadUrl, 'Download URL copied to clipboard');
};
</script>

<template>
  <div class="image-compressor">
    <c-card>
      <template #header>
        <div flex items-center justify-between>
          <h3>Image Compression Settings</h3>
          <c-button @click="clearAllFiles" :disabled="fileList.length === 0">
            Clear All
          </c-button>
        </div>
      </template>
      
      <div grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4>
        <div>
          <c-label>Compression Mode</c-label>
          <c-select v-model:value="compressionMode" :options="[
            { label: 'Extreme Compression', value: 'extreme' },
            { label: 'Target Size', value: 'target-size' },
            { label: 'Target Percentage', value: 'target-percentage' }
          ]" />
        </div>
        
        <div v-if="compressionMode === 'target-size'">
          <c-label>Target Size (KB)</c-label>
          <c-input-number v-model:value="targetSize" :min="100" :max="2000" />
        </div>
        
        <div v-if="compressionMode === 'target-percentage'">
          <c-label>Target Percentage (%)</c-label>
          <c-input-number v-model:value="targetPercentage" :min="10" :max="90" />
        </div>
        
        <div>
          <c-label>Max Resolution</c-label>
          <c-select v-model:value="maxResolution" :options="[
            { label: '480p', value: '480p' },
            { label: '720p', value: '720p' },
            { label: '1080p', value: '1080p' },
            { label: '2K', value: '2k' },
            { label: '4K', value: '4k' }
          ]" />
        </div>
        
        <div>
          <c-label>Quality (%)</c-label>
          <c-input-number v-model:value="quality" :min="10" :max="100" />
        </div>
        
        <div>
          <c-label>Output Format</c-label>
          <c-select v-model:value="format" :options="[
            { label: 'Original Format', value: 'original' },
            { label: 'JPEG', value: 'jpeg' },
            { label: 'PNG', value: 'png' },
            { label: 'WebP', value: 'webp' }
          ]" />
        </div>
      </div>
      
      <div flex items-end mb-4>
        <c-file-upload
          accept="image/*"
          multiple
          @files-upload="handleFileSelect"
          :disabled="isCompressing"
        >
          <c-button :disabled="isCompressing">
            Select Images
          </c-button>
        </c-file-upload>
      </div>
    </c-card>

    <c-card v-if="fileList.length > 0" class="mt-4">
      <template #header>
        <h3>Selected Images ({{ fileList.length }})</h3>
      </template>
      
      <div class="file-list">
        <div v-for="(file, index) in fileList" :key="index" class="file-item">
          <div border rounded p-4>
            <div flex items-center justify-between>
              <div>
                <div font-medium>{{ file.name }}</div>
                <div text-sm op-60>{{ formatFileSize(file.size) }}</div>
              </div>
              <c-button size="small" @click="removeFile(index)" type="error">
                Remove
              </c-button>
            </div>
          </div>
        </div>
      </div>
      
      <div mt-4 flex justify-center>
        <c-button 
          type="primary" 
          size="large"
          @click="startCompression"
          :disabled="!canStartCompression"
          :loading="isCompressing"
        >
          {{ isCompressing ? `Compressing... (${currentFileIndex}/${totalFiles})` : 'Start Compression' }}
        </c-button>
      </div>
      
      <div v-if="isCompressing" mt-4>
        <c-progress 
          :percentage="currentProgress" 
          :show-indicator="false"
          status="success"
        />
      </div>
    </c-card>

    <c-card v-if="compressedImages.length > 0" class="mt-4">
      <template #header>
        <h3>Compressed Images ({{ compressedImages.length }})</h3>
      </template>
      
      <div class="compressed-list">
        <div v-for="image in compressedImages" :key="image.id" class="compressed-item">
          <div border rounded p-4>
            <div flex items-center justify-between mb-2>
              <div font-medium>{{ image.originalName }}</div>
              <div flex gap-2>
                <c-button size="small" @click="downloadImage(image)">
                  Download
                </c-button>
                <c-button size="small" @click="copyDownloadUrl(image)">
                  Copy URL
                </c-button>
              </div>
            </div>
            
            <div grid grid-cols-2 gap-4 text-sm>
              <div>
                <div op-60>Original Size:</div>
                <div>{{ formatFileSize(image.originalSize) }}</div>
              </div>
              <div>
                <div op-60>Compressed Size:</div>
                <div>{{ formatFileSize(image.compressedSize) }}</div>
              </div>
              <div>
                <div op-60>Compression Ratio:</div>
                <div :class="image.compressionRatio > 50 ? 'text-green-500' : 'text-yellow-500'">
                  {{ image.compressionRatio.toFixed(1) }}%
                </div>
              </div>
              <div>
                <div op-60>Format:</div>
                <div>{{ image.originalFormat.toUpperCase() }} → {{ image.compressedFormat.toUpperCase() }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.image-compressor {
  .file-list, .compressed-list {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
  
  .file-item, .compressed-item {
    transition: all 0.2s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }
}
</style> 