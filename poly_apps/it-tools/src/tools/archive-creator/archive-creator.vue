<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMessage } from 'naive-ui';
import { useCopy } from '@/composable/copy';
import { archiveCreatorService, type ArchiveOptions, type ArchiveFile } from './archive-creator.service';

interface ArchiveResult {
  id: string;
  filename: string;
  size: number;
  downloadUrl: string;
  fileCount: number;
  success: boolean;
  error?: string;
}

const message = useMessage();
const { copy } = useCopy();

const fileMap = ref<Map<string, File>>(new Map());
const fileList = ref<ArchiveFile[]>([]);
const isCreating = ref(false);
const currentProgress = ref(0);
const archiveResult = ref<ArchiveResult | null>(null);

// Archive options
const format = ref<'zip' | 'tar' | '7z'>('zip');
const filename = ref('');
const useTimestamp = ref(true);
const compressImages = ref(true);
const compressVideos = ref(false);
const imageQuality = ref(80);
const videoQuality = ref(80);

const canCreateArchive = computed(() => fileList.value.length > 0 && !isCreating.value);

const handleFileSelect = (files: File[]) => {
  const newFiles: ArchiveFile[] = [];
  
  for (const file of files) {
    if (!archiveCreatorService.validateFile(file)) {
      message.warning(`File ${file.name} is too large or invalid`);
      continue;
    }
    
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const isImage = archiveCreatorService.isImageFile(file);
    const isVideo = archiveCreatorService.isVideoFile(file);
    
    const archiveFile: ArchiveFile = {
      id,
      name: file.name,
      size: file.size,
      type: file.type,
      isImage,
      isVideo
    };
    
    fileMap.value.set(id, file);
    newFiles.push(archiveFile);
  }
  
  fileList.value = [...fileList.value, ...newFiles];
  message.success(`Added ${newFiles.length} file(s)`);
};

const removeFile = (index: number) => {
  const file = fileList.value[index];
  fileMap.value.delete(file.id);
  fileList.value.splice(index, 1);
};

const clearAllFiles = () => {
  fileList.value = [];
  fileMap.value.clear();
  archiveResult.value = null;
};

const formatFileSize = (bytes: number): string => {
  return archiveCreatorService.formatFileSize(bytes);
};

const createArchive = async () => {
  if (fileList.value.length === 0) {
    message.warning('Please select files first');
    return;
  }
  
  isCreating.value = true;
  currentProgress.value = 0;
  archiveResult.value = null;
  
  try {
    const options: ArchiveOptions = {
      format: format.value,
      filename: filename.value,
      useTimestamp: useTimestamp.value,
      compressImages: compressImages.value,
      compressVideos: compressVideos.value,
      imageQuality: imageQuality.value,
      videoQuality: videoQuality.value
    };
    
         const result = await archiveCreatorService.createArchive(
       fileList.value,
       options,
       (id: string) => fileMap.value.get(id) || null,
       (progress) => {
         currentProgress.value = progress;
       }
     );
    
    if (result.success) {
      archiveResult.value = result;
      message.success(`Archive created successfully: ${result.filename}`);
    } else {
      message.error('Failed to create archive: ' + result.error);
    }
  } catch (error) {
    message.error('Error creating archive: ' + (error as Error).message);
  } finally {
    isCreating.value = false;
    currentProgress.value = 0;
  }
};

