<template>
  <div class="static-resources-panel">
    <div class="panel-header">
      <div>
        <h2 class="module-title">{{ t('staticResources.title') }}</h2>
        <p class="module-description">{{ t('modules.staticResources.description') }}</p>
      </div>
      <button @click="openUploadDialog" class="upload-btn">
        <i class="fas fa-cloud-upload-alt"></i>
        {{ t('staticResources.upload') }}
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button
        v-for="filter in filters"
        :key="filter.type"
        @click="activeFilter = filter.type"
        :class="['filter-tab', { active: activeFilter === filter.type }]"
      >
        <i :class="['fas', filter.icon]"></i>
        <span>{{ t(`staticResources.${filter.label}`) }}</span>
      </button>
    </div>

    <!-- Resources Grid -->
    <div class="resources-container">
      <div v-if="filteredResources.length" class="resources-grid">
        <div
          v-for="resource in filteredResources"
          :key="resource.path"
          @click="selectResource(resource)"
          :class="['resource-card', { selected: selectedResource?.path === resource.path }]"
        >
          <div class="resource-preview">
            <img v-if="isImage(resource)" :src="getPreviewUrl(resource)" :alt="resource.name" />
            <i v-else :class="['fas', getResourceIcon(resource)]"></i>
          </div>
          <div class="resource-info">
            <span class="resource-name" :title="resource.name">{{ resource.name }}</span>
            <span class="resource-size">{{ formatFileSize(resource.size) }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="isLoading" class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        {{ t('common.loading') }}
      </div>

      <div v-else class="empty-state">
        <i class="fas fa-folder-open"></i>
        <p>{{ t('common.noData') }}</p>
      </div>

      <div v-if="error" class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- Preview Modal -->
    <div v-if="selectedResource" class="preview-modal" @click.self="closePreview">
      <div class="preview-content glass-panel">
        <div class="preview-header">
          <h3>{{ t('staticResources.preview') }}</h3>
          <div class="preview-actions">
            <button @click="downloadResource" class="action-btn" :title="t('staticResources.download')">
              <i class="fas fa-download"></i>
            </button>
            <button @click="closePreview" class="action-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="preview-body">
          <img
            v-if="isImage(selectedResource)"
            :src="getPreviewUrl(selectedResource)"
            :alt="selectedResource.name"
            class="preview-image"
          />
          <div v-else class="preview-placeholder">
            <i :class="['fas', getResourceIcon(selectedResource)]"></i>
            <p>{{ selectedResource.name }}</p>
            <button @click="downloadResource" class="download-btn">
              <i class="fas fa-download"></i>
              {{ t('staticResources.download') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Dialog -->
    <div v-if="showUploadDialog" class="upload-modal" @click.self="closeUploadDialog">
      <div class="upload-content glass-panel">
        <div class="upload-header">
          <h3>{{ t('staticResources.upload') }}</h3>
          <button @click="closeUploadDialog" class="close-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="upload-body">
          <div class="upload-zone" @dragover.prevent @drop.prevent="handleDrop">
            <input
              ref="fileInput"
              type="file"
              multiple
              @change="handleFileSelect"
              class="file-input"
            />
            <i class="fas fa-cloud-upload-alt"></i>
            <p>{{ t('common.dragDrop') }}</p>
            <button @click="triggerFileSelect" class="select-btn">
              {{ t('common.selectFiles') }}
            </button>
          </div>

          <div v-if="uploadQueue.length" class="upload-queue">
            <div v-for="(file, index) in uploadQueue" :key="index" class="upload-item">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
              <button @click="removeFromQueue(index)" class="remove-btn">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>

          <button
            v-if="uploadQueue.length"
            @click="startUpload"
            :disabled="isUploading"
            class="start-upload-btn"
          >
            <i :class="['fas', isUploading ? 'fa-spinner fa-spin' : 'fa-upload']"></i>
            {{ t('common.upload') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Static Resources Panel - manage static files (images, videos, documents)
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/static-resources APIs

interface ResourceFile {
  name: string
  path: string
  size: number
  type: string
}

// Use unified composables
const { t } = useI18n()
const api = useApi()

// State
const resources = ref<ResourceFile[]>([])
const selectedResource = ref<ResourceFile | null>(null)
const activeFilter = ref('all')
const isLoading = ref(false)
const error = ref<string | null>(null)
const showUploadDialog = ref(false)
const uploadQueue = ref<File[]>([])
const isUploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Filters
const filters = [
  { type: 'all', label: 'all', icon: 'fa-th' },
  { type: 'image', label: 'images', icon: 'fa-image' },
  { type: 'video', label: 'videos', icon: 'fa-video' },
  { type: 'document', label: 'documents', icon: 'fa-file-alt' }
]

// Filtered resources
const filteredResources = computed(() => {
  if (activeFilter.value === 'all') return resources.value

  return resources.value.filter(resource => {
    const ext = resource.name.split('.').pop()?.toLowerCase() || ''

    switch (activeFilter.value) {
      case 'image':
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
      case 'video':
        return ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)
      case 'document':
        return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)
      default:
        return true
    }
  })
})

// Fetch resources from backend
const fetchResources = async () => {
  isLoading.value = true
  error.value = null

  try {
    const response = await api.get('STATIC_FILE_TREE')

    if (response.success && response.data) {
      resources.value = parseResources(response.data)
    } else {
      throw new Error(response.error || t('errors.unknownError'))
    }
  } catch (err: any) {
    error.value = err.message || t('errors.networkError')
    console.error('Failed to fetch resources:', err)
  } finally {
    isLoading.value = false
  }
}

// Parse resources from backend response
const parseResources = (data: any): ResourceFile[] => {
  if (Array.isArray(data)) {
    return data.map(item => ({
      name: item.name || item.filename || '',
      path: item.path || item.filepath || '',
      size: item.size || 0,
      type: item.type || item.mime_type || ''
    }))
  }

  if (data.files && Array.isArray(data.files)) {
    return parseResources(data.files)
  }

  return []
}

// Check if resource is image
const isImage = (resource: ResourceFile): boolean => {
  const ext = resource.name.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
}

// Get preview URL
const getPreviewUrl = (resource: ResourceFile): string => {
  // Build preview URL using backend base URL
  return `http://192.168.50.3:9000/static-resources/stream-file?path=${encodeURIComponent(resource.path)}`
}

// Get resource icon
const getResourceIcon = (resource: ResourceFile): string => {
  const ext = resource.name.split('.').pop()?.toLowerCase() || ''

  const iconMap: Record<string, string> = {
    'pdf': 'fa-file-pdf',
    'doc': 'fa-file-word',
    'docx': 'fa-file-word',
    'xls': 'fa-file-excel',
    'xlsx': 'fa-file-excel',
    'ppt': 'fa-file-powerpoint',
    'pptx': 'fa-file-powerpoint',
    'txt': 'fa-file-alt',
    'mp4': 'fa-file-video',
    'avi': 'fa-file-video',
    'mov': 'fa-file-video',
    'zip': 'fa-file-archive',
    'rar': 'fa-file-archive'
  }

  return iconMap[ext] || 'fa-file'
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Select resource for preview
const selectResource = (resource: ResourceFile) => {
  selectedResource.value = resource
}

// Close preview
const closePreview = () => {
  selectedResource.value = null
}

// Download resource
const downloadResource = () => {
  if (!selectedResource.value) return

  const link = document.createElement('a')
  link.href = getPreviewUrl(selectedResource.value)
  link.download = selectedResource.value.name
  link.click()
}

// Upload dialog methods
const openUploadDialog = () => {
  showUploadDialog.value = true
}

const closeUploadDialog = () => {
  showUploadDialog.value = false
  uploadQueue.value = []
}

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (files) {
    uploadQueue.value.push(...Array.from(files))
  }
}

const handleDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files
  if (files) {
    uploadQueue.value.push(...Array.from(files))
  }
}

const removeFromQueue = (index: number) => {
  uploadQueue.value.splice(index, 1)
}

const startUpload = async () => {
  if (!uploadQueue.value.length) return

  isUploading.value = true

  try {
    for (const file of uploadQueue.value) {
      const formData = new FormData()
      formData.append('file', file)

      await api.post('STATIC_UPLOAD', {
        body: formData
      })
    }

    // Refresh resources after upload
    await fetchResources()

    // Close dialog
    closeUploadDialog()
  } catch (err: any) {
    error.value = err.message || t('errors.uploadFailed')
    console.error('Upload failed:', err)
  } finally {
    isUploading.value = false
  }
}

// Load resources on mount
onMounted(() => {
  fetchResources()
})
</script>

<style scoped>
.static-resources-panel {
  padding: 1.5rem;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.module-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.module-description {
  color: #6b7280;
  margin: 0;
}

.upload-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.2s;
}

.upload-btn:hover {
  transform: translateY(-2px);
}

.filter-tabs {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.filter-tab {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  color: #6b7280;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-tab:hover {
  color: #6366f1;
}

.filter-tab.active {
  color: #6366f1;
  font-weight: 600;
}

.filter-tab.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: #6366f1;
}

.resources-container {
  min-height: 400px;
}

.resources-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.resource-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1rem;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.resource-card:hover {
  border-color: #6366f1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.resource-card.selected {
  border-color: #6366f1;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
}

.resource-preview {
  width: 100%;
  height: 150px;
  background: #f3f4f6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.resource-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.resource-preview i {
  font-size: 3rem;
  color: #9ca3af;
}

.resource-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.resource-name {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-size {
  font-size: 0.75rem;
  color: #9ca3af;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #9ca3af;
  gap: 0.75rem;
}

.empty-state i {
  font-size: 4rem;
}

.error-message {
  margin-top: 1rem;
  padding: 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.preview-modal,
.upload-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.preview-content,
.upload-content {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-header,
.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.preview-header h3,
.upload-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #1f2937;
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn,
.close-btn {
  padding: 0.5rem 0.75rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.action-btn:hover,
.close-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.preview-body {
  flex: 1;
  padding: 1.5rem;
  overflow: auto;
}

.preview-image {
  width: 100%;
  height: auto;
  border-radius: 8px;
}

.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem;
  color: #9ca3af;
  gap: 1rem;
}

.preview-placeholder i {
  font-size: 4rem;
}

.download-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.upload-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.upload-zone {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #9ca3af;
  transition: all 0.2s;
}

.upload-zone:hover {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
}

.upload-zone i {
  font-size: 3rem;
}

.file-input {
  display: none;
}

.select-btn {
  padding: 0.75rem 1.5rem;
  background: white;
  border: 2px solid #6366f1;
  color: #6366f1;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.upload-queue {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upload-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
}

.upload-item .file-name {
  flex: 1;
  font-size: 0.875rem;
  color: #374151;
}

.upload-item .file-size {
  font-size: 0.75rem;
  color: #9ca3af;
}

.remove-btn {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: none;
  color: #dc2626;
  cursor: pointer;
}

.start-upload-btn {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.start-upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
