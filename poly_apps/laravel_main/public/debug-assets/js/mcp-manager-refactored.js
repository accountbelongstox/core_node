/**
 * MCP Management Module - Refactored
 * All HTML generation moved to templates
 * JS only handles API calls and data processing
 */

const McpManager = {
    currentModule: null,
    modules: {},

    async init() {
        this.registerModules();
        await this.renderMenu();
        this.setupEventListeners();
        await this.loadModule('screenshots');
    },

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

    async renderMenu() {
        const menuContainer = document.getElementById('mcp-menu-container');
        if (!menuContainer) return;

        menuContainer.innerHTML = '';

        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-menu-item.html');

        Object.entries(this.modules).forEach(([moduleId, module]) => {
            const menuItem = TemplateUtils.renderToElement(template, {
                icon: module.icon,
                name: module.name
            });
            menuItem.className = 'mcp-menu-item';
            menuItem.dataset.module = moduleId;
            menuItem.addEventListener('click', () => this.loadModule(moduleId));
            menuContainer.appendChild(menuItem);
        });
    },

    setupEventListeners() {
        // Global shortcuts can be added here
    },

    async loadModule(moduleId) {
        const module = this.modules[moduleId];
        if (!module) return;

        document.querySelectorAll('.mcp-menu-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`.mcp-menu-item[data-module="${moduleId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }

        const contentContainer = document.getElementById('mcp-content-container');
        if (!contentContainer) return;

        const loadingTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/loading.html');
        contentContainer.innerHTML = loadingTemplate;

        if (module.component && module.component.init) {
            await module.component.init(contentContainer);
        }

        this.currentModule = moduleId;
    }
};

// Screenshot Management Module
const McpScreenshotModule = {
    screenshots: [],
    selectedScreenshot: null,
    uploadMode: 'single',

    async init(container) {
        this.cleanupExistingModals();
        const template = await this.getTemplate();
        container.innerHTML = template;
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
        document.getElementById('mcp-ss-upload-btn')?.addEventListener('click', () => this.showUploadModal());
        document.getElementById('mcp-ss-batch-btn')?.addEventListener('click', () => this.showBatchModal());
        document.getElementById('mcp-ss-refresh-btn')?.addEventListener('click', () => this.loadScreenshots());
        document.getElementById('mcp-ss-upload-form')?.addEventListener('submit', (e) => this.handleUpload(e));
        document.getElementById('mcp-ss-batch-form')?.addEventListener('submit', (e) => this.handleBatchUpload(e));
    },

    async loadScreenshots() {
        try {
            const response = await fetch('/api/mcp/v1/screenshots/list');
            const data = await response.json();
            this.screenshots = data.screenshots || [];
            this.renderScreenshots();
        } catch (error) {
            console.error('Failed to load screenshots:', error);
        }
    },

    renderScreenshots() {
        const listEl = document.getElementById('mcp-ss-list');
        if (!listEl) return;

        if (this.screenshots.length === 0) {
            listEl.innerHTML = '<p class="text-gray-500 text-center py-8">No screenshots found</p>';
            return;
        }

        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-screenshot-item.html');
        listEl.innerHTML = '';

        this.screenshots.forEach(screenshot => {
            const item = TemplateUtils.renderToElement(template, {
                id: screenshot.id,
                filename: screenshot.filename,
                url: screenshot.url,
                timestamp: screenshot.created_at
            });
            item.addEventListener('click', () => this.selectScreenshot(screenshot));
            listEl.appendChild(item);
        });
    },

    selectScreenshot(screenshot) {
        this.selectedScreenshot = screenshot;
        this.renderDetail();
    },

    renderDetail() {
        const detailPanel = document.getElementById('mcp-ss-detail');
        if (!detailPanel || !this.selectedScreenshot) return;

        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-screenshot-detail.html');
        detailPanel.innerHTML = TemplateUtils.renderTemplate(template, {
            id: this.selectedScreenshot.id,
            filename: this.selectedScreenshot.filename,
            url: this.selectedScreenshot.url,
            timestamp: this.selectedScreenshot.created_at
        });
    },

    showUploadModal() {
        document.getElementById('mcp-ss-upload-modal')?.classList.remove('hidden');
    },

    showBatchModal() {
        document.getElementById('mcp-ss-batch-modal')?.classList.remove('hidden');
    },

    async handleUpload(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const response = await fetch('/api/mcp/v1/screenshots/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                await this.loadScreenshots();
                document.getElementById('mcp-ss-upload-modal')?.classList.add('hidden');
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    },

    async handleBatchUpload(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const response = await fetch('/api/mcp/v1/screenshots/batch-upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                await this.loadScreenshots();
                document.getElementById('mcp-ss-batch-modal')?.classList.add('hidden');
            }
        } catch (error) {
            console.error('Batch upload failed:', error);
        }
    }
};

// Placeholder for other modules - they should follow the same pattern
const McpVoiceSubtitleModule = {
    async init(container) {
        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-voice-subtitle-module.html');
        container.innerHTML = template;
    }
};

const McpPlaceholderModule = {
    async init(container) {
        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-placeholder-module.html');
        container.innerHTML = template;
    }
};

const McpTaskDispatchModule = {
    async init(container) {
        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-task-dispatch-module.html');
        container.innerHTML = template;
    }
};

const McpPromptMappingsModule = {
    async init(container) {
        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-prompt-mappings-module.html');
        container.innerHTML = template;
    }
};

const McpSettingsModule = {
    async init(container) {
        const template = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/mcp-settings-module.html');
        container.innerHTML = template;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => McpManager.init());
} else {
    McpManager.init();
}

