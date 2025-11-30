<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css

  Step 3: Upload Attachments (Documents, Images, Data)
  Enhanced with fine-grained control features for 200+ lines
-->
<template>
  <div class="codemart-wizard-step-content">
    <h2 class="codemart-step-title">{{ t('codemart.project.submission.step3.title') }}</h2>
    <p class="codemart-step-description">{{ t('codemart.project.submission.step3.description') }}</p>

    <!-- Upload Statistics Banner -->
    <div class="codemart-upload-stats">
      <div class="codemart-upload-stat">
        <span class="codemart-upload-stat-icon">📄</span>
        <div class="codemart-upload-stat-content">
          <span class="codemart-upload-stat-value">{{ totalFiles }}</span>
          <span class="codemart-upload-stat-label">{{ t('codemart.project.submission.step3.totalFiles') }}</span>
        </div>
      </div>
      <div class="codemart-upload-stat">
        <span class="codemart-upload-stat-icon">💾</span>
        <div class="codemart-upload-stat-content">
          <span class="codemart-upload-stat-value">{{ formatFileSize(totalSize) }}</span>
          <span class="codemart-upload-stat-label">{{ t('codemart.project.submission.step3.totalSize') }}</span>
        </div>
      </div>
      <div class="codemart-upload-stat">
        <span class="codemart-upload-stat-icon">✓</span>
        <div class="codemart-upload-stat-content">
          <span class="codemart-upload-stat-value">{{ uploadedFiles }}</span>
          <span class="codemart-upload-stat-label">{{ t('codemart.project.submission.step3.uploaded') }}</span>
        </div>
      </div>
    </div>

    <!-- File Size Warning -->
    <div v-if="totalSize > maxTotalSize * 0.8" class="codemart-alert codemart-alert-warning">
      <span class="codemart-icon">⚠️</span>
      {{ t('codemart.project.submission.step3.sizeWarning', { used: formatFileSize(totalSize), max: formatFileSize(maxTotalSize) }) }}
    </div>

    <!-- Documents Section -->
    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step3.documents') }}
        <span class="codemart-form-optional">(可选)</span>
        <button
          type="button"
          class="codemart-form-label-help"
          @click="showDocumentsHelp = !showDocumentsHelp"
          title="点击查看帮助"
        >
          ?
        </button>
      </label>

      <!-- Help Tooltip -->
      <div v-if="showDocumentsHelp" class="codemart-form-help">
        <strong>{{ t('codemart.project.submission.step3.documentsHelpTitle') }}</strong>
        <ul class="codemart-form-help-list">
          <li>{{ t('codemart.project.submission.step3.documentsHelpTip1') }}</li>
          <li>{{ t('codemart.project.submission.step3.documentsHelpTip2') }}</li>
          <li>{{ t('codemart.project.submission.step3.documentsHelpTip3') }}</li>
        </ul>
      </div>

      <!-- Upload Area with Drag & Drop -->
      <div
        class="codemart-upload-area"
        :class="{ 'codemart-upload-area-dragover': isDraggingDocuments }"
        @drop.prevent="handleDocumentDrop"
        @dragover.prevent="isDraggingDocuments = true"
        @dragleave.prevent="isDraggingDocuments = false"
      >
        <input
          ref="documentInput"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.md"
          class="codemart-upload-input"
          @change="handleDocumentUpload"
        />
        <div class="codemart-upload-area-content">
          <div class="codemart-upload-area-icon">📄</div>
          <p class="codemart-upload-area-text">
            {{ t('codemart.project.submission.step3.dragDropDocuments') }}
          </p>
          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            @click="documentInput?.click()"
          >
            {{ t('codemart.project.submission.step3.selectDocuments') }}
          </button>
          <p class="codemart-upload-area-hint">
            {{ t('codemart.project.submission.step3.documentsAccept') }}
          </p>
        </div>
      </div>

      <!-- File List with Previews -->
      <div v-if="localData.documents.length > 0" class="codemart-file-grid">
        <div
          v-for="(file, index) in localData.documents"
          :key="index"
          class="codemart-file-card"
        >
          <div class="codemart-file-card-preview">
            <div class="codemart-file-icon" :class="`codemart-file-icon-${getFileExtension(file.name)}`">
              {{ getFileIcon(file.name) }}
            </div>
          </div>
          <div class="codemart-file-card-info">
            <div class="codemart-file-card-name" :title="file.name">{{ file.name }}</div>
            <div class="codemart-file-card-meta">
              <span class="codemart-file-card-size">{{ formatFileSize(file.size) }}</span>
              <span class="codemart-file-card-type">{{ getFileExtension(file.name).toUpperCase() }}</span>
            </div>
          </div>
          <div class="codemart-file-card-actions">
            <button
              type="button"
              class="codemart-file-card-remove"
              @click="removeDocument(index)"
              title="删除"
            >
              ×
            </button>
          </div>
          <!-- Upload Progress (if uploading) -->
          <div v-if="uploadProgress[file.name]" class="codemart-file-card-progress">
            <div
              class="codemart-file-card-progress-bar"
              :style="{ width: `${uploadProgress[file.name]}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step3.documentsHint') }}
      </div>
    </div>

    <!-- Images Section -->
    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step3.images') }}
        <span class="codemart-form-optional">(可选)</span>
      </label>

      <!-- Upload Area with Drag & Drop -->
      <div
        class="codemart-upload-area"
        :class="{ 'codemart-upload-area-dragover': isDraggingImages }"
        @drop.prevent="handleImageDrop"
        @dragover.prevent="isDraggingImages = true"
        @dragleave.prevent="isDraggingImages = false"
      >
        <input
          ref="imageInput"
          type="file"
          multiple
          accept="image/*"
          class="codemart-upload-input"
          @change="handleImageUpload"
        />
        <div class="codemart-upload-area-content">
          <div class="codemart-upload-area-icon">🖼️</div>
          <p class="codemart-upload-area-text">
            {{ t('codemart.project.submission.step3.dragDropImages') }}
          </p>
          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            @click="imageInput?.click()"
          >
            {{ t('codemart.project.submission.step3.selectImages') }}
          </button>
          <p class="codemart-upload-area-hint">
            {{ t('codemart.project.submission.step3.imagesAccept') }}
          </p>
        </div>
      </div>

      <!-- Image Grid with Thumbnails -->
      <div v-if="localData.images.length > 0" class="codemart-image-grid">
        <div
          v-for="(file, index) in localData.images"
          :key="index"
          class="codemart-image-card"
        >
          <div class="codemart-image-card-preview">
            <img
              v-if="imagePreviewUrls[file.name]"
              :src="imagePreviewUrls[file.name]"
              :alt="file.name"
              class="codemart-image-thumbnail"
            />
            <div v-else class="codemart-image-placeholder">
              <span>🖼️</span>
            </div>
          </div>
          <div class="codemart-image-card-overlay">
            <div class="codemart-image-card-name" :title="file.name">{{ file.name }}</div>
            <div class="codemart-image-card-size">{{ formatFileSize(file.size) }}</div>
            <button
              type="button"
              class="codemart-image-card-remove"
              @click="removeImage(index)"
            >
              ×
            </button>
          </div>
          <!-- Upload Progress -->
          <div v-if="uploadProgress[file.name]" class="codemart-image-card-progress">
            <div
              class="codemart-image-card-progress-bar"
              :style="{ width: `${uploadProgress[file.name]}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step3.imagesHint') }}
      </div>
    </div>

    <!-- Data Files Section -->
    <div class="codemart-form-group">
      <label class="codemart-form-label">
        {{ t('codemart.project.submission.step3.data') }}
        <span class="codemart-form-optional">(可选)</span>
      </label>

      <!-- Upload Area with Drag & Drop -->
      <div
        class="codemart-upload-area"
        :class="{ 'codemart-upload-area-dragover': isDraggingData }"
        @drop.prevent="handleDataDrop"
        @dragover.prevent="isDraggingData = true"
        @dragleave.prevent="isDraggingData = false"
      >
        <input
          ref="dataInput"
          type="file"
          multiple
          accept=".xls,.xlsx,.csv,.json,.xml"
          class="codemart-upload-input"
          @change="handleDataUpload"
        />
        <div class="codemart-upload-area-content">
          <div class="codemart-upload-area-icon">📊</div>
          <p class="codemart-upload-area-text">
            {{ t('codemart.project.submission.step3.dragDropData') }}
          </p>
          <button
            type="button"
            class="codemart-btn codemart-btn-outline"
            @click="dataInput?.click()"
          >
            {{ t('codemart.project.submission.step3.selectData') }}
          </button>
          <p class="codemart-upload-area-hint">
            {{ t('codemart.project.submission.step3.dataAccept') }}
          </p>
        </div>
      </div>

      <!-- File List -->
      <div v-if="localData.data.length > 0" class="codemart-file-grid">
        <div
          v-for="(file, index) in localData.data"
          :key="index"
          class="codemart-file-card"
        >
          <div class="codemart-file-card-preview">
            <div class="codemart-file-icon codemart-file-icon-data">
              {{ getFileIcon(file.name) }}
            </div>
          </div>
          <div class="codemart-file-card-info">
            <div class="codemart-file-card-name" :title="file.name">{{ file.name }}</div>
            <div class="codemart-file-card-meta">
              <span class="codemart-file-card-size">{{ formatFileSize(file.size) }}</span>
              <span class="codemart-file-card-type">{{ getFileExtension(file.name).toUpperCase() }}</span>
            </div>
          </div>
          <div class="codemart-file-card-actions">
            <button
              type="button"
              class="codemart-file-card-remove"
              @click="removeData(index)"
              title="删除"
            >
              ×
            </button>
          </div>
          <!-- Upload Progress -->
          <div v-if="uploadProgress[file.name]" class="codemart-file-card-progress">
            <div
              class="codemart-file-card-progress-bar"
              :style="{ width: `${uploadProgress[file.name]}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div class="codemart-form-hint">
        {{ t('codemart.project.submission.step3.dataHint') }}
      </div>
    </div>

    <!-- File Type Validation Errors -->
    <div v-if="validationErrors.length > 0" class="codemart-validation-errors">
      <div
        v-for="(error, index) in validationErrors"
        :key="index"
        class="codemart-alert codemart-alert-error"
      >
        <span class="codemart-icon">❌</span>
        {{ error }}
        <button
          type="button"
          class="codemart-alert-close"
          @click="validationErrors.splice(index, 1)"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Upload Queue Status -->
    <div v-if="isUploading" class="codemart-upload-queue">
      <div class="codemart-upload-queue-header">
        <span class="codemart-icon">⏳</span>
        {{ t('codemart.project.submission.step3.uploading') }}
      </div>
      <div class="codemart-upload-queue-progress">
        <div
          class="codemart-upload-queue-progress-bar"
          :style="{ width: `${overallProgress}%` }"
        ></div>
      </div>
      <div class="codemart-upload-queue-text">
        {{ uploadedFilesCount }} / {{ totalFilesInQueue }} {{ t('codemart.project.submission.step3.filesUploaded') }}
      </div>
    </div>

    <!-- Navigation Actions -->
    <div class="codemart-wizard-actions">
      <button
        type="button"
        class="codemart-btn codemart-btn-secondary"
        @click="emit('back')"
      >
        ← {{ t('codemart.common.back') }}
      </button>
      <button
        type="button"
        class="codemart-btn codemart-btn-primary"
        :disabled="isUploading || totalSize > maxTotalSize"
        @click="handleNext"
      >
        {{ t('codemart.common.next') }}
        <span v-if="!isUploading && totalSize <= maxTotalSize">→</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  modelValue: {
    documents: File[]
    images: File[]
    data: File[]
  }
  uploadProgress?: Record<string, number>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: Props['modelValue']]
  'next': []
  'back': []
}>()

