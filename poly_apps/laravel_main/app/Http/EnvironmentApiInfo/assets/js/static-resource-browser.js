const StaticResourceBrowser = {
    currentPath: '',
    expandedFolders: new Set(),
    selectedItem: null,
    selectedItemType: null,
    uploadFiles: [],
    uploadTargetPath: '',

    init() {
        console.log('[StaticResourceBrowser] Initializing...');
        this.loadFileList();
        this.setupEventListeners();
    },

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const contextMenu = document.getElementById('static-context-menu');
            if (contextMenu && !contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });

        const uploadDialog = document.getElementById('upload-dialog');
        uploadDialog.addEventListener('click', (e) => {
            if (e.target === uploadDialog) {
                this.closeUploadDialog();
            }
        });

        const createDirDialog = document.getElementById('create-dir-dialog');
        createDirDialog.addEventListener('click', (e) => {
            if (e.target === createDirDialog) {
                this.closeCreateDirDialog();
            }
        });

        const dropZone = document.getElementById('upload-drop-zone');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#0e639c';
            dropZone.style.background = '#2a2d2e';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#454545';
            dropZone.style.background = '#1e1e1e';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '#454545';
            dropZone.style.background = '#1e1e1e';

            const items = Array.from(e.dataTransfer.items);
            this.handleDroppedItems(items);
        });

        const fileInput = document.getElementById('upload-file-input');
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.addFilesToUpload(files);
        });
    },

    async handleDroppedItems(items) {
        const files = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    await this.traverseFileTree(entry, '', files);
                }
            }
        }
        this.addFilesToUpload(files);
    },

    async traverseFileTree(item, path, files) {
        if (item.isFile) {
            return new Promise((resolve) => {
                item.file((file) => {
                    files.push({
                        file: file,
                        fullPath: path + file.name
                    });
                    resolve();
                });
            });
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            return new Promise((resolve) => {
                dirReader.readEntries(async (entries) => {
                    for (const entry of entries) {
                        await this.traverseFileTree(entry, path + item.name + '/', files);
                    }
                    resolve();
                });
            });
        }
    },

    async loadFileList(path = '') {
        try {
            const response = await fetch(`/static-resources/file-tree?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (data.error) {
                console.error('[StaticResourceBrowser] Error:', data.error);
                return;
            }

            this.currentPath = path;
            this.renderFileList(data.items, path);
            document.getElementById('static-resources-path-display').textContent =
                `Path: ${data.path || '/'}`;
        } catch (error) {
            console.error('[StaticResourceBrowser] Failed to load file list:', error);
        }
    },

    renderFileList(items, currentPath) {
        const container = document.getElementById('static-file-list');

        if (items.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No files found</div>';
            return;
        }

        let html = '';

        if (currentPath) {
            html += `
                <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; color: #888;"
                     onclick="StaticResourceBrowser.navigateUp()">
                    <span style="margin-right: 8px;">⬆️</span>
                    <span>..</span>
                </div>
            `;
        }

        items.forEach(item => {
            if (item.type === 'directory') {
                const isExpanded = this.expandedFolders.has(item.path);
                html += `
                    <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #333; user-select: none;"
                         onclick="StaticResourceBrowser.toggleFolder('${item.path.replace(/'/g, "\\'")}')"
                         oncontextmenu="StaticResourceBrowser.showContextMenu(event, '${item.path.replace(/'/g, "\\'")}', 'directory')">
                        <div style="display: flex; align-items: center; color: #dcdcaa;">
                            <span style="margin-right: 8px;">${isExpanded ? '📂' : '📁'}</span>
                            <span style="font-weight: 500;">${item.name}</span>
                        </div>
                    </div>
                `;
            } else {
                const icon = this.getFileIcon(item.mimeType, item.extension);
                const size = this.formatFileSize(item.size);
                html += `
                    <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #333; user-select: none;"
                         onclick="StaticResourceBrowser.previewFile('${item.path.replace(/'/g, "\\'")}', '${item.mimeType}')"
                         oncontextmenu="StaticResourceBrowser.showContextMenu(event, '${item.path.replace(/'/g, "\\'")}', 'file')">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; flex: 1;">
                                <span style="margin-right: 8px;">${icon}</span>
                                <span>${item.name}</span>
                            </div>
                            <span style="font-size: 11px; color: #888; margin-left: 10px;">${size}</span>
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
    },

    getFileIcon(mimeType, extension) {
        if (mimeType) {
            if (mimeType.startsWith('image/')) return '🖼️';
            if (mimeType.startsWith('video/')) return '🎬';
            if (mimeType.startsWith('audio/')) return '🎵';
            if (mimeType.startsWith('text/')) return '📄';
            if (mimeType === 'application/pdf') return '📕';
        }

        const ext = extension ? extension.toLowerCase() : '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
        if (['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(ext)) return '🎬';
        if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return '🎵';
        if (['txt', 'md', 'log', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) return '📄';
        if (ext === 'pdf') return '📕';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦';

        return '📄';
    },

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
    },

    toggleFolder(path) {
        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
        } else {
            this.expandedFolders.add(path);
            this.loadFileList(path);
        }
    },

    navigateUp() {
        const parts = this.currentPath.split('/').filter(p => p);
        parts.pop();
        const parentPath = parts.join('/');
        this.loadFileList(parentPath);
    },

    async previewFile(path, mimeType) {
        this.selectedItem = path;

        const container = document.getElementById('preview-container');
        const fileName = document.getElementById('preview-file-name');
        const fileInfo = document.getElementById('preview-file-info');

        fileName.textContent = path.split('/').pop();
        fileInfo.textContent = 'Loading...';

        try {
            const response = await fetch(`/static-resources/read-file?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (data.error) {
                container.innerHTML = `<div style="color: #dc3545; text-align: center;">${data.error}</div>`;
                return;
            }

            fileInfo.textContent = `${this.formatFileSize(data.size)} | ${data.modified}`;

            if (mimeType.startsWith('image/')) {
                container.innerHTML = `
                    <img src="/static-resources/stream-file?path=${encodeURIComponent(path)}"
                         style="max-width: 100%; max-height: 100%; object-fit: contain;"
                         alt="${data.path}">
                `;
            } else if (mimeType.startsWith('video/')) {
                container.innerHTML = `
                    <video controls style="max-width: 100%; max-height: 100%;">
                        <source src="/static-resources/stream-file?path=${encodeURIComponent(path)}" type="${mimeType}">
                        Your browser does not support the video tag.
                    </video>
                `;
            } else if (mimeType.startsWith('audio/')) {
                container.innerHTML = `
                    <div style="text-align: center; width: 100%;">
                        <p style="color: #888; margin-bottom: 20px;">🎵 ${data.path.split('/').pop()}</p>
                        <audio controls style="width: 100%; max-width: 500px;">
                            <source src="/static-resources/stream-file?path=${encodeURIComponent(path)}" type="${mimeType}">
                            Your browser does not support the audio tag.
                        </audio>
                    </div>
                `;
            } else if (data.isText && data.content) {
                container.innerHTML = `
                    <textarea readonly style="width: 100%; height: 100%; background: #1e1e1e; color: #d4d4d4; border: 1px solid #333; padding: 15px; font-family: 'Consolas', monospace; font-size: 13px; line-height: 1.6; resize: none; tab-size: 4;">${data.content}</textarea>
                `;
            } else {
                container.innerHTML = `
                    <div style="text-align: center; color: #888;">
                        <p style="font-size: 48px; margin-bottom: 20px;">${this.getFileIcon(mimeType, data.extension)}</p>
                        <p style="font-size: 16px; margin-bottom: 10px;">${data.path.split('/').pop()}</p>
                        <p style="font-size: 13px; color: #666;">${data.mimeType}</p>
                        <p style="font-size: 13px; color: #666; margin-top: 10px;">${this.formatFileSize(data.size)}</p>
                        <button onclick="window.open('/static-resources/stream-file?path=${encodeURIComponent(path)}', '_blank')"
                                style="margin-top: 20px; padding: 10px 20px; background: #0e639c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            Download / Open
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('[StaticResourceBrowser] Preview error:', error);
            container.innerHTML = `<div style="color: #dc3545; text-align: center;">Failed to load file</div>`;
        }
    },

    showContextMenu(event, path, type) {
        event.preventDefault();

        this.selectedItem = path;
        this.selectedItemType = type;

        const menu = document.getElementById('static-context-menu');
        const uploadToMenu = document.getElementById('static-menu-upload-to');

        if (type === 'directory') {
            uploadToMenu.style.display = 'block';
        } else {
            uploadToMenu.style.display = 'none';
        }

        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        menu.style.display = 'block';
    },

    uploadToFolder() {
        const menu = document.getElementById('static-context-menu');
        menu.style.display = 'none';

        if (!this.selectedItem || this.selectedItemType !== 'directory') return;

        this.uploadTargetPath = this.selectedItem;
        this.showUploadDialog();
    },

    async renameWithTranslation() {
        if (!this.selectedItem) return;

        const menu = document.getElementById('static-context-menu');
        menu.style.display = 'none';

        const fileName = this.selectedItem.split('/').pop();

        const response = await fetch('/translation/simple/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                text: fileName,
                target_lang: 'en'
            })
        });

        const data = await response.json();
        let translatedName = data.translated_text || fileName;

        translatedName = translatedName.replace(/\s+/g, '_');
        translatedName = translatedName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

        const extension = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
        if (extension && !translatedName.endsWith(extension)) {
            translatedName = translatedName.replace(/\.[^.]*$/, '') + extension;
        }

        const confirmed = confirm(`Rename to: ${translatedName}?`);
        if (!confirmed) return;

        try {
            const renameResponse = await fetch('/static-resources/rename', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    old_path: this.selectedItem,
                    new_name: translatedName
                })
            });

            const result = await renameResponse.json();

            if (result.success) {
                alert('Renamed successfully!');
                this.refreshList();
            } else {
                alert('Rename failed: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('[StaticResourceBrowser] Rename error:', error);
            alert('Rename failed');
        }
    },

    showUploadDialog() {
        this.uploadFiles = [];
        this.uploadTargetPath = this.currentPath;

        document.getElementById('upload-file-list').innerHTML = '';
        document.getElementById('upload-target-path').textContent = `Target: /${this.currentPath}`;
        document.getElementById('upload-btn').disabled = true;
        document.getElementById('upload-dialog').style.display = 'flex';
        document.getElementById('upload-file-input').value = '';
    },

    closeUploadDialog() {
        document.getElementById('upload-dialog').style.display = 'none';
        this.uploadFiles = [];
    },

    addFilesToUpload(files) {
        const processedFiles = files.map(f => {
            if (f.file) {
                return f;
            } else {
                return {
                    file: f,
                    fullPath: f.webkitRelativePath || f.name
                };
            }
        });

        this.uploadFiles = this.uploadFiles.concat(processedFiles);
        this.renderUploadFileList();
        document.getElementById('upload-btn').disabled = this.uploadFiles.length === 0;
    },

    renderUploadFileList() {
        const container = document.getElementById('upload-file-list');

        if (this.uploadFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '<div style="margin-top: 10px; padding: 10px; background: #2a2d2e; border-radius: 4px;">';
        html += `<p style="color: #888; font-size: 12px; margin-bottom: 8px;">Files to upload (${this.uploadFiles.length}):</p>`;

        this.uploadFiles.forEach((item, index) => {
            const file = item.file || item;
            const displayPath = item.fullPath || item.name || file.name;
            const fileSize = file.size || 0;

            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: #1e1e1e; border-radius: 3px; margin-bottom: 4px;">
                    <span style="color: #cccccc; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${displayPath}">${displayPath}</span>
                    <span style="color: #888; font-size: 11px; margin: 0 10px;">${this.formatFileSize(fileSize)}</span>
                    <button onclick="StaticResourceBrowser.removeUploadFile(${index})" style="background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 14px;">✕</button>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    removeUploadFile(index) {
        this.uploadFiles.splice(index, 1);
        this.renderUploadFileList();
        document.getElementById('upload-btn').disabled = this.uploadFiles.length === 0;
    },

    async executeUpload() {
        if (this.uploadFiles.length === 0) return;

        const uploadBtn = document.getElementById('upload-btn');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const formData = new FormData();
        this.uploadFiles.forEach((item, index) => {
            const file = item.file || item;
            const relativePath = item.fullPath || file.webkitRelativePath || file.name;

            formData.append('files[]', file);
            formData.append(`file_paths[${index}]`, relativePath);
        });
        formData.append('target_path', this.uploadTargetPath);

        try {
            const response = await fetch('/static-resources/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                alert(`Successfully uploaded ${result.uploaded_count} file(s)`);
                this.closeUploadDialog();
                this.refreshList();
            } else {
                alert('Upload failed: ' + (result.error || 'Unknown error'));
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload';
            }
        } catch (error) {
            console.error('[StaticResourceBrowser] Upload error:', error);
            alert('Upload failed');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }
    },

    refreshList() {
        this.loadFileList(this.currentPath);
    },

    showCreateDirDialog() {
        document.getElementById('new-dir-name').value = '';
        document.getElementById('translate-dir-name').checked = false;
        document.getElementById('create-dir-target-path').textContent = `Parent: /${this.currentPath}`;
        document.getElementById('create-dir-dialog').style.display = 'flex';
        document.getElementById('new-dir-name').focus();
    },

    closeCreateDirDialog() {
        document.getElementById('create-dir-dialog').style.display = 'none';
    },

    async executeCreateDir() {
        const dirName = document.getElementById('new-dir-name').value.trim();
        const translateName = document.getElementById('translate-dir-name').checked;

        if (!dirName) {
            alert('Please enter a folder name');
            return;
        }

        const createBtn = document.getElementById('create-dir-btn');
        createBtn.disabled = true;
        createBtn.textContent = 'Creating...';

        let finalName = dirName;

        if (translateName) {
            try {
                const response = await fetch('/translation/simple/google', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                    },
                    body: JSON.stringify({
                        text: dirName,
                        target_lang: 'en'
                    })
                });

                const data = await response.json();
                finalName = data.translated_text || dirName;
                finalName = finalName.replace(/\s+/g, '_');
                finalName = finalName.replace(/[^a-zA-Z0-9_\-]/g, '_');
            } catch (error) {
                console.error('[StaticResourceBrowser] Translation error:', error);
            }
        }

        try {
            const response = await fetch('/static-resources/create-directory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    parent_path: this.currentPath,
                    dir_name: finalName,
                    translate_name: false
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('Folder created successfully!');
                this.closeCreateDirDialog();
                this.refreshList();
            } else {
                alert('Failed to create folder: ' + (result.error || 'Unknown error'));
                createBtn.disabled = false;
                createBtn.textContent = 'Create';
            }
        } catch (error) {
            console.error('[StaticResourceBrowser] Create directory error:', error);
            alert('Failed to create folder');
            createBtn.disabled = false;
            createBtn.textContent = 'Create';
        }
    }
};
