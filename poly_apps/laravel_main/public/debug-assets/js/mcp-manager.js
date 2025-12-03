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
            'voice-subtitle': {
                name: 'Voice Subtitle',
                icon: '🎙️',
                component: McpVoiceSubtitleModule
            },
            'placeholders': {
                name: 'Placeholder Generator',
                icon: '🖼️',
                component: McpPlaceholderModule
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
    async renderMenu() {
        const menuContainer = document.getElementById('mcp-menu-container');
        menuContainer.innerHTML = '';

        const response = await fetch('/debug-assets/debug-tools/templates/mcp-menu-item.html');
        const template = await response.text();

        Object.entries(this.modules).forEach(([moduleId, module]) => {
            const menuItem = document.createElement('div');
            menuItem.className = 'mcp-menu-item';
            menuItem.dataset.module = moduleId;
            menuItem.innerHTML = template.replace('{icon}', module.icon).replace('{name}', module.name);

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

        // Update active menu item
        document.querySelectorAll('.mcp-menu-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`.mcp-menu-item[data-module="${moduleId}"]`);
        activeItem.classList.add('active');

        // Load module content
        const contentContainer = document.getElementById('mcp-content-container');
        const loadingResponse = await fetch('/debug-assets/debug-tools/templates/loading.html');
        contentContainer.innerHTML = await loadingResponse.text();

        await module.component.init(contentContainer);

        this.currentModule = moduleId;
    }
};

/**
 * Screenshot Management Module
 */
const McpScreenshotModule = {
    screenshots: [],
    selectedScreenshot: null,
    uploadMode: 'single',

    async init(container) {
        this.cleanupExistingModals();
        const template = await this.getTemplate();
        container.innerHTML = template;
        // Move modals to body to avoid overflow:hidden clipping from parent .card
        this.moveModalsToBody();
        this.setupEventListeners();
        await this.loadScreenshots();
    },

    cleanupExistingModals() {
        const modalIds = ['mcp-ss-upload-modal', 'mcp-ss-batch-modal'];
        modalIds.forEach((id) => {
            const existing = document.getElementById(id);
            if (existing && existing.parentElement) {
                existing.parentElement.removeChild(existing);
            }
        });
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

    async getTemplate() {
        const response = await fetch('/debug-assets/debug-tools/templates/mcp-screenshot-module.html');
        return await response.text();
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
            this.handleUploadFileSelection(e.target.files);
        });

        document.querySelectorAll('input[name="mcp-ss-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.setUploadMode(e.target.value);
                }
            });
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
        const data = await UnifiedAPIClient.json('/api/mcp/v1/screenshots/', 'GET');
        this.screenshots = data.data.screenshots;
        this.renderScreenshots();
        await this.loadStats();
    },

    async loadStats() {
        const data = await UnifiedAPIClient.json('/api/mcp/v1/screenshots/stats', 'GET');
        const statsEl = document.getElementById('mcp-ss-stats');
        statsEl.innerHTML = `
            <span>Total: ${data.data.total_count}</span> |
            <span>Size: ${data.data.total_size_mb} MB</span>
        `;
    },

    async renderScreenshots() {
        const listEl = document.getElementById('mcp-ss-list');

        if (this.screenshots.length === 0) {
            const response = await fetch('/debug-assets/debug-tools/templates/mcp-screenshot-list-empty.html');
            listEl.innerHTML = await response.text();
            return;
        }

        listEl.innerHTML = '';

        for (const screenshot of this.screenshots) {
            const item = document.createElement('div');
            item.className = 'mcp-ss-list-item';
            item.dataset.id = screenshot.id;

            const keywords = screenshot.keywords.slice(0, 3).join(', ');
            const truncatedDesc = screenshot.description.length > 50
                ? screenshot.description.substring(0, 50) + '...'
                : screenshot.description;

            const response = await fetch('/debug-assets/debug-tools/templates/mcp-screenshot-list-item.html');
            const template = await response.text();
            item.innerHTML = template
                .replace('{id}', screenshot.id)
                .replace('{created_at}', screenshot.created_at)
                .replace('{description}', truncatedDesc)
                .replace('{keywords}', keywords);

            item.addEventListener('click', () => {
                this.showScreenshotDetail(screenshot);
            });

            listEl.appendChild(item);
        }
    },

    showScreenshotDetail(screenshot) {
        this.selectedScreenshot = screenshot;

        // Update active item
        document.querySelectorAll('.mcp-ss-list-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`.mcp-ss-list-item[data-id="${screenshot.id}"]`);
        activeItem.classList.add('active');

        const detailPanel = document.getElementById('mcp-ss-detail-panel');

        // Get file extension from mime_type for AI-friendly URLs
        const extMap = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/bmp': 'bmp'
        };
        const fileExt = extMap[screenshot.mime_type];
        const fileUrl = `/api/mcp/v1/screenshots/${screenshot.id}.${fileExt}`;
        const fullUrl = window.location.origin + fileUrl;
        const keywords = screenshot.keywords.join(', ');
        const mergedInfo = screenshot.merged_info.image_count ? `
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
                        <span>${screenshot.description}</span>
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
        const itemsContainer = document.getElementById('mcp-ss-upload-items');
        if (itemsContainer) {
            itemsContainer.innerHTML = '';
            itemsContainer.style.display = 'none';
        }
    },

    previewFile(file) {
        const previewEl = document.getElementById('mcp-ss-file-preview');
        const reader = new FileReader();

        reader.onload = (e) => {
            previewEl.innerHTML = `
                <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 4px;" />
            `;
        };

        reader.readAsDataURL(file);
    },

    handleUploadFileSelection(fileList) {
        const previewEl = document.getElementById('mcp-ss-file-preview');
        const itemsContainer = document.getElementById('mcp-ss-upload-items');
        previewEl.innerHTML = '';
        itemsContainer.innerHTML = '';
        itemsContainer.style.display = 'none';

        return;

        const files = Array.from(fileList);

        if (this.uploadMode !== 'multi') {
            this.previewFile(files[0]);
            return;
        }

        if (files.length < 2) {
            itemsContainer.innerHTML = '<div style="padding:12px;border:1px dashed #444;border-radius:6px;color:#bbb;">Select at least two images to merge.</div>';
            itemsContainer.style.display = 'block';
            return;
        }

        const rows = files.map((file, index) => {
            const sizeText = this.formatBytes(file.size);
            return `
                <div class="mcp-upload-item" data-index="${index}" style="background:#1f1f1f;border:1px solid #333;border-radius:6px;padding:10px 12px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                        <div>
                            <div style="font-weight:600;color:#fff;">Screenshot ${index + 1}</div>
                            <div style="color:#bbb;font-size:12px;">${file.name} • ${sizeText}</div>
                        </div>
                    </div>
                    <input type="text" class="mcp-ss-upload-desc-input" data-index="${index}" placeholder="Optional description for this image" style="margin-top:8px;width:100%;padding:8px;border-radius:4px;border:1px solid #444;background:#151515;color:#eee;">
                </div>
            `;
        }).join('');

        itemsContainer.innerHTML = rows;
        itemsContainer.style.display = 'block';
    },

    setUploadMode(mode) {
        const normalized = mode === 'multi' ? 'multi' : 'single';
        this.uploadMode = normalized;

        const fileInput = document.getElementById('mcp-ss-file-input');
        if (fileInput) {
            fileInput.multiple = normalized === 'multi';
            if (normalized === 'multi') {
                fileInput.setAttribute('multiple', 'multiple');
            } else {
                fileInput.removeAttribute('multiple');
            }
            fileInput.value = '';
        }

        this.updateUploadModeUI();

        if (fileInput) {
            this.handleUploadFileSelection(fileInput.files);
        }
    },

    updateUploadModeUI() {
        const hint = document.getElementById('mcp-ss-mode-hint');
        const help = document.getElementById('mcp-ss-upload-help');
        const submitBtn = document.getElementById('mcp-ss-upload-submit-btn');
        const itemsContainer = document.getElementById('mcp-ss-upload-items');
        const previewEl = document.getElementById('mcp-ss-file-preview');

        if (this.uploadMode === 'multi') {
            hint.textContent = 'Merge multiple images into a single tall screenshot with numbered labels.';
            help.textContent = 'Select at least two images. They will be resized to max 1080px width and merged top-to-bottom.';
            submitBtn.textContent = 'Upload & Merge';
            if (itemsContainer.innerHTML.trim() === '') {
                itemsContainer.innerHTML = '<div style="padding:12px;border:1px dashed #444;border-radius:6px;color:#bbb;">Select images to configure per-screenshot descriptions.</div>';
            }
            itemsContainer.style.display = 'block';
            previewEl.innerHTML = '';
        } else {
            hint.textContent = 'Upload a single image without merging.';
            help.textContent = 'Select one image to upload.';
            submitBtn.textContent = 'Upload Screenshot';
            itemsContainer.innerHTML = '';
            itemsContainer.style.display = 'none';
        }

        document.querySelectorAll('input[name="mcp-ss-mode"]').forEach(radio => {
            radio.checked = radio.value === this.uploadMode;
        });
    },

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    },

    async uploadScreenshot(replace = false) {
        const fileInput = document.getElementById('mcp-ss-file-input');
        const id = document.getElementById('mcp-ss-id-input').value.trim();
        const description = document.getElementById('mcp-ss-description-input').value.trim();
        const keywords = document.getElementById('mcp-ss-keywords-input').value.trim();

        alert('Please select an image file');
        return;

        const files = Array.from(fileInput.files);
        const isMultiMode = this.uploadMode === 'multi';
        const perImageDescriptions = Array.from(document.querySelectorAll('.mcp-ss-upload-desc-input'))
            .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
            .map(input => input.value.trim());

        const formData = new FormData();

        if (isMultiMode) {
            if (files.length < 2) {
                alert('Select at least two images to use merge mode.');
                return;
            }
            files.forEach(file => formData.append('images[]', file));
            perImageDescriptions.forEach(desc => formData.append('image_descriptions[]', desc));
        } else {
            formData.append('image', files[0]);
            if (perImageDescriptions[0]) {
                formData.append('image_descriptions[]', perImageDescriptions[0]);
            }
        }

        if (id) formData.append('id', id);
        if (description) formData.append('description', description);
        if (keywords) formData.append('keywords', keywords);
        if (replace) formData.append('replace', 'true');

        const data = await UnifiedAPIClient.json('/api/mcp/v1/screenshots/upload', 'POST', formData, { isFormData: true });

        if (data.success) {
            alert('Screenshot uploaded successfully!');
            this.hideUploadModal();
            await this.loadScreenshots();
        } else if (data.exists && data.existing_id) {
            if (confirm(`Screenshot with ID "${data.existing_id}" already exists.\n\nDo you want to replace it?`)) {
                await this.uploadScreenshot(true);
            }
        } else {
            alert('Upload failed: ' + data.error);
        }
    },

    async deleteScreenshot(id) {
        if (!confirm(`Are you sure you want to delete screenshot "${id}"?`)) {
            return;
        }

        const data = await UnifiedAPIClient.json(`/api/mcp/v1/screenshots/${id}`, 'DELETE');

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
    },

    async clearAllScreenshots() {
        if (!confirm('⚠️ WARNING: This will delete ALL screenshots. Are you sure?')) {
            return;
        }
        if (!confirm('This action cannot be undone. Really delete ALL screenshots?')) {
            return;
        }

        const data = await UnifiedAPIClient.json('/api/mcp/v1/screenshots/clear-all/confirm', 'DELETE');

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

        container.style.display = 'none';
        return;

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

        alert('Please select at least one image file');
        return;

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

        const endpoint = shouldMerge
            ? '/api/mcp/v1/screenshots/upload-merge'
            : '/api/mcp/v1/screenshots/upload-batch';

        const data = await UnifiedAPIClient.json(endpoint, 'POST', formData, { isFormData: true });

        if (data.success) {
            const message = shouldMerge
                ? 'Images merged and uploaded successfully!'
                : `Batch upload completed: ${data.data.success_count}/${data.data.total} successful`;
            alert(message);
            this.hideBatchUploadModal();
            await this.loadScreenshots();
        } else if (data.exists && data.existing_id) {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            if (confirm(`Screenshot with ID "${data.existing_id}" already exists.\n\nDo you want to replace it?`)) {
                await this.uploadBatch(true);
            }
            return;
        } else {
            alert('Upload failed: ' + data.error);
        }

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
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
        const template = await this.getTemplate();
        container.innerHTML = template;
        // Move modal to body to avoid overflow:hidden clipping
        const modal = document.getElementById('mcp-td-create-modal');
        document.body.appendChild(modal);
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
        const data = await UnifiedAPIClient.json('/api/mcp/v1/task-dispatch/categories', 'GET');
        this.categories = data.data.categories;
        this.renderCategories();
    },

    renderCategories() {
        const container = document.getElementById('mcp-td-categories');

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

        const [tasksData, statsData] = await Promise.all([
            UnifiedAPIClient.json(`/api/mcp/v1/task-dispatch/queue/${categoryId}/tasks`, 'GET'),
            UnifiedAPIClient.json(`/api/mcp/v1/task-dispatch/queue/${categoryId}/stats`, 'GET')
        ]);

        this.tasks = tasksData.data.tasks;
        this.renderTasks(statsData.data.stats);
    },

    renderTasks(stats) {
        const panel = document.getElementById('mcp-td-tasks-panel');
        const cat = this.selectedCategory;

        panel.innerHTML = `
            <div class="mcp-td-tasks-header">
                <h3>${cat.name}</h3>
                <div class="mcp-td-stats">
                    <span>Total: ${stats.total}</span>
                    <span>Pending: ${stats.pending}</span>
                    <span>Completed: ${stats.completed}</span>
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
                    <span class="mcp-td-task-file">${task.file_path}</span>
                    <span class="mcp-td-task-status ${statusClass}">${task.status}</span>
                </div>
                <div class="mcp-td-task-meta">
                    <span>${task.created_at}</span>
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

        alert('All fields are required');
        return;

        const data = await UnifiedAPIClient.json('/api/mcp/v1/task-dispatch/categories', 'POST', { id, name, path });
        if (data.success) {
            alert('Category created successfully');
            this.hideCreateModal();
            await this.loadCategories();
        } else {
            alert('Failed: ' + data.error);
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
        const template = await this.getTemplate();
        container.innerHTML = template;
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
        const data = await UnifiedAPIClient.json('/api/mcp/v1/task-dispatch/mappings', 'GET');
        this.mappings = data.data.mappings;
        Object.keys(this.mappings).forEach(categoryId => {
            const mapping = this.mappings[categoryId];
            mapping.prefix = mapping.prefix;
            mapping.suffix = mapping.suffix;
            mapping.replace_map = mapping.replace_map;
        });
        this.renderMappingsList();
    },

    renderMappingsList() {
        const list = document.getElementById('mcp-pm-list');

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
                    ${Object.keys(mapping.replace_map).length > 0 ? '✓ Replace' : ''}
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

    async renderEditor(categoryId) {
        const panel = document.getElementById('mcp-pm-editor-panel');
        const response = await fetch('/debug-assets/debug-tools/templates/mcp-prompt-mapping-editor.html');
        const template = await response.text();
        panel.innerHTML = template;
        
        const mapping = this.mappings[categoryId];
        const replaceMapStr = JSON.stringify(mapping.replace_map, null, 2);
        
        document.getElementById('mcp-pm-editor-title').textContent = 'Edit: ' + categoryId;
        document.getElementById('mcp-pm-prefix').value = mapping.prefix;
        document.getElementById('mcp-pm-suffix').value = mapping.suffix;
        document.getElementById('mcp-pm-replace-map').value = replaceMapStr;
        document.getElementById('mcp-pm-preview-prefix').textContent = mapping.prefix;
        document.getElementById('mcp-pm-preview-suffix').textContent = mapping.suffix;
        
        document.getElementById('mcp-pm-save-btn').onclick = () => this.saveMapping();
        document.getElementById('mcp-pm-reset-btn').onclick = () => this.resetMapping(categoryId);
        document.getElementById('mcp-pm-delete-btn').onclick = () => this.deleteMapping(categoryId);
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    async saveMapping() {
        const prefix = document.getElementById('mcp-pm-prefix').value;
        const suffix = document.getElementById('mcp-pm-suffix').value;
        let replaceMap = {};

        const replaceMapStr = document.getElementById('mcp-pm-replace-map').value.trim();
        if (replaceMapStr) {
            replaceMap = JSON.parse(replaceMapStr);
        }

        const data = await UnifiedAPIClient.json(`/api/mcp/v1/task-dispatch/mappings/${this.selectedCategory}`, 'PUT', { prefix, suffix, replace_map: replaceMap });
        if (data.success) {
            alert('Mapping saved successfully');
            await this.loadMappings();
            this.renderEditor(this.selectedCategory);
        } else {
            alert('Failed: ' + data.error);
        }
    },

    async resetMapping(categoryId) {
        if (!confirm(`Reset mapping for "${categoryId}" to default?`)) {
            return;
        }

        const data = await UnifiedAPIClient.json(`/api/mcp/v1/task-dispatch/mappings/${categoryId}/reset`, 'POST');
        if (data.success) {
            alert('Mapping reset successfully');
            await this.loadMappings();
            this.renderEditor(categoryId);
        } else {
            alert('Failed: ' + data.error);
        }
    },

    async deleteMapping(categoryId) {
        if (!confirm(`Delete mapping for "${categoryId}"?`)) {
            return;
        }

        const data = await UnifiedAPIClient.json(`/api/mcp/v1/task-dispatch/mappings/${categoryId}`, 'DELETE');
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
            alert('Failed: ' + data.error);
        }
    },
};

/**
 * MCP Settings Module
 */
const McpSettingsModule = {
    async init(container) {
        const template = await this.getTemplate();
        container.innerHTML = template;
        await this.loadSettings();
    },

    async getTemplate() {
        const response = await fetch('/debug-assets/debug-tools/templates/mcp-settings-module.html');
        return await response.text();
    },

    async loadSettings() {
        const data = await UnifiedAPIClient.json('/api/mcp/v1/screenshots/stats', 'GET');
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
    },
};

/**
 * Voice Subtitle Module
 */
const McpVoiceSubtitleModule = {
    async init(container) {
        container.innerHTML = `
            <div class="mcp-module-container" style="height: 100%;">
                <iframe
                    src="/debug-assets/debug-tools/voice-subtitle.html"
                    style="width: 100%; height: calc(100vh - 250px); border: none; border-radius: 8px; background: #fff;"
                    title="Voice Subtitle Console"
                ></iframe>
            </div>
        `;
    }
};