// Refs for file inputs
const documentInput = ref<HTMLInputElement>()
const imageInput = ref<HTMLInputElement>()
const dataInput = ref<HTMLInputElement>()

// Local state
const localData = reactive({
  documents: [...props.modelValue.documents],
  images: [...props.modelValue.images],
  data: [...props.modelValue.data]
})

const isDraggingDocuments = ref(false)
const isDraggingImages = ref(false)
const isDraggingData = ref(false)
const showDocumentsHelp = ref(false)
const validationErrors = ref<string[]>([])
const imagePreviewUrls = ref<Record<string, string>>({})
const uploadProgress = ref<Record<string, number>>(props.uploadProgress || {})
const isUploading = ref(false)

// Constants
const maxFileSize = 50 * 1024 * 1024 // 50MB per file
const maxTotalSize = 200 * 1024 * 1024 // 200MB total
const allowedDocumentExtensions = ['pdf', 'doc', 'docx', 'txt', 'md']
const allowedImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp']
const allowedDataExtensions = ['xls', 'xlsx', 'csv', 'json', 'xml']

// Computed
const totalFiles = computed(() => {
  return localData.documents.length + localData.images.length + localData.data.length
})

const totalSize = computed(() => {
  const documentsSize = localData.documents.reduce((sum, file) => sum + file.size, 0)
  const imagesSize = localData.images.reduce((sum, file) => sum + file.size, 0)
  const dataSize = localData.data.reduce((sum, file) => sum + file.size, 0)
  return documentsSize + imagesSize + dataSize
})

