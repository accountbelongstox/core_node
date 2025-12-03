// ============================================
// NAMESPACE: ITTools.Implementations.Clipboard
// FILE: ittools-impl-clipboard.js
// PURPOSE: Online Clipboard tool implementation
// ============================================

ITTools.Implementations.Clipboard = {
    templateUrl: '/debug-assets/debug-tools/templates/ittools/clipboard.html',
    STORAGE_KEY: 'ittools_clipboard_namespace',
    currentNamespace: null,
    saveTimeout: null,
    isLoading: false,
    isInitialized: false,
    pollingInterval: null,
    lastUpdatedAt: null,
    POLLING_INTERVAL_MS: 3000,

    // ============================================
    // METHOD: render
    // PURPOSE: Load and return HTML template
    // ============================================
    async render() {
        const response = await fetch(this.templateUrl);
        return await response.text();
    },

    // ============================================
    // METHOD: init
    // PURPOSE: Initialize event listeners
    // ============================================
    init() {
        this.attachEventListeners();
        this.initializeNamespace();
    },

    // ============================================
    // METHOD: attachEventListeners
    // PURPOSE: Set up event delegation for all actions
    // ============================================
    attachEventListeners() {
        const container = document.getElementById('ittools-main-content');

        container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]');
            if (!action) return;

            const actionName = action.dataset.action;

            switch (actionName) {
                case 'load-namespace':
                    this.loadNamespace();
                    break;
                case 'generate-namespace':
                    this.generateNamespace();
                    break;
                case 'new-clipboard':
                    this.createNewClipboard();
                    break;
                case 'copy-text':
                    this.copyText();
                    break;
                case 'clear-text':
                    this.clearText();
                    break;
                case 'file-drop':
                    document.getElementById('clipboard-file-input').click();
                    break;
                case 'delete-file':
                    this.deleteFile(action.dataset.stored);
                    break;
                case 'restore-history':
                    this.restoreHistory(parseInt(action.dataset.index, 10));
                    break;
            }
        });

        const nsInput = document.querySelector('[data-input="namespace"]');
        nsInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
        });
        nsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadNamespace();
            }
        });

        const fileInput = document.getElementById('clipboard-file-input');
        fileInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
            e.target.value = '';
        });

        const dropzone = document.getElementById('clipboard-dropzone');
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            this.handleFileUpload(e.dataTransfer.files);
        });

        const textArea = document.querySelector('[data-input="text-content"]');
        textArea.addEventListener('input', () => {
            this.autoSaveContent();
        });

        window.addEventListener('beforeunload', () => {
            this.stopPolling();
        });
    },

    // ============================================
    // METHOD: getStoredNamespace
    // PURPOSE: Get namespace from localStorage
    // ============================================
    getStoredNamespace() {
        return localStorage.getItem(this.STORAGE_KEY);
    },

    // ============================================
    // METHOD: setStoredNamespace
    // PURPOSE: Save namespace to localStorage
    // ============================================
    setStoredNamespace(ns) {
        localStorage.setItem(this.STORAGE_KEY, ns.toLowerCase());
    },

    // ============================================
    // METHOD: fetchNamespace
    // PURPOSE: Fetch or generate namespace
    // ============================================
    async fetchNamespace(ns = null) {
        const url = ns ? `/clipboard/namespace?namespace=${encodeURIComponent(ns.toLowerCase())}` : '/clipboard/namespace';
        return await apiClientInstance.json(url, 'GET', null, { includeAuth: false });
    },

    // ============================================
    // METHOD: fetchData
    // PURPOSE: Fetch clipboard data
    // ============================================
    async fetchData(ns) {
        return await apiClientInstance.json(`/clipboard/data?namespace=${ns}`, 'GET', null, { includeAuth: false });
    },

    // ============================================
    // METHOD: saveText
    // PURPOSE: Save text content
    // ============================================
    async saveText(ns, text) {
        return await apiClientInstance.json('/clipboard/text', 'POST', { namespace: ns, text: text }, { includeAuth: false });
    },

    // ============================================
    // METHOD: uploadFiles
    // PURPOSE: Upload files
    // ============================================
    async uploadFiles(ns, files) {
        const formData = new FormData();
        formData.append('namespace', ns);
        for (let i = 0; i < files.length; i++) {
            formData.append('files[]', files[i]);
        }
        return await apiClientInstance.post('/clipboard/upload', formData, { includeAuth: false }).then(r => r.json());
    },

    // ============================================
    // METHOD: deleteFile
    // PURPOSE: Delete a file
    // ============================================
    async deleteFile(storedName) {
        if (!confirm('Delete this file?')) return;
        const result = await apiClientInstance.json('/clipboard/delete-file', 'POST', { namespace: this.currentNamespace, stored_name: storedName }, { includeAuth: false });
        if (result.success) {
            await this.loadClipboardData();
            this.showStatus('File deleted');
        }
    },

    // ============================================
    // METHOD: createNew
    // PURPOSE: Create new clipboard entry
    // ============================================
    async createNew(ns) {
        return await apiClientInstance.json('/clipboard/new', 'POST', { namespace: ns }, { includeAuth: false });
    },

    // ============================================
    // METHOD: restoreHistory
    // PURPOSE: Restore from history
    // ============================================
    async restoreHistory(index) {
        if (!confirm('Restore this history? Current content will be saved.')) return;
        const result = await apiClientInstance.json('/clipboard/restore', 'POST', { namespace: this.currentNamespace, history_index: index }, { includeAuth: false });
        if (result.success) {
            await this.loadClipboardData();
            this.showStatus('History restored');
        }
    },

    // ============================================
    // METHOD: formatFileSize
    // PURPOSE: Format file size in human-readable format
    // ============================================
    formatFileSize(bytes) {
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // ============================================
    // METHOD: loadNamespace
    // PURPOSE: Load existing clipboard namespace
    // ============================================
    async loadNamespace() {
        const input = document.querySelector('[data-input="namespace"]');
        const namespaceId = input.value.trim();
        
        const result = await this.fetchNamespace(namespaceId);
        if (result.success) {
            this.stopPolling();
            this.currentNamespace = result.namespace;
            this.setStoredNamespace(this.currentNamespace);
            input.value = this.currentNamespace;
            this.showContentSection();
            this.lastUpdatedAt = null;
            await this.loadClipboardData();
            this.startPolling();
            this.showStatus('Namespace loaded');
        } else {
            this.showStatus(result.message || 'Failed to load namespace', true);
        }
    },

    // ============================================
    // METHOD: generateNamespace
    // PURPOSE: Generate new random namespace
    // ============================================
    async generateNamespace() {
        const result = await this.fetchNamespace();
        if (result.success) {
            this.stopPolling();
            this.currentNamespace = result.namespace;
            this.setStoredNamespace(this.currentNamespace);
            const input = document.querySelector('[data-input="namespace"]');
            input.value = this.currentNamespace;
            this.showContentSection();
            const textarea = document.querySelector('[data-input="text-content"]');
            textarea.value = '';
            this.updateFilesList([]);
            this.updateHistoryList([]);
            this.lastUpdatedAt = null;
            this.startPolling();
            this.showStatus('New namespace created: ' + this.currentNamespace);
        }
    },

    // ============================================
    // METHOD: createNewClipboard
    // PURPOSE: Save current clipboard content
    // ============================================
    async createNewClipboard() {
        if (!confirm('Create new clipboard? Current content will be saved to history.')) return;
        
        const result = await this.createNew(this.currentNamespace);
        if (result.success) {
            const textarea = document.querySelector('[data-input="text-content"]');
            textarea.value = '';
            this.updateFilesList([]);
            this.updateHistoryList(result.data.history);
            this.showStatus('New clipboard created');
        }
    },

    // ============================================
    // METHOD: copyText
    // PURPOSE: Copy text content to system clipboard
    // ============================================
    async copyText() {
        const textArea = document.querySelector('[data-input="text-content"]');
        await navigator.clipboard.writeText(textArea.value);
        this.showStatus('Copied to clipboard');
    },

    // ============================================
    // METHOD: clearText
    // PURPOSE: Clear text content
    // ============================================
    async clearText() {
        if (!confirm('Clear all text?')) return;
        const textArea = document.querySelector('[data-input="text-content"]');
        textArea.value = '';
        await this.saveText(this.currentNamespace, '');
        this.showStatus('Text cleared');
    },

    // ============================================
    // METHOD: handleFileUpload
    // PURPOSE: Handle file uploads
    // ============================================
    async handleFileUpload(files) {
        this.showStatus('Uploading...');
        const result = await this.uploadFiles(this.currentNamespace, files);
        if (result.success) {
            await this.loadClipboardData();
            this.showStatus(result.message);
        } else {
            this.showStatus(result.message || 'Upload failed', true);
        }
    },

    // ============================================
    // METHOD: updateFilesList
    // PURPOSE: Update files list display
    // ============================================
    updateFilesList(files) {
        const section = document.getElementById('clipboard-files-section');
        const list = document.getElementById('clipboard-files-list');

        list.innerHTML = '';

        for (const file of files) {
            const item = document.createElement('div');
            item.className = 'clipboard-file-item';
            item.dataset.stored = file.stored_name;

            const name = document.createElement('span');
            name.className = 'clipboard-file-name';
            name.textContent = '📄 ' + file.original_name;
            name.title = file.original_name;

            const size = document.createElement('span');
            size.className = 'clipboard-file-size';
            size.textContent = this.formatFileSize(file.size);

            const downloadBtn = document.createElement('a');
            downloadBtn.className = 'ittools-btn ittools-btn-primary ittools-btn-sm';
            downloadBtn.textContent = '⬇️ Download';
            downloadBtn.href = `/clipboard/download?namespace=${this.currentNamespace}&stored_name=${encodeURIComponent(file.stored_name)}&original_name=${encodeURIComponent(file.original_name)}`;
            downloadBtn.download = file.original_name;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'ittools-btn ittools-btn-secondary ittools-btn-sm';
            deleteBtn.textContent = '🗑️';
            deleteBtn.dataset.action = 'delete-file';
            deleteBtn.dataset.stored = file.stored_name;

            item.appendChild(name);
            item.appendChild(size);
            item.appendChild(downloadBtn);
            item.appendChild(deleteBtn);
            list.appendChild(item);
        }

        if (files.length > 0) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    },

    // ============================================
    // METHOD: updateHistoryList
    // PURPOSE: Update history list display
    // ============================================
    updateHistoryList(history) {
        const section = document.getElementById('clipboard-history-section');
        const list = document.getElementById('clipboard-history-list');

        list.innerHTML = '';

        for (let i = 0; i < history.length; i++) {
            const entry = history[i];
            const textPreview = entry.text.substring(0, 50) + (entry.text.length > 50 ? '...' : '');
            const fileCount = entry.files.length;

            const item = document.createElement('div');
            item.className = 'clipboard-history-item';
            item.dataset.action = 'restore-history';
            item.dataset.index = i;

            const preview = document.createElement('span');
            preview.className = 'clipboard-history-preview';
            preview.textContent = textPreview + (fileCount > 0 ? ` (${fileCount} files)` : '');

            const time = document.createElement('span');
            time.className = 'clipboard-history-time';
            time.textContent = new Date(entry.created_at).toLocaleString();

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'ittools-btn ittools-btn-primary ittools-btn-sm';
            restoreBtn.textContent = '↩️ Restore';
            restoreBtn.dataset.action = 'restore-history';
            restoreBtn.dataset.index = i;

            item.appendChild(preview);
            item.appendChild(time);
            item.appendChild(restoreBtn);
            list.appendChild(item);
        }

        if (history.length > 0) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    },

    // ============================================
    // METHOD: loadClipboardData
    // PURPOSE: Load clipboard data from server
    // ============================================
    async loadClipboardData(silent = false) {
        if (this.isLoading) return;
        this.isLoading = true;

        const result = await this.fetchData(this.currentNamespace);
        const newUpdatedAt = result.data.current.updated_at;
        const hasChanges = !this.lastUpdatedAt || newUpdatedAt !== this.lastUpdatedAt;
        
        if (hasChanges) {
            const textarea = document.querySelector('[data-input="text-content"]');
            const activeEl = document.activeElement;
            const isTyping = activeEl && activeEl.id === 'clipboard-textarea';
            
            if (result.data.current && !isTyping) {
                textarea.value = result.data.current.text;
            }
            this.updateFilesList(result.data.current.files);
            this.updateHistoryList(result.data.history);
            
            this.lastUpdatedAt = newUpdatedAt;
            
            if (!silent && hasChanges) {
                this.showStatus('Updated from server', false);
            }
        }

        this.isLoading = false;
    },
    
    // ============================================
    // METHOD: startPolling
    // PURPOSE: Start polling for updates
    // ============================================
    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => {
            this.loadClipboardData(true);
        }, this.POLLING_INTERVAL_MS);
    },
    
    // ============================================
    // METHOD: stopPolling
    // PURPOSE: Stop polling for updates
    // ============================================
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    },

    // ============================================
    // METHOD: showContentSection
    // PURPOSE: Show clipboard content section
    // ============================================
    showContentSection() {
        const section = document.getElementById('clipboard-content-section');
        section.classList.remove('hidden');
    },

    // ============================================
    // METHOD: autoSaveContent
    // PURPOSE: Auto-save content (debounced)
    // ============================================
    autoSaveContent() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveContent();
        }, 500);
    },

    // ============================================
    // METHOD: saveContent
    // PURPOSE: Save content to server
    // ============================================
    async saveContent() {
        const textArea = document.querySelector('[data-input="text-content"]');
        const result = await this.saveText(this.currentNamespace, textArea.value);
        if (result.success) {
            this.showStatus('Saved');
        }
    },

    // ============================================
    // METHOD: showStatus
    // PURPOSE: Show status message
    // ============================================
    showStatus(message, isError = false) {
        const status = document.getElementById('clipboard-status');
        status.textContent = message;
        status.className = isError ? 'clipboard-status error' : 'clipboard-status success';
        setTimeout(() => { 
            status.textContent = '';
            status.className = 'clipboard-status';
        }, 3000);
    },

    // ============================================
    // METHOD: initializeNamespace
    // PURPOSE: Initialize namespace on load
    // ============================================
    async initializeNamespace() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        const storedNs = this.getStoredNamespace();
        const nsInput = document.querySelector('[data-input="namespace"]');
        const contentSection = document.getElementById('clipboard-content-section');
        
        if (storedNs) {
            nsInput.value = storedNs;
            this.currentNamespace = storedNs;
            contentSection.classList.remove('hidden');
            await this.loadClipboardData();
            this.startPolling();
            this.showStatus('Restored namespace: ' + storedNs);
        } else {
            const result = await this.fetchNamespace();
            this.currentNamespace = result.namespace;
            this.setStoredNamespace(this.currentNamespace);
            nsInput.value = this.currentNamespace;
            contentSection.classList.remove('hidden');
            await this.loadClipboardData();
            this.startPolling();
            this.showStatus('New namespace created: ' + this.currentNamespace);
        }
    }
};

// ============================================
// REGISTRATION: Register tool in ITTools system
// ============================================
ITTools.Tools.Registry.register('online-clipboard', {
    name: 'Online Clipboard',
    category: 'clipboard',
    render: ITTools.Implementations.Clipboard.render.bind(ITTools.Implementations.Clipboard),
    init: ITTools.Implementations.Clipboard.init.bind(ITTools.Implementations.Clipboard)
});
