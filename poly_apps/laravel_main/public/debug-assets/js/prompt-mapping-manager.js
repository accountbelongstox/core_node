// Prompt Mapping Manager Module
const PromptMappingManager = {
    currentCategory: null,
    mappings: {},
    embedMode: false,
    containerSelector: null,

    async init(containerSelector = null) {
        if (containerSelector) {
            this.embedMode = true;
            this.containerSelector = containerSelector;
        } else {
            this.containerSelector = '#prompt-mapping-container';
        }

        await this.loadAllMappings();
        this.renderUI();
        this.setupEventListeners();
    },

    // Allow external modules to switch category
    async switchCategory(categoryId) {
        this.currentCategory = categoryId;
        if (this.mappings[categoryId]) {
            this.renderEditor(categoryId);
        } else {
            await this.loadAllMappings();
            this.renderEditor(categoryId);
        }
    },

    async loadAllMappings() {
        const response = await APIClient.get('/api/mcp/v1/task-dispatch/mappings');
        const data = await response.json();
        if (data.success) {
            this.mappings = data.data.mappings;
        } else {
            console.error('Failed to load mappings:', data.error);
            this.mappings = {};
        }
    },

    async loadCategoryMapping(categoryId) {
        const response = await APIClient.get(`/api/mcp/v1/task-dispatch/mappings/${categoryId}`);
        const data = await response.json();
        if (data.success) {
            return data.data.mapping;
        } else {
            console.error('Failed to load category mapping:', data.error);
            return null;
        }
    },

    async updateMapping(categoryId, prefix, suffix, replaceMap) {
        const response = await APIClient.put(`/api/mcp/v1/task-dispatch/mappings/${categoryId}`, {
            prefix: prefix,
            suffix: suffix,
            replace_map: replaceMap
        });
        const data = await response.json();
        if (data.success) {
            this.mappings[categoryId] = data.data.mapping;
            this.showNotification('Mapping updated successfully', 'success');
            return true;
        } else {
            this.showNotification(`Failed to update mapping: ${data.error}`, 'error');
            return false;
        }
    },

    async resetMapping(categoryId) {
        const response = await APIClient.post(`/api/mcp/v1/task-dispatch/mappings/${categoryId}/reset`, {});
        const data = await response.json();
        if (data.success) {
            this.mappings[categoryId] = data.data.mapping;
            this.showNotification('Mapping reset to default', 'success');
            this.renderEditor(categoryId);
            return true;
        } else {
            this.showNotification(`Failed to reset mapping: ${data.error}`, 'error');
            return false;
        }
    },

    renderUI() {
        const container = document.querySelector(this.containerSelector);

        if (this.embedMode) {
            // Embedded mode: no category list, only editor
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; height: 100%; background: #1e1e1e; color: #d4d4d4; padding: 10px;">
                    <div id="mapping-editor-header" style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #3c3c3c;">
                        <h3 id="mapping-editor-title" style="margin: 0; color: #569cd6; font-size: 14px;">Prompt Mapping</h3>
                        <div id="mapping-actions" style="display: none;">
                            <button id="btn-save-mapping" style="padding: 4px 10px; margin-right: 6px; background: #0e639c; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Save</button>
                            <button id="btn-reset-mapping" style="padding: 4px 10px; margin-right: 6px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Reset</button>
                            <button id="btn-preview-mapping" style="padding: 4px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">Preview</button>
                        </div>
                    </div>

                    <div id="mapping-editor-content" style="flex: 1; overflow-y: auto; display: none;">
                        <!-- Prefix Editor -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; color: #9cdcfe; font-weight: bold; font-size: 11px;">Prefix</label>
                            <textarea id="mapping-prefix" style="width: 100%; height: 60px; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 6px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; resize: vertical;"></textarea>
                        </div>

                        <!-- Suffix Editor -->
                        <div style="margin-bottom: 12px;">
                            <label style="display: block; margin-bottom: 4px; color: #9cdcfe; font-weight: bold; font-size: 11px;">Suffix</label>
                            <textarea id="mapping-suffix" style="width: 100%; height: 60px; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 6px; font-family: 'Consolas', 'Monaco', monospace; font-size: 11px; resize: vertical;"></textarea>
                        </div>

                        <!-- Replace Map Editor -->
                        <div>
                            <label style="display: block; margin-bottom: 4px; color: #9cdcfe; font-weight: bold; font-size: 11px;">Replace Map</label>
                            <div id="replace-map-list" style="margin-bottom: 8px;"></div>
                            <button id="btn-add-replace-rule" style="padding: 4px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 10px;">+ Add Rule</button>
                        </div>
                    </div>

                    <div id="mapping-empty-state" style="flex: 1; display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 12px;">
                        Select a category from the left panel
                    </div>
                </div>

                <!-- Preview Modal -->
                <div id="mapping-preview-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;">
                    <div style="background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 5px; padding: 20px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
                        <h3 style="margin: 0 0 15px 0; color: #569cd6;">Mapping Preview</h3>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; color: #9cdcfe; font-weight: bold;">Sample Input:</label>
                            <textarea id="preview-input" style="width: 100%; height: 80px; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px;">Create new API endpoint for user service</textarea>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; color: #9cdcfe; font-weight: bold;">Transformed Output:</label>
                            <pre id="preview-output" style="background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 12px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; white-space: pre-wrap; margin: 0;"></pre>
                        </div>

                        <div style="text-align: right;">
                            <button id="btn-close-preview" style="padding: 6px 16px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Close</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Standalone mode: with category list
            container.innerHTML = `
                <div style="display: flex; height: 100%; background: #1e1e1e; color: #d4d4d4;">
                    <!-- Category List -->
                    <div id="mapping-category-list" style="width: 250px; border-right: 1px solid #3c3c3c; overflow-y: auto; padding: 10px;">
                        <h3 style="margin: 0 0 10px 0; color: #569cd6; font-size: 14px;">Task Categories</h3>
                        <div id="mapping-categories"></div>
                    </div>

                    <!-- Editor Panel -->
                    <div style="flex: 1; display: flex; flex-direction: column; padding: 15px; overflow: hidden;">
                        <div id="mapping-editor-header" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                            <h3 id="mapping-editor-title" style="margin: 0; color: #569cd6; font-size: 16px;">Select a category</h3>
                            <div id="mapping-actions" style="display: none;">
                                <button id="btn-save-mapping" style="padding: 6px 12px; margin-right: 8px; background: #0e639c; color: white; border: none; border-radius: 3px; cursor: pointer;">Save</button>
                                <button id="btn-reset-mapping" style="padding: 6px 12px; margin-right: 8px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Reset to Default</button>
                                <button id="btn-preview-mapping" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Preview</button>
                            </div>
                        </div>

                        <div id="mapping-editor-content" style="flex: 1; overflow-y: auto; display: none;">
                            <!-- Prefix Editor -->
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 5px; color: #9cdcfe; font-weight: bold;">Prefix (added before task content)</label>
                                <textarea id="mapping-prefix" style="width: 100%; height: 80px; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; resize: vertical;"></textarea>
                            </div>

                            <!-- Suffix Editor -->
                            <div style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 5px; color: #9cdcfe; font-weight: bold;">Suffix (added after task content)</label>
                                <textarea id="mapping-suffix" style="width: 100%; height: 80px; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; resize: vertical;"></textarea>
                            </div>

                            <!-- Replace Map Editor -->
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: #9cdcfe; font-weight: bold;">Replace Map (text replacements)</label>
                                <div id="replace-map-list" style="margin-bottom: 10px;"></div>
                                <button id="btn-add-replace-rule" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">+ Add Replacement Rule</button>
                            </div>
                        </div>

                        <div id="mapping-empty-state" style="flex: 1; display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 14px;">
                            Select a category to view and edit its prompt mapping
                        </div>
                    </div>
                </div>

                <!-- Preview Modal -->
                <div id="mapping-preview-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;">
                    <div style="background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 5px; padding: 20px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
                        <h3 style="margin: 0 0 15px 0; color: #569cd6;">Mapping Preview</h3>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; color: #9cdcfe; font-weight: bold;">Sample Input:</label>
                            <textarea id="preview-input" style="width: 100%; height: 80px; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 8px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px;">Create new API endpoint for user service</textarea>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <label style="display: block; margin-bottom: 5px; color: #9cdcfe; font-weight: bold;">Transformed Output:</label>
                            <pre id="preview-output" style="background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 12px; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; white-space: pre-wrap; margin: 0;"></pre>
                        </div>

                        <div style="text-align: right;">
                            <button id="btn-close-preview" style="padding: 6px 16px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Close</button>
                        </div>
                    </div>
                </div>
            `;

            this.renderCategoryList();
        }
    },

    renderCategoryList() {
        if (this.embedMode) return;
        
        const container = document.getElementById('mapping-categories');

        container.innerHTML = '';

        const categoryNames = {
            'global': 'Global',
            'mcp-dev': 'MCP Development',
            'ncore-dev': 'NCORE Development',
            'pycore-dev': 'PYCORE Development',
            'laravel-main-dev': 'Laravel Main',
            'nuxt-dev': 'NUXT Development'
        };

        Object.keys(this.mappings).forEach(categoryId => {
            const categoryDiv = document.createElement('div');
            categoryDiv.style.padding = '8px 10px';
            categoryDiv.style.marginBottom = '5px';
            categoryDiv.style.cursor = 'pointer';
            categoryDiv.style.borderRadius = '3px';
            categoryDiv.style.fontSize = '13px';
            categoryDiv.style.transition = 'background 0.2s';

            if (this.currentCategory === categoryId) {
                categoryDiv.style.background = '#094771';
            }

            categoryDiv.addEventListener('mouseenter', () => {
                if (this.currentCategory !== categoryId) {
                    categoryDiv.style.background = '#2a2d2e';
                }
            });

            categoryDiv.addEventListener('mouseleave', () => {
                if (this.currentCategory !== categoryId) {
                    categoryDiv.style.background = 'transparent';
                }
            });

            categoryDiv.addEventListener('click', () => {
                this.selectCategory(categoryId);
            });

            const mapping = this.mappings[categoryId];
            const hasMapping = mapping.prefix || mapping.suffix || Object.keys(mapping.replace_map || {}).length > 0;

            categoryDiv.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span>${categoryNames[categoryId] || categoryId}</span>
                    ${hasMapping ? '<span style="color: #28a745; font-size: 11px;">●</span>' : '<span style="color: #6c757d; font-size: 11px;">○</span>'}
                </div>
            `;

            container.appendChild(categoryDiv);
        });
    },

    selectCategory(categoryId) {
        this.currentCategory = categoryId;
        this.renderCategoryList();
        this.renderEditor(categoryId);
    },

    renderEditor(categoryId) {
        document.getElementById('mapping-empty-state').style.display = 'none';
        document.getElementById('mapping-editor-content').style.display = 'block';
        document.getElementById('mapping-actions').style.display = 'block';

        const categoryNames = {
            'global': 'Global',
            'mcp-dev': 'MCP Development',
            'ncore-dev': 'NCORE Development',
            'pycore-dev': 'PYCORE Development',
            'laravel-main-dev': 'Laravel Main',
            'nuxt-dev': 'NUXT Development'
        };

        document.getElementById('mapping-editor-title').textContent = `Edit Mapping: ${categoryNames[categoryId] || categoryId}`;

        const mapping = this.mappings[categoryId];

        document.getElementById('mapping-prefix').value = mapping.prefix || '';
        document.getElementById('mapping-suffix').value = mapping.suffix || '';

        this.renderReplaceMap(mapping.replace_map || {});
    },

    renderReplaceMap(replaceMap) {
        const container = document.getElementById('replace-map-list');

        container.innerHTML = '';

        Object.entries(replaceMap).forEach(([search, replace]) => {
            this.addReplaceRuleUI(container, search, replace);
        });
    },

    addReplaceRuleUI(container, search = '', replace = '') {
        const ruleDiv = document.createElement('div');
        ruleDiv.style.display = 'flex';
        ruleDiv.style.marginBottom = '8px';
        ruleDiv.style.gap = '8px';
        ruleDiv.style.alignItems = 'center';

        ruleDiv.innerHTML = `
            <input type="text" class="replace-search" value="${search}" placeholder="Search for..." style="flex: 1; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 6px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px;">
            <span style="color: #6c757d;">→</span>
            <input type="text" class="replace-replace" value="${replace}" placeholder="Replace with..." style="flex: 1; background: #252526; color: #d4d4d4; border: 1px solid #3c3c3c; padding: 6px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px;">
            <button class="btn-remove-rule" style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">✕</button>
        `;

        ruleDiv.querySelector('.btn-remove-rule').addEventListener('click', () => {
            ruleDiv.remove();
        });

        container.appendChild(ruleDiv);
    },

    getReplaceMapFromUI() {
        const container = document.getElementById('replace-map-list');

        const replaceMap = {};
        const rules = container.querySelectorAll('div');

        rules.forEach(ruleDiv => {
            const search = ruleDiv.querySelector('.replace-search').value.trim();
            const replace = ruleDiv.querySelector('.replace-replace').value.trim();
            if (search) {
                replaceMap[search] = replace;
            }
        });

        return replaceMap;
    },

    async saveCurrentMapping() {
        if (!this.currentCategory) return;

        const prefix = document.getElementById('mapping-prefix').value;
        const suffix = document.getElementById('mapping-suffix').value;
        const replaceMap = this.getReplaceMapFromUI();

        const success = await this.updateMapping(this.currentCategory, prefix, suffix, replaceMap);
        if (success) {
            this.renderCategoryList();
        }
    },

    async resetCurrentMapping() {
        if (!this.currentCategory) return;

        if (confirm(`Reset "${this.currentCategory}" mapping to default?`)) {
            await this.resetMapping(this.currentCategory);
            this.renderCategoryList();
        }
    },

    showPreview() {
        if (!this.currentCategory) return;

        const modal = document.getElementById('mapping-preview-modal');
        modal.style.display = 'flex';

        this.updatePreview();

        document.getElementById('preview-input').addEventListener('input', () => {
            this.updatePreview();
        });
    },

    updatePreview() {
        const input = document.getElementById('preview-input').value;
        const prefix = document.getElementById('mapping-prefix').value;
        const suffix = document.getElementById('mapping-suffix').value;
        const replaceMap = this.getReplaceMapFromUI();

        let output = input;

        Object.entries(replaceMap).forEach(([search, replace]) => {
            if (search) {
                output = output.split(search).join(replace);
            }
        });

        if (prefix) {
            output = prefix + output;
        }

        if (suffix) {
            output = output + suffix;
        }

        document.getElementById('preview-output').textContent = output;
    },

    setupEventListeners() {
        document.getElementById('btn-save-mapping')?.addEventListener('click', () => {
            this.saveCurrentMapping();
        });

        document.getElementById('btn-reset-mapping')?.addEventListener('click', () => {
            this.resetCurrentMapping();
        });

        document.getElementById('btn-preview-mapping')?.addEventListener('click', () => {
            this.showPreview();
        });

        document.getElementById('btn-add-replace-rule')?.addEventListener('click', () => {
            const container = document.getElementById('replace-map-list');
            this.addReplaceRuleUI(container);
        });

        document.getElementById('btn-close-preview')?.addEventListener('click', () => {
            document.getElementById('mapping-preview-modal').style.display = 'none';
        });
    },

    showNotification(message, type = 'info') {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#17a2b8'
        };

        const notif = document.createElement('div');
        notif.style.position = 'fixed';
        notif.style.top = '20px';
        notif.style.right = '20px';
        notif.style.background = colors[type] || colors.info;
        notif.style.color = 'white';
        notif.style.padding = '12px 20px';
        notif.style.borderRadius = '5px';
        notif.style.zIndex = '10001';
        notif.style.fontFamily = 'Arial, sans-serif';
        notif.style.fontSize = '14px';
        notif.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
        notif.textContent = message;

        document.body.appendChild(notif);

        setTimeout(() => {
            notif.style.transition = 'opacity 0.3s';
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    }
};
