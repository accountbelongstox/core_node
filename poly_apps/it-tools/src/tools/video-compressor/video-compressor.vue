<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMessage } from 'naive-ui';
import { useCopy } from '@/composable/copy';
import { videoCompressionService, type VideoCompressionOptions } from './video-compressor.service';

interface CompressedVideo {
  id: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  downloadUrl: string;
  compressionRatio: number;
  duration: number;
  resolution: string;
}

const message = useMessage();
const { copy } = useCopy();

const fileList = ref<File[]>([]);
const compressedVideos = ref<CompressedVideo[]>([]);
const isCompressing = ref(false);
const currentProgress = ref(0);
const totalFiles = ref(0);
const currentFileIndex = ref(0);
const compressionStatus = ref('');

// Compression options
const compressionMode = ref<'extreme' | 'target-size' | 'target-percentage'>('extreme');
const targetSize = ref(50); // MB
const targetPercentage = ref(50); // %
const maxResolution = ref('720p');
const quality = ref(80);
const format = ref<'mp4' | 'webm' | 'avi'>('mp4');

const canStartCompression = computed(() => fileList.value.length > 0 && !isCompressing.value);

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const newFiles = Array.from(target.files).filter(file => 
      file.type.startsWith('video/')
    );
    fileList.value = [...fileList.value, ...newFiles];
    message.success(`Added ${newFiles.length} video(s)`);
  }
};

const removeFile = (index: number) => {
  fileList.value.splice(index, 0);
};

const clearAllFiles = () => {
  fileList.value = [];
  compressedVideos.value = [];
};

