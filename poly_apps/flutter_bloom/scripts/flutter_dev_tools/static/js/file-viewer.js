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
