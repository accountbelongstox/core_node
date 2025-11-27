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
            menuContainer.appendChild(menuItem));
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
        this.setupEventListeners();
        await this.loadScreenshots();
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
            </div>
        `;
    },

    setupEventListeners() {
        // Upload button
        document.getElementById('mcp-ss-upload-btn').addEventListener('click', () => {
            this.showUploadModal();
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

        const fileUrl = `/api/mcp/v1/screenshots/${screenshot.id}/file`;
        const keywords = screenshot.keywords.join(', ') || 'None';

        detailPanel.innerHTML = `
            <div class="mcp-ss-detail-content">
                <div class="mcp-ss-detail-header">
                    <h3>${screenshot.id}</h3>
                    <button class="mcp-btn mcp-btn-danger mcp-btn-sm" onclick="McpScreenshotModule.deleteScreenshot('${screenshot.id}')">
                        🗑 Delete
                    </button>
                </div>

                <div class="mcp-ss-detail-image">
                    <img src="${fileUrl}" alt="${screenshot.original_name}" />
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
                    <div class="mcp-info-row">
                        <label>Download URL:</label>
                        <div class="mcp-url-box">
                            <input type="text" readonly value="${window.location.origin}${fileUrl}" />
                            <button class="mcp-btn mcp-btn-sm" onclick="McpScreenshotModule.copyUrl('${fileUrl}')">
                                📋 Copy
                            </button>
                            <a href="${fileUrl}" target="_blank" class="mcp-btn mcp-btn-sm">
                                🔗 Open
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    showUploadModal() {
        document.getElementById('mcp-ss-upload-modal').style.display = 'flex';
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

    async uploadScreenshot() {
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
    }
};

/**
 * Task Dispatch Module (Placeholder)
 */
const McpTaskDispatchModule = {
    async init(container) {
        container.innerHTML = `
            <div class="mcp-module-container">
                <h2>📋 Task Dispatch Management</h2>
                <p style="color: #888;">Coming soon...</p>
            </div>
        `;
    }
};

/**
 * Prompt Mappings Module (Placeholder)
 */
const McpPromptMappingsModule = {
    async init(container) {
        container.innerHTML = `
            <div class="mcp-module-container">
                <h2>🔄 Prompt Mappings Management</h2>
                <p style="color: #888;">Coming soon...</p>
            </div>
        `;
    }
};

/**
 * Settings Module (Placeholder)
 */
const McpSettingsModule = {
    async init(container) {
        container.innerHTML = `
            <div class="mcp-module-container">
                <h2>⚙️ MCP Settings</h2>
                <p style="color: #888;">Coming soon...</p>
            </div>
        `;
    }
};
