<template>
  <div class="code-browser-panel">
    <div class="panel-header">
      <h2 class="module-title">{{ t('codeBrowser.title') }}</h2>
      <p class="module-description">{{ t('modules.codeBrowser.description') }}</p>
    </div>

    <div class="browser-container">
      <!-- Left Panel: File Tree -->
      <div class="file-tree-panel glass-panel">
        <div class="panel-section-header">
          <h3>{{ t('codeBrowser.fileTree') }}</h3>
          <button @click="refreshFileTree" :disabled="isLoadingTree" class="icon-btn">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoadingTree }"></i>
          </button>
        </div>

        <!-- Search -->
        <div class="search-box">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('codeBrowser.search')"
            class="search-input"
          />
        </div>

        <!-- File Tree -->
        <div v-if="fileTree.length" class="file-tree">
          <div
            v-for="file in filteredFiles"
            :key="file.path"
            @click="selectFile(file)"
            :class="['file-item', { active: selectedFile?.path === file.path }]"
          >
            <i :class="['fas', getFileIcon(file.name)]"></i>
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatFileSize(file.size) }}</span>
          </div>
        </div>

        <div v-else-if="isLoadingTree" class="loading-state">
          <i class="fas fa-spinner fa-spin"></i>
          {{ t('common.loading') }}
        </div>

        <div v-else class="empty-state">
          <i class="fas fa-folder-open"></i>
          <p>{{ t('common.noData') }}</p>
        </div>

        <div v-if="treeError" class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <span>{{ treeError }}</span>
        </div>
      </div>

      <!-- Right Panel: File Viewer -->
      <div class="file-viewer-panel glass-panel">
        <div v-if="selectedFile" class="file-content-container">
          <div class="file-header">
            <div class="file-info">
              <i :class="['fas', getFileIcon(selectedFile.name)]"></i>
              <span class="file-path">{{ selectedFile.path }}</span>
            </div>
            <div class="file-actions">
              <button @click="copyFileContent" class="action-btn" :title="t('codeBrowser.copy')">
                <i class="fas fa-copy"></i>
              </button>
              <button @click="downloadFile" class="action-btn" :title="t('codeBrowser.download')">
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>

          <!-- File Content -->
          <div v-if="isLoadingContent" class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            {{ t('common.loading') }}
          </div>

          <div v-else-if="fileContent" class="file-content">
            <pre class="code-block"><code>{{ fileContent }}</code></pre>
          </div>

          <div v-if="contentError" class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <span>{{ contentError }}</span>
          </div>
        </div>

        <div v-else class="empty-viewer">
          <i class="fas fa-file-code"></i>
          <p>{{ t('codeBrowser.openFile') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Code Browser Panel - browse and view code files from backend
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/code-browser APIs

interface FileInfo {
  name: string
  path: string
  size: number
  type: 'file' | 'directory'
}

// Use unified composables
const { t } = useI18n()
const api = useApi()

// State
const fileTree = ref<FileInfo[]>([])
const selectedFile = ref<FileInfo | null>(null)
const fileContent = ref<string | null>(null)
const searchQuery = ref('')
const isLoadingTree = ref(false)
const isLoadingContent = ref(false)
const treeError = ref<string | null>(null)
const contentError = ref<string | null>(null)

// Filtered files based on search
const filteredFiles = computed(() => {
  if (!searchQuery.value) return fileTree.value

  const query = searchQuery.value.toLowerCase()
  return fileTree.value.filter(file =>
    file.name.toLowerCase().includes(query) ||
    file.path.toLowerCase().includes(query)
  )
})

// Fetch file tree from backend
const refreshFileTree = async () => {
  isLoadingTree.value = true
  treeError.value = null

  try {
    const response = await api.get('STATIC_FILE_TREE')

    if (response.success && response.data) {
      // Parse file tree response
      fileTree.value = parseFileTree(response.data)
    } else {
      throw new Error(response.error || t('errors.unknownError'))
    }
  } catch (err: any) {
    treeError.value = err.message || t('errors.networkError')
    console.error('Failed to fetch file tree:', err)
  } finally {
    isLoadingTree.value = false
  }
}

// Parse file tree from backend response
const parseFileTree = (data: any): FileInfo[] => {
  if (Array.isArray(data)) {
    return data.map(item => ({
      name: item.name || item.filename || '',
      path: item.path || item.filepath || '',
      size: item.size || 0,
      type: item.type || 'file'
    }))
  }

  // If data is object with files property
  if (data.files && Array.isArray(data.files)) {
    return parseFileTree(data.files)
  }

  return []
}

// Select and load file
const selectFile = async (file: FileInfo) => {
  if (file.type === 'directory') return

  selectedFile.value = file
  isLoadingContent.value = true
  contentError.value = null
  fileContent.value = null

  try {
    const response = await api.post('CODE_BROWSER_READ_FILE', {
      body: {
        path: file.path
      }
    })

    if (response.success && response.data) {
      // Extract content from response
      fileContent.value = response.data.content || response.data.data || response.data
    } else {
      throw new Error(response.error || t('errors.unknownError'))
    }
  } catch (err: any) {
    contentError.value = err.message || t('errors.networkError')
    console.error('Failed to load file:', err)
  } finally {
    isLoadingContent.value = false
  }
}

// Get file icon based on extension
const getFileIcon = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()

  const iconMap: Record<string, string> = {
    'js': 'fa-file-code',
    'ts': 'fa-file-code',
    'vue': 'fa-file-code',
    'php': 'fa-file-code',
    'py': 'fa-file-code',
    'html': 'fa-file-code',
    'css': 'fa-file-code',
    'json': 'fa-file-code',
    'xml': 'fa-file-code',
    'yaml': 'fa-file-code',
    'yml': 'fa-file-code',
    'md': 'fa-file-alt',
    'txt': 'fa-file-alt',
    'pdf': 'fa-file-pdf',
    'jpg': 'fa-file-image',
    'jpeg': 'fa-file-image',
    'png': 'fa-file-image',
    'gif': 'fa-file-image',
    'zip': 'fa-file-archive',
    'rar': 'fa-file-archive',
    'tar': 'fa-file-archive',
    'gz': 'fa-file-archive'
  }

  return iconMap[ext || ''] || 'fa-file'
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Copy file content
const copyFileContent = async () => {
  if (!fileContent.value) return

  try {
    await navigator.clipboard.writeText(fileContent.value)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Download file
const downloadFile = () => {
  if (!selectedFile.value || !fileContent.value) return

  const blob = new Blob([fileContent.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = selectedFile.value.name
  a.click()
  URL.revokeObjectURL(url)
}

// Load file tree on mount
onMounted(() => {
  refreshFileTree()
})
</script>

<style scoped>
.code-browser-panel {
  padding: 1.5rem;
  height: 100%;
}

.panel-header {
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

.browser-container {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 1.5rem;
  height: calc(100vh - 180px);
}

.glass-panel {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.panel-section-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
}

.icon-btn {
  padding: 0.5rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.icon-btn:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #6366f1;
}

.file-tree {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  background: #f3f4f6;
}

.file-item.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 2px solid #6366f1;
}

.file-item i {
  color: #6b7280;
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  font-size: 0.875rem;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.75rem;
  color: #9ca3af;
  flex-shrink: 0;
}

.file-viewer-panel {
  display: flex;
  flex-direction: column;
}

.file-content-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f3f4f6;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-info i {
  color: #6366f1;
  font-size: 1.25rem;
}

.file-path {
  font-size: 0.875rem;
  color: #6b7280;
  font-family: monospace;
}

.file-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 0.75rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.file-content {
  flex: 1;
  overflow: auto;
  background: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
}

.code-block {
  margin: 0;
  font-family: 'Courier New', Monaco, monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.empty-viewer i {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #9ca3af;
  gap: 0.5rem;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .browser-container {
    grid-template-columns: 1fr;
    height: auto;
  }

  .file-tree-panel {
    max-height: 300px;
  }
}
</style>