const uploadedFiles = computed(() => {
  return Object.values(uploadProgress.value).filter(progress => progress === 100).length
})

const totalFilesInQueue = computed(() => {
  return Object.keys(uploadProgress.value).length
})

const uploadedFilesCount = computed(() => {
  return uploadedFiles.value
})

const overallProgress = computed(() => {
  if (totalFilesInQueue.value === 0) return 0
  const totalProgress = Object.values(uploadProgress.value).reduce((sum, progress) => sum + progress, 0)
  return Math.round(totalProgress / totalFilesInQueue.value)
})

// Watch for changes and emit
watch(localData, (newValue) => {
  emit('update:modelValue', {
    documents: [...newValue.documents],
    images: [...newValue.images],
    data: [...newValue.data]
  })
}, { deep: true })

// Helper functions
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || ''
}

const getFileIcon = (filename: string): string => {
  const ext = getFileExtension(filename)
  const iconMap: Record<string, string> = {
    pdf: '📕',
    doc: '📄',
    docx: '📄',
    txt: '📝',
    md: '📝',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    xls: '📊',
    xlsx: '📊',
    csv: '📊',
    json: '📋',
    xml: '📋'
  }
  return iconMap[ext] || '📄'
}

const validateFile = (file: File, allowedExtensions: string[]): boolean => {
  const ext = getFileExtension(file.name)

  // Check file extension
  if (!allowedExtensions.includes(ext)) {
    validationErrors.value.push(
      t('codemart.project.submission.step3.invalidFileType', { name: file.name, allowed: allowedExtensions.join(', ') })
    )
    return false
  }

  // Check file size
  if (file.size > maxFileSize) {
    validationErrors.value.push(
      t('codemart.project.submission.step3.fileTooLarge', { name: file.name, max: formatFileSize(maxFileSize) })
    )
    return false
  }

  return true
}