const formatFileSize = (bytes: number): string => {
  return videoCompressionService.formatFileSize(bytes);
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const compressVideo = async (file: File): Promise<CompressedVideo> => {
  const options: VideoCompressionOptions = {
    mode: compressionMode.value,
    targetSize: targetSize.value,
    targetPercentage: targetPercentage.value,
    maxResolution: maxResolution.value,
    quality: quality.value,
    format: format.value
  };
  
  const result = await videoCompressionService.compressVideo(file, options, (progress) => {
    currentProgress.value = progress;
  });
  
  return {
    id: result.id,
    originalName: result.originalName,
    originalSize: result.originalSize,
    compressedSize: result.compressedSize,
    downloadUrl: result.downloadUrl,
    compressionRatio: result.compressionRatio,
    duration: result.duration,
    resolution: result.resolution
  };
};

const startCompression = async () => {
  if (fileList.value.length === 0) {
    message.warning('Please select videos first');
    return;
  }
  
  isCompressing.value = true;
  compressedVideos.value = [];
  totalFiles.value = fileList.value.length;
  currentFileIndex.value = 0;
  currentProgress.value = 0;
  
  try {
    for (let i = 0; i < fileList.value.length; i++) {
      currentFileIndex.value = i + 1;
      compressionStatus.value = `Compressing ${fileList.value[i].name}...`;
      
      const compressedVideo = await compressVideo(fileList.value[i]);
      compressedVideos.value.push(compressedVideo);
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    message.success(`Successfully compressed ${compressedVideos.value.length} video(s)`);
  } catch (error) {
    message.error('Error during compression: ' + (error as Error).message);
  } finally {
    isCompressing.value = false;
    currentProgress.value = 0;
    compressionStatus.value = '';
  }
};

const downloadVideo = (video: CompressedVideo) => {
  const link = document.createElement('a');
  link.href = video.downloadUrl;
  link.download = `compressed_${video.originalName}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyDownloadUrl = (video: CompressedVideo) => {
  copy(video.downloadUrl, 'Download URL copied to clipboard');
};
</script>

<template>
  <div class="video-compressor">
    <c-card>
      <template #header>
        <div flex items-center justify-between>
          <h3>Video Compression Settings</h3>
          <c-button @click="clearAllFiles" :disabled="fileList.length === 0">
            Clear All
          </c-button>
        </div>
      </template>
      
      <div grid grid-cols-1 md:grid-cols-2 gap-4 mb-4>
        <div>
          <c-label>Compression Mode</c-label>
          <c-select v-model:value="compressionMode" :options="[
            { label: 'Extreme Compression', value: 'extreme' },
            { label: 'Target Size (MB)', value: 'target-size' },
            { label: 'Target Percentage (%)', value: 'target-percentage' }
          ]" />
        </div>
        <div>
          <c-label>Output Format</c-label>
          <c-select v-model:value="format" :options="[
            { label: 'MP4', value: 'mp4' },
            { label: 'WebM', value: 'webm' },
            { label: 'AVI', value: 'avi' }
          ]" />
        </div>
      </div>
      
      <div grid grid-cols-1 md:grid-cols-3 gap-4 mb-4>
        <div v-if="compressionMode === 'target-size'">
          <c-label>Target Size (MB)</c-label>
          <c-input-number v-model:value="targetSize" :min="1" :max="1000" />
        </div>
        <div v-if="compressionMode === 'target-percentage'">
          <c-label>Target Percentage (%)</c-label>
          <c-input-number v-model:value="targetPercentage" :min="1" :max="100" />
        </div>
        <div>
          <c-label>Max Resolution</c-label>
          <c-select v-model:value="maxResolution" :options="[
            { label: '480p', value: '480p' },
            { label: '720p', value: '720p' },
            { label: '1080p', value: '1080p' }
          ]" />
        </div>
        <div>
          <c-label>Quality (%)</c-label>
          <c-input-number v-model:value="quality" :min="10" :max="100" />
        </div>
      </div>
      
      <div flex items-end>
        <c-file-upload
          accept="video/*"
          multiple
          @change="handleFileSelect"
          :disabled="isCompressing"
        >
          <c-button :disabled="isCompressing">
            Select Videos
          </c-button>
        </c-file-upload>
      </div>
    </c-card>

    <c-card v-if="fileList.length > 0" class="mt-4">
      <template #header>
        <h3>Selected Videos ({{ fileList.length }})</h3>
      </template>
      
      <div v-if="isCompressing" class="compression-progress">
        <div flex items-center justify-between mb-2>
          <span>{{ compressionStatus }}</span>
          <span>{{ Math.round(currentProgress) }}%</span>
        </div>
        <n-progress :percentage="currentProgress" />
        <div text-sm op-60 mt-2>
          Processing video {{ currentFileIndex }} of {{ totalFiles }}
        </div>
      </div>
      
      <div v-else class="file-list">
        <div v-for="(file, index) in fileList" :key="index" class="file-item">
          <div flex items-center justify-between p-2 border rounded>
            <div flex items-center gap-2>
              <icon-mdi:video text-20px />
              <div>
                <div font-medium>{{ file.name }}</div>
                <div text-sm op-60>{{ formatFileSize(file.size) }}</div>
              </div>
            </div>
            <c-button size="small" @click="removeFile(index)" :disabled="isCompressing">
              Remove
            </c-button>
          </div>
        </div>
      </div>
      
      <div flex justify-center mt-4>
        <c-button 
          type="primary" 
          size="large"
          @click="startCompression"
          :disabled="!canStartCompression"
          :loading="isCompressing"
        >
          {{ isCompressing ? 'Compressing...' : 'Start Compression' }}
        </c-button>
      </div>
    </c-card>

    <c-card v-if="compressedVideos.length > 0" class="mt-4">
      <template #header>
        <h3>Compressed Videos ({{ compressedVideos.length }})</h3>
      </template>
      
      <div class="compressed-list">
        <div v-for="video in compressedVideos" :key="video.id" class="compressed-item">
          <div border rounded p-4>
            <div flex items-center justify-between mb-2>
              <div font-medium>{{ video.originalName }}</div>
              <div flex gap-2>
                <c-button size="small" @click="downloadVideo(video)">
                  Download
                </c-button>
                <c-button size="small" @click="copyDownloadUrl(video)">
                  Copy URL
                </c-button>
              </div>
            </div>
            
            <div grid grid-cols-2 gap-4 text-sm>
              <div>
                <div op-60>Original Size:</div>
                <div>{{ formatFileSize(video.originalSize) }}</div>
              </div>
              <div>
                <div op-60>Compressed Size:</div>
                <div>{{ formatFileSize(video.compressedSize) }}</div>
              </div>
              <div>
                <div op-60>Compression Ratio:</div>
                <div :class="video.compressionRatio > 50 ? 'text-green-500' : 'text-yellow-500'">
                  {{ video.compressionRatio.toFixed(1) }}%
                </div>
              </div>
              <div>
                <div op-60>Duration:</div>
                <div>{{ formatDuration(video.duration) }}</div>
              </div>
              <div>
                <div op-60>Resolution:</div>
                <div>{{ video.resolution }}</div>
              </div>
              <div>
                <div op-60>Status:</div>
                <div :class="video.compressedSize <= targetSize * 1024 * 1024 ? 'text-green-500' : 'text-red-500'">
                  {{ video.compressedSize <= targetSize * 1024 * 1024 ? 'Target Met' : 'Over Target' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.video-compressor {
  .compression-progress {
    padding: 16px;
    background: rgba(0, 0, 0, 0.02);
    border-radius: 8px;
  }
  
  .file-list {
    max-height: 300px;
    overflow-y: auto;
    
    .file-item {
      margin-bottom: 8px;
    }
  }
  
  .compressed-list {
    max-height: 400px;
    overflow-y: auto;
    
    .compressed-item {
      margin-bottom: 12px;
    }
  }
}
</style> 