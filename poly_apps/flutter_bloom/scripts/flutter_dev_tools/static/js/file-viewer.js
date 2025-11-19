/**
 * File Viewer Component
 * Displays file content in the main panel with edit/save functionality
 */

class FileViewer {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentFile = null;
    this.isEditMode = false;
    this.isDirty = false;
  }

  /**
   * Load and display file content
   */
  async loadFile(filePath) {
    try {
      const response = await fetch(`/api/file/content?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();

      if (!data.success) {
        this.showError(data.error || 'Failed to load file');
        return;
      }

      this.currentFile = data;
      this.currentFile.path = filePath;
      this.isEditMode = false;
      this.isDirty = false;

      // Update current path display
      if (window.updateCurrentPathDisplay) {
        window.updateCurrentPathDisplay(filePath, false);
      }

      this.render();
    } catch (error) {
      this.showError(`Failed to load file: ${error.message}`);
    }
  }

  /**
   * Check if file is JSON
   */
  isJsonFile() {
    return this.currentFile && this.currentFile.extension.toLowerCase() === 'json';
  }

  /**
   * Check if file is an image
   */
  isImageFile() {
    if (!this.currentFile) return false;
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    return imageExtensions.includes(this.currentFile.extension.toLowerCase());
  }

  /**
   * Toggle edit mode
   */
  toggleEditMode() {
    if (this.isDirty && !confirm('You have unsaved changes. Continue editing?')) {
      return;
    }
    this.isEditMode = !this.isEditMode;
    this.render();
  }

  /**
   * Save file content
   */
  async saveFile() {
    if (!this.currentFile) {
      alert('No file loaded');
      return;
    }

    const textarea = this.container.querySelector('.file-editor-textarea');
    if (!textarea) {
      alert('Editor not found');
      return;
    }

    const content = textarea.value;
    const validateJson = this.isJsonFile();

    try {
      const response = await fetch('/api/file/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: this.currentFile.path,
          content: content,
          validate_json: validateJson
        })
      });

      const result = await response.json();

      if (!result.success) {
        alert(`Failed to save file: ${result.error}`);
        return;
      }

      // Update current file content and clear dirty flag
      this.currentFile.content = content;
      this.currentFile.size = result.bytes_written || content.length;
      this.isDirty = false;

      alert('File saved successfully!');
      this.render();

    } catch (error) {
      alert(`Failed to save file: ${error.message}`);
    }
  }

  /**
   * Handle content change
   */
  handleContentChange() {
    this.isDirty = true;
  }

  /**
   * Render file content
   */
  render() {
    if (!this.currentFile) {
      return;
    }

    const fileData = this.currentFile;

    // Handle image files separately
    if (this.isImageFile()) {
      this.renderImagePreview();
      return;
    }

    const dirtyIndicator = this.isDirty ? ' (modified)' : '';

    let contentHtml;
    if (this.isEditMode) {
      // Edit mode: textarea
      contentHtml = `
        <textarea class="file-editor-textarea" id="file-editor-textarea">${this.escapeHtml(fileData.content)}</textarea>
      `;
    } else {
      // View mode: pre
      contentHtml = `
        <pre class="file-viewer-pre">${this.escapeHtml(fileData.content)}</pre>
      `;
    }

    const viewerHtml = `
      <div class="file-viewer">
        <div class="file-viewer-header">
          <div class="file-viewer-title">
            <span class="filename">📄 ${this.escapeHtml(fileData.name)}${dirtyIndicator}</span>
            <span class="file-info">${this.formatSize(fileData.size)} • ${fileData.extension}</span>
          </div>
          <div class="file-viewer-actions">
            <button id="toggle-edit-btn" class="btn-action">${this.isEditMode ? 'View' : 'Edit'}</button>
            ${this.isEditMode ? '<button id="save-file-btn" class="btn-action primary">Save</button>' : ''}
          </div>
        </div>
        <div class="file-viewer-content">
          ${contentHtml}
        </div>
      </div>
    `;

    // Find or create file viewer section in container
    let viewerSection = this.container.querySelector('.file-viewer-section');
    if (!viewerSection) {
      viewerSection = document.createElement('div');
      viewerSection.className = 'file-viewer-section';
      this.container.appendChild(viewerSection);
    }

    viewerSection.innerHTML = viewerHtml;

    // Attach event handlers
    const toggleBtn = document.getElementById('toggle-edit-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleEditMode());
    }

    const saveBtn = document.getElementById('save-file-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveFile());
    }

    const textarea = document.getElementById('file-editor-textarea');
    if (textarea) {
      textarea.addEventListener('input', () => this.handleContentChange());
    }
  }

  /**
   * Render image preview with comparison upload
   */
  renderImagePreview() {
    const fileData = this.currentFile;
    const imageUrl = `/api/file/image?path=${encodeURIComponent(fileData.path)}`;

    const viewerHtml = `
      <div class="file-viewer">
        <div class="file-viewer-header">
          <div class="file-viewer-title">
            <span class="filename">🖼️ ${this.escapeHtml(fileData.name)}</span>
            <span class="file-info">${this.formatSize(fileData.size)} • ${fileData.extension}</span>
          </div>
          <div class="file-viewer-actions">
            <button id="upload-comparison-btn" class="btn-action primary">Upload Comparison</button>
          </div>
        </div>
        <div class="file-viewer-content image-viewer-content">
          <div class="image-preview-container">
            <img src="${imageUrl}" alt="${this.escapeHtml(fileData.name)}" class="preview-image" />
          </div>
          <div class="comparison-history">
            <h4 class="history-title">Comparison History</h4>
            <div id="comparison-history-list" class="history-list">
              <div class="loading-message">Loading history...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Find or create file viewer section in container
    let viewerSection = this.container.querySelector('.file-viewer-section');
    if (!viewerSection) {
      viewerSection = document.createElement('div');
      viewerSection.className = 'file-viewer-section';
      this.container.appendChild(viewerSection);
    }

    viewerSection.innerHTML = viewerHtml;

    // Attach event handlers
    const uploadBtn = document.getElementById('upload-comparison-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => this.handleUploadComparison());
    }

    // Load comparison history
    this.loadComparisonHistory();
  }

  /**
   * Handle upload comparison button click
   */
  handleUploadComparison() {
    if (!this.currentFile) return;

    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        // Get app name from current file path
        const appName = this.extractAppName(this.currentFile.path);
        const pageKey = this.extractPageKey(this.currentFile.path);

        if (!appName || !pageKey) {
          alert('Cannot determine app or page from file path');
          return;
        }

        // Create comparison uploader if not exists
        if (!window.comparisonUploader) {
          window.comparisonUploader = new ComparisonUploader();
        }

        // Upload comparison
        await window.comparisonUploader.uploadComparison(
          appName,
          pageKey,
          this.currentFile.path,
          file
        );

        // Reload history
        this.loadComparisonHistory();

      } catch (error) {
        alert(`Failed to upload comparison: ${error.message}`);
      }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
  }

  /**
   * Load comparison history for current image
   */
  async loadComparisonHistory() {
    if (!this.currentFile) return;

    const appName = this.extractAppName(this.currentFile.path);
    const pageKey = this.extractPageKey(this.currentFile.path);

    if (!appName || !pageKey) {
      const historyList = document.getElementById('comparison-history-list');
      if (historyList) {
        historyList.innerHTML = '<div class="empty-message">Cannot determine page from file path</div>';
      }
      return;
    }

    try {
      const response = await fetch(`/api/apps/${appName}/comparison/list/${pageKey}`);
      const data = await response.json();

      const historyList = document.getElementById('comparison-history-list');
      if (!historyList) return;

      if (!data.success || !data.comparisons || data.comparisons.length === 0) {
        historyList.innerHTML = '<div class="empty-message">No comparison history</div>';
        return;
      }

      // Render history items
      historyList.innerHTML = data.comparisons.map(item => `
        <div class="history-item" data-url="${item.download_url}">
          <div class="history-item-name">${this.escapeHtml(item.filename)}</div>
          <div class="history-item-date">${new Date(item.created_at).toLocaleString()}</div>
        </div>
      `).join('');

      // Attach click handlers
      historyList.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.dataset.url;
          this.showComparisonImage(url);
        });
      });

    } catch (error) {
      console.error('Failed to load comparison history:', error);
      const historyList = document.getElementById('comparison-history-list');
      if (historyList) {
        historyList.innerHTML = `<div class="error-message">Failed to load history</div>`;
      }
    }
  }

  /**
   * Show comparison image in a modal or new section
   */
  showComparisonImage(downloadUrl) {
    // Update global comparison URL for prompts
    window.latestComparisonUrl = downloadUrl;

    // Refresh prompts panel to update comparison analysis prompt
    if (window.promptsPanel) {
      window.promptsPanel.render();
    }

    // Open image in new window for viewing
    window.open(downloadUrl, '_blank');
  }

  /**
   * Extract app name from file path
   */
  extractAppName(filePath) {
    // Path format: ...\\lib\\apps\\{app_name}\\...
    const match = filePath.match(/[\\\/]apps[\\\/](app_\w+)[\\\/]/);
    return match ? match[1] : null;
  }

  /**
   * Extract page key from file path
   */
  extractPageKey(filePath) {
    // Try to extract from design_docs_and_progress path
    // Path format: ...\\design_docs_and_progress\\2_page_designs_rough\\{page_key}\\...
    // or: ...\\design_docs_and_progress\\3_page_designs_detailed\\{page_key}\\...
    const roughMatch = filePath.match(/2_page_designs_rough[\\\/]([^\\\/]+)[\\\/]/);
    if (roughMatch) return roughMatch[1];

    const detailedMatch = filePath.match(/3_page_designs_detailed[\\\/]([^\\\/]+)[\\\/]/);
    if (detailedMatch) return detailedMatch[1];

    return null;
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorHtml = `
      <div class="file-viewer">
        <div class="file-viewer-error">
          ⚠️ ${this.escapeHtml(message)}
        </div>
      </div>
    `;

    let viewerSection = this.container.querySelector('.file-viewer-section');
    if (!viewerSection) {
      viewerSection = document.createElement('div');
      viewerSection.className = 'file-viewer-section';
      this.container.appendChild(viewerSection);
    }

    viewerSection.innerHTML = errorHtml;
  }

  /**
   * Clear file viewer
   */
  clear() {
    const viewerSection = this.container.querySelector('.file-viewer-section');
    if (viewerSection) {
      viewerSection.remove();
    }
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Make FileViewer available globally
window.FileViewer = FileViewer;
