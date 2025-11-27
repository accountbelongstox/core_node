// MCP Management Module
// Manages all MCP (Model Context Protocol) features
// Extensible architecture for adding new MCP functionalities

const McpManager = {
    currentModule: null,
    modules: {},

    async init() {
        this.registerModules();
        this.renderMenu();
        this.setupEventListeners();

        // Load default module
        await this.loadModule('screenshots');
    },

    /**
     * Register all MCP modules
     * Extensible: Add new modules here
     */
    registerModules() {
        this.modules = {
            'screenshots': {
                name: 'Screenshot Management',
                icon: '📷',
                component: McpScreenshotModule
            },
            'task-dispatch': {
                name: 'Task Dispatch',
                icon: '📋',
                component: McpTaskDispatchModule
            },
            'prompt-mappings': {
                name: 'Prompt Mappings',
                icon: '🔄',
                component: McpPromptMappingsModule
            },
            'settings': {
                name: 'MCP Settings',
                icon: '⚙️',
                component: McpSettingsModule
            }
        };
    },

    /**
     * Render menu for all modules
     */
    renderMenu() {
        const menuContainer = document.getElementById('mcp-menu-container');
        if (!menuContainer) return;

        menuContainer.innerHTML = '';

        Object.entries(this.modules).forEach(([moduleId, module]) => {
            const menuItem = document.createElement('div');
            menuItem.className = 'mcp-menu-item';
            menuItem.dataset.module = moduleId;
            menuItem.innerHTML = `
                <span class="mcp-menu-icon">${module.icon}</span>
                <span class="mcp-menu-text">${module.name}</span>
            `;

            menuItem.addEventListener('click', () => this.loadModule(moduleId));
            menuContainer.appendChild(menuItem);
        });
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Global shortcuts can be added here
    },

    /**
     * Load a specific module
     */
    async loadModule(moduleId) {
        const module = this.modules[moduleId];
        if (!module) {
            console.error('[McpManager] Module not found:', moduleId);
            return;
        }

        // Update active menu item
        document.querySelectorAll('.mcp-menu-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`.mcp-menu-item[data-module="${moduleId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Load module content
        const contentContainer = document.getElementById('mcp-content-container');
        if (contentContainer) {
            contentContainer.innerHTML = '<div style="padding: 20px; color: #ccc;">Loading...</div>';

            if (module.component && module.component.init) {
                await module.component.init(contentContainer);
            }
        }

        this.currentModule = moduleId;
    }
};

/**
 * Screenshot Management Module
 */
const McpScreenshotModule = {
    screenshots: [],
    selectedScreenshot: null,

    async init(container) {
        container.innerHTML = this.getTemplate();
        // Move modals to body to avoid overflow:hidden clipping from parent .card
        this.moveModalsToBody();
        this.setupEventListeners();
        await this.loadScreenshots();
    },

    moveModalsToBody() {
        const modals = [
            document.getElementById('mcp-ss-upload-modal'),
            document.getElementById('mcp-ss-batch-modal')
        ];
        modals.forEach(modal => {
            if (modal && modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
        });
    },

    getTemplate() {
        return `
            <div class="mcp-module-container">
                <div class="mcp-module-header">
                    <h2>📷 Screenshot Management</h2>
                    <div class="mcp-module-actions">
                        <button id="mcp-ss-upload-btn" class="mcp-btn mcp-btn-primary">
                            📤 Upload Screenshot
                        </button>
                        <button id="mcp-ss-batch-upload-btn" class="mcp-btn mcp-btn-success">
                            📸 Batch Upload & Merge
                        </button>
                        <button id="mcp-ss-refresh-btn" class="mcp-btn mcp-btn-secondary">
                            🔄 Refresh
                        </button>
                        <button id="mcp-ss-clear-all-btn" class="mcp-btn mcp-btn-danger">
                            🗑 Clear All
                        </button>
                    </div>
                </div>

                <div class="mcp-module-content">
                    <div class="mcp-ss-split-view">
                        <!-- Left: Screenshot List -->
                        <div class="mcp-ss-list-panel">
                            <div class="mcp-ss-stats" id="mcp-ss-stats">
                                <span>Total: 0</span> | <span>Size: 0 MB</span>
                            </div>
                            <div class="mcp-ss-list" id="mcp-ss-list">
                                <!-- Screenshot items will be rendered here -->
                            </div>
                        </div>

                        <!-- Right: Screenshot Detail -->
                        <div class="mcp-ss-detail-panel" id="mcp-ss-detail-panel">
                            <div class="mcp-ss-detail-empty">
                                <p>📷 Select a screenshot to view details</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Upload Modal -->
                <div id="mcp-ss-upload-modal" class="mcp-modal" style="display: none;">
                    <div class="mcp-modal-content">
                        <div class="mcp-modal-header">
                            <h3>Upload Screenshot</h3>
                            <button class="mcp-modal-close" id="mcp-ss-upload-modal-close">&times;</button>
                        </div>
                        <div class="mcp-modal-body">
                            <div class="mcp-form-group">
                                <label>Image File *</label>
                                <input type="file" id="mcp-ss-file-input" accept="image/*" required>
                                <div id="mcp-ss-file-preview" style="margin-top: 10px;"></div>
                            </div>
                            <div class="mcp-form-group">
                                <label>ID (Optional, auto-generated if empty)</label>
                                <input type="text" id="mcp-ss-id-input" placeholder="e.g., ss_20231127_001">
                            </div>
                            <div class="mcp-form-group">
                                <label>Description</label>
                                <textarea id="mcp-ss-description-input" rows="3" placeholder="Describe this screenshot..."></textarea>
                            </div>
                            <div class="mcp-form-group">
                                <label>Keywords (comma separated)</label>
                                <input type="text" id="mcp-ss-keywords-input" placeholder="e.g., ui, error, dashboard">
                            </div>
                        </div>
                        <div class="mcp-modal-footer">
                            <button id="mcp-ss-upload-submit-btn" class="mcp-btn mcp-btn-primary">Upload</button>
                            <button id="mcp-ss-upload-cancel-btn" class="mcp-btn mcp-btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>

                <!-- Batch Upload Modal -->
                <div id="mcp-ss-batch-modal" class="mcp-modal" style="display: none;">
                    <div class="mcp-modal-content mcp-modal-lg">
                        <div class="mcp-modal-header">
                            <h3>📸 Batch Upload & Merge Screenshots</h3>
                            <button class="mcp-modal-close" id="mcp-ss-batch-modal-close">&times;</button>
                        </div>
                        <div class="mcp-modal-body">
                            <div class="mcp-form-group">
                                <label>Select Multiple Images *</label>
                                <input type="file" id="mcp-ss-batch-file-input" accept="image/*" multiple required>
                                <small style="color: #888;">Select multiple images. Each image can have its own description as title.</small>
                            </div>

                            <div class="mcp-form-group">
                                <label>Common Keyword</label>
                                <input type="text" id="mcp-ss-batch-keyword-input" placeholder="e.g., feature_demo, bug_report">
                            </div>

                            <div class="mcp-form-group">
                                <label>ID (Optional)</label>
                                <input type="text" id="mcp-ss-batch-id-input" placeholder="Auto-generated if empty">
                            </div>

                            <div id="mcp-ss-batch-preview-container" style="display: none;">
                                <label>Image Descriptions (shown as titles above each image)</label>
                                <div id="mcp-ss-batch-items" class="mcp-batch-items"></div>
                            </div>

                            <div class="mcp-form-group" style="margin-top: 15px;">
                                <label>
                                    <input type="checkbox" id="mcp-ss-batch-merge-checkbox" checked>
                                    Merge all images into one (with descriptions as section titles)
                                </label>
                            </div>
                        </div>
                        <div class="mcp-modal-footer">
                            <button id="mcp-ss-batch-submit-btn" class="mcp-btn mcp-btn-primary">Upload & Merge</button>
                            <button id="mcp-ss-batch-cancel-btn" class="mcp-btn mcp-btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    setupEventListeners() {
        // Upload button
        document.getElementById('mcp-ss-upload-btn').addEventListener('click', () => {
            this.showUploadModal();
        });

        // Batch upload button
        document.getElementById('mcp-ss-batch-upload-btn').addEventListener('click', () => {
            this.showBatchUploadModal();
        });

        // Refresh button
        document.getElementById('mcp-ss-refresh-btn').addEventListener('click', () => {
            this.loadScreenshots();
        });

        // Clear all button
        document.getElementById('mcp-ss-clear-all-btn').addEventListener('click', () => {
            this.clearAllScreenshots();
        });

        // Upload modal events
        document.getElementById('mcp-ss-upload-modal-close').addEventListener('click', () => {
            this.hideUploadModal();
        });

        document.getElementById('mcp-ss-upload-cancel-btn').addEventListener('click', () => {
            this.hideUploadModal();
        });

        document.getElementById('mcp-ss-upload-submit-btn').addEventListener('click', () => {
            this.uploadScreenshot();
        });

        // File input preview
        document.getElementById('mcp-ss-file-input').addEventListener('change', (e) => {
            this.previewFile(e.target.files[0]);
        });

        // Batch upload modal events
        document.getElementById('mcp-ss-batch-modal-close').addEventListener('click', () => {
            this.hideBatchUploadModal();
        });

        document.getElementById('mcp-ss-batch-cancel-btn').addEventListener('click', () => {
            this.hideBatchUploadModal();
        });

        document.getElementById('mcp-ss-batch-submit-btn').addEventListener('click', () => {
            this.uploadBatch();
        });

        document.getElementById('mcp-ss-batch-file-input').addEventListener('change', (e) => {
            this.previewBatchFiles(e.target.files);
        });

        document.getElementById('mcp-ss-batch-merge-checkbox').addEventListener('change', (e) => {
            const submitBtn = document.getElementById('mcp-ss-batch-submit-btn');
            submitBtn.textContent = e.target.checked ? 'Upload & Merge' : 'Upload All Separately';
        });
    },

    async loadScreenshots() {
        try {
            const response = await APIClient.get('/api/mcp/v1/screenshots/');
            const data = await response.json();

            if (data.success) {
                this.screenshots = data.data.screenshots;
                this.renderScreenshots();
                await this.loadStats();
            } else {
                console.error('[McpScreenshotModule] Failed to load screenshots:', data.error);
            }
        } catch (error) {
            console.error('[McpScreenshotModule] Error loading screenshots:', error);
        }
    },

    async loadStats() {
        try {
            const response = await APIClient.get('/api/mcp/v1/screenshots/stats');
            const data = await response.json();

            if (data.success) {
                const statsEl = document.getElementById('mcp-ss-stats');
                if (statsEl) {
                    statsEl.innerHTML = `
                        <span>Total: ${data.data.total_count}</span> |
                        <span>Size: ${data.data.total_size_mb} MB</span>
                    `;
                }
            }
        } catch (error) {
            console.error('[McpScreenshotModule] Error loading stats:', error);
        }
    },

    renderScreenshots() {
        const listEl = document.getElementById('mcp-ss-list');
        if (!listEl) return;

        if (this.screenshots.length === 0) {
            listEl.innerHTML = `
                <div class="mcp-ss-list-empty">
                    <p>No screenshots found</p>
                    <button class="mcp-btn mcp-btn-primary" onclick="McpScreenshotModule.showUploadModal()">
                        📤 Upload Your First Screenshot
                    </button>
                </div>
            `;
            return;
        }

        listEl.innerHTML = '';

        this.screenshots.forEach(screenshot => {
            const item = document.createElement('div');
            item.className = 'mcp-ss-list-item';
            item.dataset.id = screenshot.id;

            const keywords = screenshot.keywords.slice(0, 3).join(', ');
            const truncatedDesc = screenshot.description.length > 50
                ? screenshot.description.substring(0, 50) + '...'
                : screenshot.description;

            item.innerHTML = `
                <div class="mcp-ss-list-item-header">
                    <span class="mcp-ss-list-item-id">${screenshot.id}</span>
                    <span class="mcp-ss-list-item-date">${screenshot.created_at}</span>
                </div>
                <div class="mcp-ss-list-item-desc">${truncatedDesc || 'No description'}</div>
                ${keywords ? `<div class="mcp-ss-list-item-keywords">${keywords}</div>` : ''}
            `;

            item.addEventListener('click', () => {
                this.showScreenshotDetail(screenshot);
            });

            listEl.appendChild(item);
        });
    },

    showScreenshotDetail(screenshot) {
        this.selectedScreenshot = screenshot;

        // Update active item
        document.querySelectorAll('.mcp-ss-list-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`.mcp-ss-list-item[data-id="${screenshot.id}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        const detailPanel = document.getElementById('mcp-ss-detail-panel');
        if (!detailPanel) return;

        // Get file extension from mime_type for AI-friendly URLs
        const extMap = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp'
        };
        const fileExt = extMap[screenshot.mime_type] || 'jpg';
        const fileUrl = `/api/mcp/v1/screenshots/${screenshot.id}.${fileExt}`;
        const fullUrl = window.location.origin + fileUrl;
        const keywords = screenshot.keywords.join(', ') || 'None';
        const mergedInfo = screenshot.merged_info ? `
            <div class="mcp-info-row">
                <label>Merged Images:</label>
                <span>${screenshot.merged_info.image_count} images (${screenshot.merged_info.width}x${screenshot.merged_info.height}px)</span>
            </div>
        ` : '';

        detailPanel.innerHTML = `
            <div class="mcp-ss-detail-content">
                <div class="mcp-ss-detail-header">
                    <h3>${screenshot.id}</h3>
                    <div class="mcp-ss-detail-actions">
                        <a href="${fileUrl}" download="${screenshot.original_name}" class="mcp-btn mcp-btn-success mcp-btn-sm">
                            ⬇️ Download
                        </a>
                        <button class="mcp-btn mcp-btn-danger mcp-btn-sm" onclick="McpScreenshotModule.deleteScreenshot('${screenshot.id}')">
                            🗑 Delete
                        </button>
                    </div>
                </div>

                <div class="mcp-ss-detail-image">
                    <img src="${fileUrl}" alt="${screenshot.original_name}" onclick="window.open('${fileUrl}', '_blank')" style="cursor: zoom-in;" />
                </div>

                <div class="mcp-ss-detail-info">
                    <div class="mcp-info-row">
                        <label>Original Name:</label>
                        <span>${screenshot.original_name}</span>
                    </div>
                    <div class="mcp-info-row">
                        <label>Description:</label>
                        <span>${screenshot.description || 'None'}</span>
                    </div>
                    <div class="mcp-info-row">
                        <label>Keywords:</label>
                        <span>${keywords}</span>
                    </div>
                    ${mergedInfo}
                    <div class="mcp-info-row">
                        <label>Size:</label>
                        <span>${(screenshot.size / 1024).toFixed(2)} KB</span>
                    </div>
                    <div class="mcp-info-row">
                        <label>Type:</label>
                        <span>${screenshot.mime_type}</span>
                    </div>
                    <div class="mcp-info-row">
                        <label>Created:</label>
                        <span>${screenshot.created_at}</span>
                    </div>
                </div>

                <div class="mcp-ss-url-section">
                    <h4>🤖 AI Download URLs</h4>
                    <p class="mcp-hint">Use these URLs for AI/MCP to fetch and analyze this image</p>
                    
                    <div class="mcp-url-group">
                        <label>Direct File URL:</label>
                        <div class="mcp-url-box">
                            <input type="text" readonly value="${fullUrl}" id="mcp-url-direct" />
                            <button class="mcp-btn mcp-btn-sm" onclick="McpScreenshotModule.copyToClipboard('mcp-url-direct')">📋</button>
                        </div>
                    </div>

                    <div class="mcp-url-group">
                        <label>API Endpoint (JSON metadata):</label>
                        <div class="mcp-url-box">
                            <input type="text" readonly value="${window.location.origin}/api/mcp/v1/screenshots/${screenshot.id}" id="mcp-url-api" />
                            <button class="mcp-btn mcp-btn-sm" onclick="McpScreenshotModule.copyToClipboard('mcp-url-api')">📋</button>
                        </div>
                    </div>

                    <div class="mcp-url-group">
                        <label>MCP Resource URI:</label>
                        <div class="mcp-url-box">
                            <input type="text" readonly value="mcp://screenshots/${screenshot.id}" id="mcp-url-mcp" />
                            <button class="mcp-btn mcp-btn-sm" onclick="McpScreenshotModule.copyToClipboard('mcp-url-mcp')">📋</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    copyToClipboard(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        const text = input.value;
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showCopySuccess(input);
            }).catch(() => {
                // Fallback to execCommand
                this.fallbackCopy(input, text);
            });
        } else {
            // Fallback for older browsers
            this.fallbackCopy(input, text);
        }
    },
    
    fallbackCopy(input, text) {
        // Select the input text
        input.select();
        input.setSelectionRange(0, 99999); // For mobile
        
        try {
            document.execCommand('copy');
            this.showCopySuccess(input);
        } catch (err) {
            console.error('Copy failed:', err);
            alert('Copy failed. Please select and copy manually.');
        }
    },
    
    showCopySuccess(input) {
        const btn = input.nextElementSibling;
        if (btn) {
            const original = btn.textContent;
            btn.textContent = '✓ Copied';
            btn.style.background = '#28a745';
            setTimeout(() => { 
                btn.textContent = original;
                btn.style.background = '';
            }, 1500);
        }
    },

    showUploadModal() {
        const modal = document.getElementById('mcp-ss-upload-modal');
        // Move modal to body to ensure it's on top
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
    },

    hideUploadModal() {
        document.getElementById('mcp-ss-upload-modal').style.display = 'none';
        document.getElementById('mcp-ss-file-input').value = '';
        document.getElementById('mcp-ss-id-input').value = '';
        document.getElementById('mcp-ss-description-input').value = '';
        document.getElementById('mcp-ss-keywords-input').value = '';
        document.getElementById('mcp-ss-file-preview').innerHTML = '';
    },

    previewFile(file) {
        if (!file) return;

        const previewEl = document.getElementById('mcp-ss-file-preview');
        const reader = new FileReader();

        reader.onload = (e) => {
            previewEl.innerHTML = `
                <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 4px;" />
            `;
        };

        reader.readAsDataURL(file);
    },

    async uploadScreenshot(replace = false) {
        const fileInput = document.getElementById('mcp-ss-file-input');
        const id = document.getElementById('mcp-ss-id-input').value.trim();
        const description = document.getElementById('mcp-ss-description-input').value.trim();
        const keywords = document.getElementById('mcp-ss-keywords-input').value.trim();

        if (!fileInput.files || fileInput.files.length === 0) {
            alert('Please select an image file');
            return;
        }

        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        if (id) formData.append('id', id);
        if (description) formData.append('description', description);
        if (keywords) formData.append('keywords', keywords);
        if (replace) formData.append('replace', 'true');

        try {
            const response = await fetch('/api/mcp/v1/screenshots/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert('Screenshot uploaded successfully!');
                this.hideUploadModal();
                await this.loadScreenshots();
            } else if (data.exists && data.existing_id) {
                // ID already exists, ask user if they want to replace
                if (confirm(`Screenshot with ID "${data.existing_id}" already exists.\n\nDo you want to replace it?`)) {
                    await this.uploadScreenshot(true);
                }
            } else {
                alert('Upload failed: ' + data.error);
            }
        } catch (error) {
            console.error('[McpScreenshotModule] Upload error:', error);
            alert('Upload failed: ' + error.message);
        }
    },

    async deleteScreenshot(id) {
        if (!confirm(`Are you sure you want to delete screenshot "${id}"?`)) {
            return;
        }

        try {
            const response = await APIClient.delete(`/api/mcp/v1/screenshots/${id}`);
            const data = await response.json();

            if (data.success) {
                alert('Screenshot deleted successfully');
                await this.loadScreenshots();
                document.getElementById('mcp-ss-detail-panel').innerHTML = `
                    <div class="mcp-ss-detail-empty">
                        <p>📷 Select a screenshot to view details</p>
                    </div>
                `;
            } else {
                alert('Delete failed: ' + data.error);
            }
        } catch (error) {
            console.error('[McpScreenshotModule] Delete error:', error);
            alert('Delete failed: ' + error.message);
        }
    },

    async clearAllScreenshots() {
        if (!confirm('⚠️ WARNING: This will delete ALL screenshots. Are you sure?')) {
            return;
        }

        if (!confirm('This action cannot be undone. Really delete ALL screenshots?')) {
            return;
        }

        try {
            const response = await APIClient.delete('/api/mcp/v1/screenshots/clear-all/confirm');
            const data = await response.json();

            if (data.success) {
                alert(`All screenshots cleared (${data.deleted_count} deleted)`);
                await this.loadScreenshots();
                document.getElementById('mcp-ss-detail-panel').innerHTML = `
                    <div class="mcp-ss-detail-empty">
                        <p>📷 Select a screenshot to view details</p>
                    </div>
                `;
            } else {
                alert('Clear failed: ' + data.error);
            }
        } catch (error) {
            console.error('[McpScreenshotModule] Clear all error:', error);
            alert('Clear failed: ' + error.message);
        }
    },

    copyUrl(url) {
        const fullUrl = window.location.origin + url;
        navigator.clipboard.writeText(fullUrl).then(() => {
            alert('URL copied to clipboard!');
        });
    },

    // Batch upload methods
    showBatchUploadModal() {
        const modal = document.getElementById('mcp-ss-batch-modal');
        // Move modal to body to ensure it's on top
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
    },

    hideBatchUploadModal() {
        document.getElementById('mcp-ss-batch-modal').style.display = 'none';
        document.getElementById('mcp-ss-batch-file-input').value = '';
        document.getElementById('mcp-ss-batch-keyword-input').value = '';
        document.getElementById('mcp-ss-batch-id-input').value = '';
        document.getElementById('mcp-ss-batch-items').innerHTML = '';
        document.getElementById('mcp-ss-batch-preview-container').style.display = 'none';
        document.getElementById('mcp-ss-batch-merge-checkbox').checked = true;
        document.getElementById('mcp-ss-batch-submit-btn').textContent = 'Upload & Merge';
    },

    previewBatchFiles(files) {
        const container = document.getElementById('mcp-ss-batch-preview-container');
        const itemsContainer = document.getElementById('mcp-ss-batch-items');

        if (!files || files.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        itemsContainer.innerHTML = '';

        Array.from(files).forEach((file, index) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const item = document.createElement('div');
                item.className = 'mcp-batch-item';
                item.innerHTML = `
                    <div class="mcp-batch-item-preview">
                        <img src="${e.target.result}" alt="${file.name}" />
                    </div>
                    <div class="mcp-batch-item-info">
                        <div class="mcp-batch-item-name">${index + 1}. ${file.name}</div>
                        <input type="text" class="mcp-batch-desc-input" data-index="${index}" 
                               placeholder="Description (shown as title above this image)" />
                    </div>
                `;
                itemsContainer.appendChild(item);
            };

            reader.readAsDataURL(file);
        });
    },

    async uploadBatch(replace = false) {
        const fileInput = document.getElementById('mcp-ss-batch-file-input');
        const keyword = document.getElementById('mcp-ss-batch-keyword-input').value.trim();
        const id = document.getElementById('mcp-ss-batch-id-input').value.trim();
        const shouldMerge = document.getElementById('mcp-ss-batch-merge-checkbox').checked;

        if (!fileInput.files || fileInput.files.length === 0) {
            alert('Please select at least one image file');
            return;
        }

        // Collect descriptions from inputs
        const descInputs = document.querySelectorAll('.mcp-batch-desc-input');
        const descriptions = [];
        descInputs.forEach((input, index) => {
            descriptions[index] = input.value.trim();
        });

        const formData = new FormData();

        // Add all files
        Array.from(fileInput.files).forEach((file, index) => {
            formData.append('images[]', file);
        });

        // Add descriptions as JSON array
        formData.append('descriptions', JSON.stringify(descriptions));

        if (keyword) {
            formData.append('keyword', keyword);
        }

        if (id) {
            formData.append('id', id);
        }

        if (replace) {
            formData.append('replace', 'true');
        }

        const submitBtn = document.getElementById('mcp-ss-batch-submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Uploading...';
        submitBtn.disabled = true;

        try {
            const endpoint = shouldMerge 
                ? '/api/mcp/v1/screenshots/upload-merge'
                : '/api/mcp/v1/screenshots/upload-batch';

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                const message = shouldMerge
                    ? 'Images merged and uploaded successfully!'
                    : `Batch upload completed: ${data.data.success_count}/${data.data.total} successful`;
                alert(message);
                this.hideBatchUploadModal();
                await this.loadScreenshots();
            } else if (data.exists && data.existing_id) {
                // ID already exists, ask user if they want to replace
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                if (confirm(`Screenshot with ID "${data.existing_id}" already exists.\n\nDo you want to replace it?`)) {
                    await this.uploadBatch(true);
                }
                return;
            } else {
                alert('Upload failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('[McpScreenshotModule] Batch upload error:', error);
            alert('Upload failed: ' + error.message);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }
};

/**
 * Task Dispatch Module
 */
const McpTaskDispatchModule = {
    categories: [],
    selectedCategory: null,
    tasks: [],

    async init(container) {
        container.innerHTML = this.getTemplate();
        // Move modal to body to avoid overflow:hidden clipping
        const modal = document.getElementById('mcp-td-create-modal');
        if (modal && modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        this.setupEventListeners();
        await this.loadCategories();
    },

    getTemplate() {
        return `
            <div class="mcp-module-container">
                <div class="mcp-module-header">
                    <h2>📋 Task Dispatch Management</h2>
                    <div class="mcp-module-actions">
                        <button id="mcp-td-refresh-btn" class="mcp-btn mcp-btn-secondary">🔄 Refresh</button>
                        <button id="mcp-td-create-category-btn" class="mcp-btn mcp-btn-primary">➕ New Category</button>
                    </div>
                </div>

                <div class="mcp-module-content">
                    <div class="mcp-td-split-view">
                        <div class="mcp-td-categories-panel">
                            <div class="mcp-td-panel-header">Categories</div>
                            <div class="mcp-td-categories" id="mcp-td-categories"></div>
                        </div>

                        <div class="mcp-td-tasks-panel" id="mcp-td-tasks-panel">
                            <div class="mcp-td-detail-empty">
                                <p>📋 Select a category to view tasks</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="mcp-td-create-modal" class="mcp-modal" style="display: none;">
                    <div class="mcp-modal-content">
                        <div class="mcp-modal-header">
                            <h3>Create Category</h3>
                            <button class="mcp-modal-close" id="mcp-td-modal-close">&times;</button>
                        </div>
                        <div class="mcp-modal-body">
                            <div class="mcp-form-group">
                                <label>Category ID *</label>
                                <input type="text" id="mcp-td-category-id" placeholder="e.g., my-tasks">
                            </div>
                            <div class="mcp-form-group">
                                <label>Name *</label>
                                <input type="text" id="mcp-td-category-name" placeholder="e.g., My Tasks">
                            </div>
                            <div class="mcp-form-group">
                                <label>Path *</label>
                                <input type="text" id="mcp-td-category-path" placeholder="e.g., /path/to/tasks">
                            </div>
                        </div>
                        <div class="mcp-modal-footer">
                            <button id="mcp-td-create-submit" class="mcp-btn mcp-btn-primary">Create</button>
                            <button id="mcp-td-create-cancel" class="mcp-btn mcp-btn-secondary">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    setupEventListeners() {
        document.getElementById('mcp-td-refresh-btn').addEventListener('click', () => this.loadCategories());
        document.getElementById('mcp-td-create-category-btn').addEventListener('click', () => this.showCreateModal());
        document.getElementById('mcp-td-modal-close').addEventListener('click', () => this.hideCreateModal());
        document.getElementById('mcp-td-create-cancel').addEventListener('click', () => this.hideCreateModal());
        document.getElementById('mcp-td-create-submit').addEventListener('click', () => this.createCategory());
    },

    async loadCategories() {
        try {
            const response = await APIClient.get('/api/mcp/v1/task-dispatch/categories');
            const data = await response.json();
            if (data.success) {
                this.categories = data.data.categories;
                this.renderCategories();
            }
        } catch (error) {
            console.error('[McpTaskDispatchModule] Error:', error);
        }
    },

    renderCategories() {
        const container = document.getElementById('mcp-td-categories');
        if (!container) return;

        if (this.categories.length === 0) {
            container.innerHTML = '<div class="mcp-td-empty">No categories found</div>';
            return;
        }

        container.innerHTML = '';
        this.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'mcp-td-category-item' + (this.selectedCategory?.id === cat.id ? ' active' : '');
            item.innerHTML = `
                <div class="mcp-td-cat-name">${cat.name}</div>
                <div class="mcp-td-cat-id">${cat.id}</div>
            `;
            item.addEventListener('click', () => this.selectCategory(cat));
            container.appendChild(item);
        });
    },

    async selectCategory(category) {
        this.selectedCategory = category;
        this.renderCategories();
        await this.loadTasks(category.id);
    },

    async loadTasks(categoryId) {
        const panel = document.getElementById('mcp-td-tasks-panel');
        panel.innerHTML = '<div style="padding: 20px; color: #888;">Loading tasks...</div>';

        try {
            const [tasksRes, statsRes] = await Promise.all([
                APIClient.get(`/api/mcp/v1/task-dispatch/queue/${categoryId}/tasks`),
                APIClient.get(`/api/mcp/v1/task-dispatch/queue/${categoryId}/stats`)
            ]);
            const tasksData = await tasksRes.json();
            const statsData = await statsRes.json();

            if (tasksData.success) {
                this.tasks = tasksData.data.tasks;
                this.renderTasks(statsData.data?.stats || {});
            }
        } catch (error) {
            panel.innerHTML = '<div class="mcp-error">Failed to load tasks</div>';
        }
    },

    renderTasks(stats) {
        const panel = document.getElementById('mcp-td-tasks-panel');
        const cat = this.selectedCategory;

        panel.innerHTML = `
            <div class="mcp-td-tasks-header">
                <h3>${cat.name}</h3>
                <div class="mcp-td-stats">
                    <span>Total: ${stats.total || 0}</span>
                    <span>Pending: ${stats.pending || 0}</span>
                    <span>Completed: ${stats.completed || 0}</span>
                </div>
            </div>
            <div class="mcp-td-tasks-list" id="mcp-td-tasks-list"></div>
        `;

        const list = document.getElementById('mcp-td-tasks-list');
        if (this.tasks.length === 0) {
            list.innerHTML = '<div class="mcp-td-empty">No tasks in this category</div>';
            return;
        }

        this.tasks.forEach(task => {
            const statusClass = task.status === 'completed' ? 'completed' : (task.status === 'in_progress' ? 'in-progress' : 'pending');
            const item = document.createElement('div');
            item.className = 'mcp-td-task-item';
            item.innerHTML = `
                <div class="mcp-td-task-header">
                    <span class="mcp-td-task-file">${task.file_path || task.id}</span>
                    <span class="mcp-td-task-status ${statusClass}">${task.status}</span>
                </div>
                <div class="mcp-td-task-meta">
                    <span>${task.created_at || ''}</span>
                </div>
            `;
            list.appendChild(item);
        });
    },

    showCreateModal() {
        const modal = document.getElementById('mcp-td-create-modal');
        // Move modal to body to ensure it's on top
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
    },

    hideCreateModal() {
        document.getElementById('mcp-td-create-modal').style.display = 'none';
        document.getElementById('mcp-td-category-id').value = '';
        document.getElementById('mcp-td-category-name').value = '';
        document.getElementById('mcp-td-category-path').value = '';
    },

    async createCategory() {
        const id = document.getElementById('mcp-td-category-id').value.trim();
        const name = document.getElementById('mcp-td-category-name').value.trim();
        const path = document.getElementById('mcp-td-category-path').value.trim();

        if (!id || !name || !path) {
            alert('All fields are required');
            return;
        }

        try {
            const response = await fetch('/api/mcp/v1/task-dispatch/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, path })
            });
            const data = await response.json();
            if (data.success) {
                alert('Category created successfully');
                this.hideCreateModal();
                await this.loadCategories();
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
};

/**
 * Prompt Mappings Module
 */
const McpPromptMappingsModule = {
    mappings: {},
    selectedCategory: null,

    async init(container) {
        container.innerHTML = this.getTemplate();
        this.setupEventListeners();
        await this.loadMappings();
    },

    getTemplate() {
        return `
            <div class="mcp-module-container">
                <div class="mcp-module-header">
                    <h2>🔄 Prompt Mappings</h2>
                    <div class="mcp-module-actions">
                        <button id="mcp-pm-refresh-btn" class="mcp-btn mcp-btn-secondary">🔄 Refresh</button>
                    </div>
                </div>

                <div class="mcp-module-content">
                    <div class="mcp-pm-split-view">
                        <div class="mcp-pm-list-panel">
                            <div class="mcp-pm-panel-header">Categories</div>
                            <div class="mcp-pm-list" id="mcp-pm-list"></div>
                        </div>

                        <div class="mcp-pm-editor-panel" id="mcp-pm-editor-panel">
                            <div class="mcp-pm-detail-empty">
                                <p>🔄 Select a category to edit its prompt mapping</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    setupEventListeners() {
        document.getElementById('mcp-pm-refresh-btn').addEventListener('click', () => this.loadMappings());
    },

    async loadMappings() {
        try {
            const response = await APIClient.get('/api/mcp/v1/task-dispatch/mappings');
            const data = await response.json();
            if (data.success) {
                this.mappings = data.data.mappings;
                this.renderMappingsList();
            }
        } catch (error) {
            console.error('[McpPromptMappingsModule] Error:', error);
        }
    },

    renderMappingsList() {
        const list = document.getElementById('mcp-pm-list');
        if (!list) return;

        const categories = Object.keys(this.mappings);
        if (categories.length === 0) {
            list.innerHTML = '<div class="mcp-pm-empty">No mappings found</div>';
            return;
        }

        list.innerHTML = '';
        categories.forEach(catId => {
            const mapping = this.mappings[catId];
            const item = document.createElement('div');
            item.className = 'mcp-pm-item' + (this.selectedCategory === catId ? ' active' : '');
            item.innerHTML = `
                <div class="mcp-pm-item-name">${catId}</div>
                <div class="mcp-pm-item-info">
                    ${mapping.prefix ? '✓ Prefix' : ''} 
                    ${mapping.suffix ? '✓ Suffix' : ''} 
                    ${Object.keys(mapping.replace_map || {}).length > 0 ? '✓ Replace' : ''}
                </div>
            `;
            item.addEventListener('click', () => this.selectMapping(catId));
            list.appendChild(item);
        });
    },

    selectMapping(categoryId) {
        this.selectedCategory = categoryId;
        this.renderMappingsList();
        this.renderEditor(categoryId);
    },

    renderEditor(categoryId) {
        const panel = document.getElementById('mcp-pm-editor-panel');
        const mapping = this.mappings[categoryId] || { prefix: '', suffix: '', replace_map: {} };
        const replaceMapStr = JSON.stringify(mapping.replace_map || {}, null, 2);

        panel.innerHTML = `
            <div class="mcp-pm-editor">
                <div class="mcp-pm-editor-header">
                    <h3>Edit: ${categoryId}</h3>
                    <div class="mcp-pm-editor-actions">
                        <button class="mcp-btn mcp-btn-primary mcp-btn-sm" onclick="McpPromptMappingsModule.saveMapping()">💾 Save</button>
                        <button class="mcp-btn mcp-btn-secondary mcp-btn-sm" onclick="McpPromptMappingsModule.resetMapping('${categoryId}')">↩️ Reset</button>
                        <button class="mcp-btn mcp-btn-danger mcp-btn-sm" onclick="McpPromptMappingsModule.deleteMapping('${categoryId}')">🗑 Delete</button>
                    </div>
                </div>

                <div class="mcp-form-group">
                    <label>Prefix (added before content)</label>
                    <textarea id="mcp-pm-prefix" rows="3" placeholder="Text to add before task content...">${this.escapeHtml(mapping.prefix || '')}</textarea>
                </div>

                <div class="mcp-form-group">
                    <label>Suffix (added after content)</label>
                    <textarea id="mcp-pm-suffix" rows="3" placeholder="Text to add after task content...">${this.escapeHtml(mapping.suffix || '')}</textarea>
                </div>

                <div class="mcp-form-group">
                    <label>Replace Map (JSON: {"search": "replace"})</label>
                    <textarea id="mcp-pm-replace-map" rows="6" placeholder='{"API": "MCP API", "service": "MCP service"}'>${this.escapeHtml(replaceMapStr)}</textarea>
                </div>

                <div class="mcp-pm-preview">
                    <h4>Preview</h4>
                    <div class="mcp-pm-preview-content">
                        <div class="mcp-pm-preview-prefix">${this.escapeHtml(mapping.prefix || '(no prefix)')}</div>
                        <div class="mcp-pm-preview-body">[Task Content Here]</div>
                        <div class="mcp-pm-preview-suffix">${this.escapeHtml(mapping.suffix || '(no suffix)')}</div>
                    </div>
                </div>
            </div>
        `;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    async saveMapping() {
        if (!this.selectedCategory) return;

        const prefix = document.getElementById('mcp-pm-prefix').value;
        const suffix = document.getElementById('mcp-pm-suffix').value;
        let replaceMap = {};

        try {
            const replaceMapStr = document.getElementById('mcp-pm-replace-map').value.trim();
            if (replaceMapStr) {
                replaceMap = JSON.parse(replaceMapStr);
            }
        } catch (e) {
            alert('Invalid JSON in Replace Map');
            return;
        }

        try {
            const response = await fetch(`/api/mcp/v1/task-dispatch/mappings/${this.selectedCategory}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prefix, suffix, replace_map: replaceMap })
            });
            const data = await response.json();
            if (data.success) {
                alert('Mapping saved successfully');
                await this.loadMappings();
                this.renderEditor(this.selectedCategory);
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    },

    async resetMapping(categoryId) {
        if (!confirm(`Reset mapping for "${categoryId}" to default?`)) return;

        try {
            const response = await fetch(`/api/mcp/v1/task-dispatch/mappings/${categoryId}/reset`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                alert('Mapping reset successfully');
                await this.loadMappings();
                this.renderEditor(categoryId);
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    },

    async deleteMapping(categoryId) {
        if (!confirm(`Delete mapping for "${categoryId}"?`)) return;

        try {
            const response = await APIClient.delete(`/api/mcp/v1/task-dispatch/mappings/${categoryId}`);
            const data = await response.json();
            if (data.success) {
                alert('Mapping deleted');
                this.selectedCategory = null;
                await this.loadMappings();
                document.getElementById('mcp-pm-editor-panel').innerHTML = `
                    <div class="mcp-pm-detail-empty">
                        <p>🔄 Select a category to edit its prompt mapping</p>
                    </div>
                `;
            } else {
                alert('Failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }
};

/**
 * MCP Settings Module
 */
const McpSettingsModule = {
    async init(container) {
        container.innerHTML = this.getTemplate();
        await this.loadSettings();
    },

    getTemplate() {
        return `
            <div class="mcp-module-container">
                <div class="mcp-module-header">
                    <h2>⚙️ MCP Settings</h2>
                </div>

                <div class="mcp-module-content" style="padding: 20px;">
                    <div class="mcp-settings-section">
                        <h3>📷 Screenshot Settings</h3>
                        <div class="mcp-settings-info" id="mcp-settings-screenshot-info">
                            Loading...
                        </div>
                    </div>

                    <div class="mcp-settings-section">
                        <h3>🔗 MCP API Endpoints</h3>
                        <div class="mcp-settings-endpoints">
                            <div class="mcp-endpoint-item">
                                <label>Screenshots API:</label>
                                <code>/api/mcp/v1/screenshots/</code>
                            </div>
                            <div class="mcp-endpoint-item">
                                <label>Latest Screenshot:</label>
                                <code>/api/mcp/v1/screenshots/latest</code>
                            </div>
                            <div class="mcp-endpoint-item">
                                <label>Upload Screenshot:</label>
                                <code>POST /api/mcp/v1/screenshots/upload</code>
                            </div>
                            <div class="mcp-endpoint-item">
                                <label>Upload & Merge:</label>
                                <code>POST /api/mcp/v1/screenshots/upload-merge</code>
                            </div>
                            <div class="mcp-endpoint-item">
                                <label>Task Categories:</label>
                                <code>/api/mcp/v1/task-dispatch/categories</code>
                            </div>
                            <div class="mcp-endpoint-item">
                                <label>Prompt Mappings:</label>
                                <code>/api/mcp/v1/task-dispatch/mappings</code>
                            </div>
                        </div>
                    </div>

                    <div class="mcp-settings-section">
                        <h3>🤖 MCP Resource URIs</h3>
                        <div class="mcp-settings-info">
                            <p>Use these URIs with MCP-compatible AI clients:</p>
                            <div class="mcp-endpoint-item">
                                <label>Latest Screenshot:</label>
                                <code>mcp://screenshots/latest</code>
                            </div>
                            <div class="mcp-endpoint-item">
                                <label>Screenshot by ID:</label>
                                <code>mcp://screenshots/{id}</code>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadSettings() {
        try {
            const response = await APIClient.get('/api/mcp/v1/screenshots/stats');
            const data = await response.json();

            if (data.success) {
                const info = document.getElementById('mcp-settings-screenshot-info');
                info.innerHTML = `
                    <div class="mcp-settings-stat">
                        <label>Total Screenshots:</label>
                        <span>${data.data.total_count}</span>
                    </div>
                    <div class="mcp-settings-stat">
                        <label>Total Size:</label>
                        <span>${data.data.total_size_mb} MB</span>
                    </div>
                    <div class="mcp-settings-stat">
                        <label>Storage Directory:</label>
                        <code>${data.data.storage_directory}</code>
                    </div>
                `;
            }
        } catch (error) {
            console.error('[McpSettingsModule] Error:', error);
        }
    }
};