const downloadArchive = (result: ArchiveResult) => {
  const link = document.createElement('a');
  link.href = result.downloadUrl;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyDownloadUrl = (result: ArchiveResult) => {
  copy(result.downloadUrl, 'Download URL copied to clipboard');
};

const getTotalSize = computed(() => {
  return fileList.value.reduce((total, file) => total + file.size, 0);
});
</script>

<template>
  <div class="archive-creator">
    <c-card>
      <template #header>
        <div flex items-center justify-between>
          <h3>Archive Creator Settings</h3>
          <c-button @click="clearAllFiles" :disabled="fileList.length === 0">
            Clear All
          </c-button>
        </div>
      </template>
      
      <div grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4>
        <div>
          <c-label>Archive Format</c-label>
          <c-select v-model:value="format" :options="[
            { label: 'ZIP', value: 'zip' },
            { label: 'TAR', value: 'tar' },
            { label: '7Z', value: '7z' }
          ]" />
        </div>
        
        <div>
          <c-label>Filename</c-label>
          <c-input-text v-model:value="filename" placeholder="Enter archive name" />
        </div>
        
        <div>
          <c-label>Naming Convention</c-label>
          <c-select v-model:value="useTimestamp" :options="[
            { label: 'Timestamp + Filename', value: true },
            { label: 'Filename Only', value: false }
          ]" />
        </div>
        
        <div>
          <c-label>Compress Images</c-label>
          <c-select v-model:value="compressImages" :options="[
            { label: 'Yes', value: true },
            { label: 'No', value: false }
          ]" />
        </div>
        
        <div v-if="compressImages">
          <c-label>Image Quality (%)</c-label>
          <c-input-number v-model:value="imageQuality" :min="10" :max="100" />
        </div>
        
        <div>
          <c-label>Compress Videos</c-label>
          <c-select v-model:value="compressVideos" :options="[
            { label: 'No (Not supported)', value: false },
            { label: 'Yes (Not supported)', value: true }
          ]" :disabled="true" />
        </div>
      </div>
      
      <div flex items-end mb-4>
        <c-file-upload
          multiple
          @files-upload="handleFileSelect"
          :disabled="isCreating"
        >
          <c-button :disabled="isCreating">
            Select Files
          </c-button>
        </c-file-upload>
      </div>
    </c-card>

    <c-card v-if="fileList.length > 0" class="mt-4">
      <template #header>
        <h3>Selected Files ({{ fileList.length }}) - Total: {{ formatFileSize(getTotalSize) }}</h3>
      </template>
      
      <div class="file-list">
        <div v-for="(file, index) in fileList" :key="file.id" class="file-item">
          <div border rounded p-4>
            <div flex items-center justify-between>
              <div flex items-center gap-2>
                <div>
                  <div font-medium>{{ file.name }}</div>
                  <div text-sm op-60>{{ formatFileSize(file.size) }}</div>
                  <div text-xs op-40>
                    {{ file.isImage ? 'Image' : file.isVideo ? 'Video' : 'File' }}
                    <span v-if="file.compressionRatio" class="ml-2">
                      (Compressed: {{ file.compressionRatio.toFixed(1) }}%)
                    </span>
                  </div>
                </div>
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
          @click="createArchive"
          :disabled="!canCreateArchive"
          :loading="isCreating"
        >
          {{ isCreating ? 'Creating Archive...' : 'Create Archive' }}
        </c-button>
      </div>
      
      <div v-if="isCreating" mt-4>
        <c-progress 
          :percentage="currentProgress" 
          :show-indicator="false"
          status="success"
        />
      </div>
    </c-card>

    <c-card v-if="archiveResult" class="mt-4">
      <template #header>
        <h3>Archive Created Successfully</h3>
      </template>
      
      <div border rounded p-4>
        <div flex items-center justify-between mb-2>
          <div font-medium>{{ archiveResult.filename }}</div>
          <div flex gap-2>
            <c-button size="small" @click="downloadArchive(archiveResult)">
              Download
            </c-button>
            <c-button size="small" @click="copyDownloadUrl(archiveResult)">
              Copy URL
            </c-button>
          </div>
        </div>
        
        <div grid grid-cols-2 gap-4 text-sm>
          <div>
            <div op-60>Archive Size:</div>
            <div>{{ formatFileSize(archiveResult.size) }}</div>
          </div>
          <div>
            <div op-60>File Count:</div>
            <div>{{ archiveResult.fileCount }} files</div>
          </div>
        </div>
      </div>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.archive-creator {
  .file-list {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
  
  .file-item {
    transition: all 0.2s ease;
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }
}
</style> 