const createImagePreview = (file: File) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target?.result) {
      imagePreviewUrls.value[file.name] = e.target.result as string
    }
  }
  reader.readAsDataURL(file)
}

// Document handlers
const handleDocumentUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(Array.from(target.files), 'documents')
  }
}

const handleDocumentDrop = (event: DragEvent) => {
  isDraggingDocuments.value = false
  if (event.dataTransfer?.files) {
    processFiles(Array.from(event.dataTransfer.files), 'documents')
  }
}

// Image handlers
const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(Array.from(target.files), 'images')
  }
}

const handleImageDrop = (event: DragEvent) => {
  isDraggingImages.value = false
  if (event.dataTransfer?.files) {
    processFiles(Array.from(event.dataTransfer.files), 'images')
  }
}

// Data handlers
const handleDataUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    processFiles(Array.from(target.files), 'data')
  }
}

const handleDataDrop = (event: DragEvent) => {
  isDraggingData.value = false
  if (event.dataTransfer?.files) {
    processFiles(Array.from(event.dataTransfer.files), 'data')
  }
}

// Process files with validation
const processFiles = (files: File[], category: 'documents' | 'images' | 'data') => {
  const allowedExtensions = category === 'documents'
    ? allowedDocumentExtensions
    : category === 'images'
    ? allowedImageExtensions
    : allowedDataExtensions

  files.forEach((file) => {
    if (validateFile(file, allowedExtensions)) {
      localData[category].push(file)

      // Create preview for images
      if (category === 'images') {
        createImagePreview(file)
      }

      // Simulate upload progress (in real scenario, this would be from actual upload)
      simulateUploadProgress(file.name)
    }
  })
}

// Simulate upload progress (for demonstration)
const simulateUploadProgress = (filename: string) => {
  uploadProgress.value[filename] = 0
  isUploading.value = true

  const interval = setInterval(() => {
    if (uploadProgress.value[filename] >= 100) {
      clearInterval(interval)
      checkUploadCompletion()
    } else {
      uploadProgress.value[filename] += 10
    }
  }, 200)
}

const checkUploadCompletion = () => {
  const allComplete = Object.values(uploadProgress.value).every(progress => progress === 100)
  if (allComplete) {
    isUploading.value = false
  }
}

// Remove handlers
const removeDocument = (index: number) => {
  const file = localData.documents[index]
  delete uploadProgress.value[file.name]
  localData.documents.splice(index, 1)
}

const removeImage = (index: number) => {
  const file = localData.images[index]
  delete uploadProgress.value[file.name]
  delete imagePreviewUrls.value[file.name]
  localData.images.splice(index, 1)
}

const removeData = (index: number) => {
  const file = localData.data[index]
  delete uploadProgress.value[file.name]
  localData.data.splice(index, 1)
}

const handleNext = () => {
  emit('next')
}
</script>

<!-- NO <style> tag - All styles defined in theme files -->
