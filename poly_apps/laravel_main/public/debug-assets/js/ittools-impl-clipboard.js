// ============================================
// NAMESPACE: ITTools.ClipboardTool
// FILE: ittools-impl-clipboard.js
// PURPOSE: Online Clipboard with namespace support
// ============================================

(function() {
    const STORAGE_KEY = 'ittools_clipboard_namespace';
    let currentNamespace = null;
    let saveTimeout = null;
    let isLoading = false;
    let isInitialized = false;
    let pollingInterval = null;
    let lastUpdatedAt = null;
    const POLLING_INTERVAL_MS = 3000;

    function getStoredNamespace() {
        return localStorage.getItem(STORAGE_KEY);
    }

    function setStoredNamespace(ns) {
        localStorage.setItem(STORAGE_KEY, ns.toLowerCase());
    }

    async function fetchNamespace(ns = null) {
        const url = ns ? `/clipboard/namespace?namespace=${encodeURIComponent(ns.toLowerCase())}` : '/clipboard/namespace';
        const response = await APIClient.get(url, { includeAuth: false });
        return response.json();
    }

    async function fetchData(ns) {
        const response = await APIClient.get(`/clipboard/data?namespace=${ns}`, { includeAuth: false });
        return response.json();
    }

    async function saveText(ns, text) {
        const response = await APIClient.post('/clipboard/text', { namespace: ns, text: text }, { includeAuth: false });
        return response.json();
    }

    async function uploadFiles(ns, files) {
        const formData = new FormData();
        formData.append('namespace', ns);
        for (let i = 0; i < files.length; i++) {
            formData.append('files[]', files[i]);
        }
        const response = await APIClient.post('/clipboard/upload', formData, { includeAuth: false });
        return response.json();
    }

    async function deleteFile(ns, storedName) {
        const response = await APIClient.post('/clipboard/delete-file', { namespace: ns, stored_name: storedName }, { includeAuth: false });
        return response.json();
    }

    async function createNew(ns) {
        const response = await APIClient.post('/clipboard/new', { namespace: ns }, { includeAuth: false });
        return response.json();
    }

    async function restoreHistory(ns, index) {
        const response = await APIClient.post('/clipboard/restore', { namespace: ns, history_index: index }, { includeAuth: false });
        return response.json();
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function renderUI() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">📋 Online Clipboard</div>
                <div class="ittools-card-body">
                    <div class="clipboard-namespace-section" style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <label style="font-weight: 600;">Namespace:</label>
                            <input type="text" id="clipboard-namespace-input" class="ittools-input" 
                                   style="width: 180px; text-align: center; font-size: 18px; font-weight: bold; text-transform: lowercase;" 
                                   placeholder="e.g. abc123" maxlength="20">
                            <button class="ittools-btn ittools-btn-primary" id="clipboard-load-ns-btn">Load / Enter</button>
                            <button class="ittools-btn ittools-btn-secondary" id="clipboard-new-ns-btn">Generate New</button>
                            <span id="clipboard-status" style="margin-left: auto; font-size: 12px; color: #666;"></span>
                        </div>
                    </div>

                    <div class="clipboard-content-section" id="clipboard-content-section" style="display: none;">
                        <div class="ittools-form-group">
                            <label class="ittools-label">Text Content (auto-saves on change):</label>
                            <textarea id="clipboard-textarea" class="ittools-textarea" 
                                      style="min-height: 200px; font-family: monospace;" 
                                      placeholder="Paste or type any content here..."></textarea>
                        </div>

                        <div class="ittools-form-group">
                            <label class="ittools-label">Upload Files:</label>
                            <div id="clipboard-dropzone" style="border: 2px dashed #ccc; border-radius: 8px; padding: 30px; text-align: center; cursor: pointer; transition: all 0.3s;">
                                <p style="margin: 0; color: #666;">📁 Drop files here or click to upload</p>
                                <p style="margin: 5px 0 0; font-size: 12px; color: #999;">Any file type allowed</p>
                                <input type="file" id="clipboard-file-input" multiple style="display: none;">
                            </div>
                        </div>

                        <div class="ittools-form-group" id="clipboard-files-section" style="display: none;">
                            <label class="ittools-label">Uploaded Files:</label>
                            <div id="clipboard-files-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
                        </div>

                        <div class="ittools-btn-group" style="margin-top: 20px;">
                            <button class="ittools-btn ittools-btn-success" id="clipboard-new-btn">📝 New Clipboard</button>
                            <button class="ittools-btn ittools-btn-secondary" id="clipboard-copy-btn">📋 Copy All Text</button>
                            <button class="ittools-btn ittools-btn-secondary" id="clipboard-clear-btn">🗑️ Clear Text</button>
                        </div>

                        <div class="ittools-form-group" id="clipboard-history-section" style="margin-top: 20px; display: none;">
                            <label class="ittools-label">History (Last 10):</label>
                            <div id="clipboard-history-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderFileItem(file) {
        return `
            <div class="clipboard-file-item" data-stored="${file.stored_name}" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.original_name}">
                    📄 ${file.original_name}
                </span>
                <span style="font-size: 12px; color: #666;">${formatFileSize(file.size)}</span>
                <a href="/clipboard/download?namespace=${currentNamespace}&stored_name=${encodeURIComponent(file.stored_name)}&original_name=${encodeURIComponent(file.original_name)}" 
                   class="ittools-btn ittools-btn-primary" style="padding: 5px 10px; font-size: 12px;" download>
                    ⬇️ Download
                </a>
                <button class="ittools-btn ittools-btn-secondary clipboard-delete-file" data-stored="${file.stored_name}" style="padding: 5px 10px; font-size: 12px;">
                    🗑️
                </button>
            </div>
        `;
    }

    function renderHistoryItem(entry, index) {
        const textPreview = entry.text ? entry.text.substring(0, 50) + (entry.text.length > 50 ? '...' : '') : '(empty)';
        const fileCount = entry.files ? entry.files.length : 0;
        return `
            <div class="clipboard-history-item" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: #fff; border: 1px solid #e9ecef; border-radius: 6px;">
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">
                    ${textPreview} ${fileCount > 0 ? `(${fileCount} files)` : ''}
                </span>
                <span style="font-size: 11px; color: #999;">${new Date(entry.created_at).toLocaleString()}</span>
                <button class="ittools-btn ittools-btn-primary clipboard-restore-history" data-index="${index}" style="padding: 5px 10px; font-size: 12px;">
                    ↩️ Restore
                </button>
            </div>
        `;
    }

    function updateFilesList(files) {
        const section = document.getElementById('clipboard-files-section');
        const list = document.getElementById('clipboard-files-list');
        if (!section || !list) return;

        if (files && files.length > 0) {
            section.style.display = 'block';
            list.innerHTML = files.map(f => renderFileItem(f)).join('');
        } else {
            section.style.display = 'none';
            list.innerHTML = '';
        }
    }

    function updateHistoryList(history) {
        const section = document.getElementById('clipboard-history-section');
        const list = document.getElementById('clipboard-history-list');
        if (!section || !list) return;

        if (history && history.length > 0) {
            section.style.display = 'block';
            list.innerHTML = history.map((h, i) => renderHistoryItem(h, i)).join('');
        } else {
            section.style.display = 'none';
            list.innerHTML = '';
        }
    }

    function showStatus(message, isError = false) {
        const status = document.getElementById('clipboard-status');
        if (status) {
            status.textContent = message;
            status.style.color = isError ? '#dc3545' : '#28a745';
            setTimeout(() => { status.textContent = ''; }, 3000);
        }
    }

    async function loadClipboardData(silent = false) {
        if (!currentNamespace || isLoading) return;
        isLoading = true;

        try {
            const result = await fetchData(currentNamespace);
            if (result.success) {
                const newUpdatedAt = result.data.current?.updated_at;
                const hasChanges = !lastUpdatedAt || newUpdatedAt !== lastUpdatedAt;
                
                if (hasChanges) {
                    const textarea = document.getElementById('clipboard-textarea');
                    const activeEl = document.activeElement;
                    const isTyping = activeEl && activeEl.id === 'clipboard-textarea';
                    
                    if (textarea && result.data.current && !isTyping) {
                        textarea.value = result.data.current.text || '';
                    }
                    updateFilesList(result.data.current?.files || []);
                    updateHistoryList(result.data.history || []);
                    
                    lastUpdatedAt = newUpdatedAt;
                    
                    if (!silent && hasChanges) {
                        showStatus('Updated from server', false);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load clipboard data:', e);
        } finally {
            isLoading = false;
        }
    }
    
    function startPolling() {
        stopPolling();
        if (currentNamespace) {
            pollingInterval = setInterval(() => {
                loadClipboardData(true);
            }, POLLING_INTERVAL_MS);
        }
    }
    
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    function attachEvents() {
        const nsInput = document.getElementById('clipboard-namespace-input');
        const loadBtn = document.getElementById('clipboard-load-ns-btn');
        const newNsBtn = document.getElementById('clipboard-new-ns-btn');
        const textarea = document.getElementById('clipboard-textarea');
        const dropzone = document.getElementById('clipboard-dropzone');
        const fileInput = document.getElementById('clipboard-file-input');
        const newBtn = document.getElementById('clipboard-new-btn');
        const copyBtn = document.getElementById('clipboard-copy-btn');
        const clearBtn = document.getElementById('clipboard-clear-btn');
        const contentSection = document.getElementById('clipboard-content-section');

        if (nsInput) {
            nsInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
            });
            nsInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') loadBtn?.click();
            });
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', async () => {
                const ns = nsInput?.value?.trim();
                if (!ns) {
                    showStatus('Please enter a namespace ID', true);
                    return;
                }
                try {
                    const result = await fetchNamespace(ns);
                    if (result.success) {
                        stopPolling();
                        currentNamespace = result.namespace;
                        setStoredNamespace(currentNamespace);
                        nsInput.value = currentNamespace;
                        contentSection.style.display = 'block';
                        lastUpdatedAt = null;
                        await loadClipboardData();
                        startPolling();
                        showStatus('Namespace loaded');
                    } else {
                        showStatus(result.message || 'Failed to load namespace', true);
                    }
                } catch (e) {
                    showStatus('Error loading namespace', true);
                }
            });
        }

        if (newNsBtn) {
            newNsBtn.addEventListener('click', async () => {
                try {
                    const result = await fetchNamespace();
                    if (result.success) {
                        stopPolling();
                        currentNamespace = result.namespace;
                        setStoredNamespace(currentNamespace);
                        nsInput.value = currentNamespace;
                        contentSection.style.display = 'block';
                        textarea.value = '';
                        updateFilesList([]);
                        updateHistoryList([]);
                        lastUpdatedAt = null;
                        startPolling();
                        showStatus('New namespace created: ' + currentNamespace);
                    }
                } catch (e) {
                    showStatus('Error creating namespace', true);
                }
            });
        }

        if (textarea) {
            textarea.addEventListener('input', () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    if (!currentNamespace) return;
                    try {
                        const result = await saveText(currentNamespace, textarea.value);
                        if (result.success) {
                            showStatus('Saved');
                        }
                    } catch (e) {
                        showStatus('Failed to save', true);
                    }
                }, 500);
            });
        }

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            
            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.style.borderColor = '#667eea';
                dropzone.style.background = 'rgba(103, 126, 234, 0.05)';
            });
            
            dropzone.addEventListener('dragleave', () => {
                dropzone.style.borderColor = '#ccc';
                dropzone.style.background = 'transparent';
            });
            
            dropzone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropzone.style.borderColor = '#ccc';
                dropzone.style.background = 'transparent';
                
                if (!currentNamespace) {
                    showStatus('Please select a namespace first', true);
                    return;
                }
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    await handleFileUpload(files);
                }
            });
            
            fileInput.addEventListener('change', async (e) => {
                if (!currentNamespace) {
                    showStatus('Please select a namespace first', true);
                    return;
                }
                if (e.target.files.length > 0) {
                    await handleFileUpload(e.target.files);
                    e.target.value = '';
                }
            });
        }

        if (newBtn) {
            newBtn.addEventListener('click', async () => {
                if (!currentNamespace) return;
                if (!confirm('Create new clipboard? Current content will be saved to history.')) return;
                
                try {
                    const result = await createNew(currentNamespace);
                    if (result.success) {
                        textarea.value = '';
                        updateFilesList([]);
                        updateHistoryList(result.data?.history || []);
                        showStatus('New clipboard created');
                    }
                } catch (e) {
                    showStatus('Failed to create new clipboard', true);
                }
            });
        }

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (textarea) {
                    navigator.clipboard.writeText(textarea.value).then(() => {
                        showStatus('Copied to clipboard');
                    }).catch(() => {
                        showStatus('Failed to copy', true);
                    });
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (!confirm('Clear all text?')) return;
                if (textarea) {
                    textarea.value = '';
                    if (currentNamespace) {
                        await saveText(currentNamespace, '');
                        showStatus('Text cleared');
                    }
                }
            });
        }

        document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('clipboard-delete-file')) {
                const storedName = e.target.dataset.stored;
                if (!storedName || !currentNamespace) return;
                if (!confirm('Delete this file?')) return;
                
                try {
                    const result = await deleteFile(currentNamespace, storedName);
                    if (result.success) {
                        await loadClipboardData();
                        showStatus('File deleted');
                    }
                } catch (e) {
                    showStatus('Failed to delete file', true);
                }
            }
            
            if (e.target.classList.contains('clipboard-restore-history')) {
                const index = parseInt(e.target.dataset.index, 10);
                if (isNaN(index) || !currentNamespace) return;
                if (!confirm('Restore this history? Current content will be saved.')) return;
                
                try {
                    const result = await restoreHistory(currentNamespace, index);
                    if (result.success) {
                        await loadClipboardData();
                        showStatus('History restored');
                    }
                } catch (e) {
                    showStatus('Failed to restore history', true);
                }
            }
        });

        async function initializeNamespace() {
            if (isInitialized) return;
            isInitialized = true;
            
            const storedNs = getStoredNamespace();
            if (storedNs) {
                nsInput.value = storedNs;
                currentNamespace = storedNs;
                contentSection.style.display = 'block';
                await loadClipboardData();
                startPolling();
                showStatus('Restored namespace: ' + storedNs);
            } else {
                try {
                    const result = await fetchNamespace();
                    if (result.success) {
                        currentNamespace = result.namespace;
                        setStoredNamespace(currentNamespace);
                        nsInput.value = currentNamespace;
                        contentSection.style.display = 'block';
                        await loadClipboardData();
                        startPolling();
                        showStatus('New namespace created: ' + currentNamespace);
                    }
                } catch (e) {
                    showStatus('Error initializing clipboard', true);
                }
            }
        }
        
        initializeNamespace();
        
        window.addEventListener('beforeunload', () => {
            stopPolling();
        });
    }

    async function handleFileUpload(files) {
        if (!currentNamespace) return;
        
        showStatus('Uploading...');
        try {
            const result = await uploadFiles(currentNamespace, files);
            if (result.success) {
                await loadClipboardData();
                showStatus(result.message);
            } else {
                showStatus(result.message || 'Upload failed', true);
            }
        } catch (e) {
            showStatus('Upload error', true);
        }
    }

    if (typeof ITTools !== 'undefined' && ITTools.Tools && ITTools.Tools.Registry) {
        ITTools.Tools.Registry.register('online-clipboard', {
            name: 'Online Clipboard',
            category: 'clipboard',
            render: renderUI,
            init: attachEvents
        });
    }

    console.log('ITTools Clipboard Tool loaded');
})();
