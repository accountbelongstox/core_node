const StaticResourceBrowser = {
    currentPath: '',
    expandedFolders: new Set(),
    selectedItem: null,
    selectedItemType: null,
    uploadFiles: [],
    uploadTargetPath: '',
    folderContents: {},
    CHUNK_SIZE: 5 * 1024 * 1024,
    activeUploads: new Map(),

    async init() {
        console.log('[StaticResourceBrowser] Initializing...');
        this.loadExpandedState();
        await this.loadFileList();
        await this.loadExpandedFolders();
        this.setupEventListeners();
    },

    async loadExpandedFolders() {
        for (const path of this.expandedFolders) {
            if (!this.folderContents[path]) {
                const response = await fetch(`/static-resources/file-tree?path=${encodeURIComponent(path)}`);
                const data = await response.json();

                if (!data.error) {
                    this.folderContents[path] = data.items;
                }
            }
        }
        this.updatePathDisplay(this.currentPath);
        this.renderFileList();
    },

    loadExpandedState() {
        const saved = localStorage.getItem('static-browser-expanded-folders');
        if (saved) {
            this.expandedFolders = new Set(JSON.parse(saved));
            console.log('[StaticResourceBrowser] Loaded expanded state:', this.expandedFolders);
        }
    },

    saveExpandedState() {
        localStorage.setItem('static-browser-expanded-folders', JSON.stringify([...this.expandedFolders]));
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
        const response = await fetch(`/static-resources/file-tree?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.error) {
            console.error('[StaticResourceBrowser] Error:', data.error);
            return null;
        }

        this.currentPath = path;
        this.folderContents[path] = data.items;

        this.updatePathDisplay(path, data.realPath);
        this.renderFileList();
        return data.items;
    },

    renderFileList() {
        const container = document.getElementById('static-file-list');
        const items = this.folderContents[this.currentPath] || [];

        if (items.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No files found</div>';
            return;
        }

        let html = '';

        if (this.currentPath) {
            html += `
                <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; color: #888;"
                     onclick="StaticResourceBrowser.navigateUp()">
                    <span style="margin-right: 8px;">⬆️</span>
                    <span>..</span>
                </div>
            `;
        }

        html += this.renderItems(items, 0);
        container.innerHTML = html;
    },

    renderItems(items, depth) {
        let html = '';
        const indent = depth * 20;

        items.forEach(item => {
            if (item.type === 'directory') {
                const isExpanded = this.expandedFolders.has(item.path);
                const arrow = isExpanded ? '▼' : '▶';
                const icon = isExpanded ? '📂' : '📁';

                html += `
                    <div style="padding: 8px 12px; padding-left: ${12 + indent}px; cursor: pointer; border-bottom: 1px solid #333; user-select: none;"
                         ondblclick="StaticResourceBrowser.navigateToFolder('${item.path.replace(/'/g, "\\'")}')"
                         oncontextmenu="StaticResourceBrowser.showContextMenu(event, '${item.path.replace(/'/g, "\\'")}', 'directory')">
                        <div style="display: flex; align-items: center; color: #dcdcaa;">
                            <span style="margin-right: 4px; font-size: 10px; width: 12px; display: inline-block;"
                                  onclick="event.stopPropagation(); StaticResourceBrowser.toggleFolder('${item.path.replace(/'/g, "\\'")}', false)">${arrow}</span>
                            <span style="margin-right: 8px;">${icon}</span>
                            <span style="font-weight: 500;" onclick="StaticResourceBrowser.toggleFolder('${item.path.replace(/'/g, "\\'")}', false)">${item.name}</span>
                        </div>
                    </div>
                `;

                if (isExpanded && this.folderContents[item.path]) {
                    html += this.renderItems(this.folderContents[item.path], depth + 1);
                }
            } else {
                const icon = this.getFileIcon(item.mimeType, item.extension);
                const size = this.formatFileSize(item.size);
                html += `
                    <div style="padding: 8px 12px; padding-left: ${12 + indent + 16}px; cursor: pointer; border-bottom: 1px solid #333; user-select: none;"
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

        return html;
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

    async toggleFolder(path, navigate = true) {
        if (navigate) {
            this.currentPath = path;
            this.updatePathDisplay(path);
        }

        if (this.expandedFolders.has(path)) {
            this.expandedFolders.delete(path);
            this.saveExpandedState();
            this.renderFileList();
        } else {
            this.expandedFolders.add(path);
            this.saveExpandedState();

            if (!this.folderContents[path]) {
                const response = await fetch(`/static-resources/file-tree?path=${encodeURIComponent(path)}`);
                const data = await response.json();

                if (!data.error) {
                    this.folderContents[path] = data.items;
                }
            }

            this.renderFileList();
        }
    },

    updatePathDisplay(path, realPath = null) {
        const pathDisplay = document.getElementById('static-resources-path-display');
        const relativePath = path || '/';

        if (realPath) {
            pathDisplay.innerHTML = `
                <div style="line-height: 1.6;">
                    <div><strong>Real Path:</strong> ${realPath}</div>
                    <div style="color: #888; font-size: 11px;"><strong>Relative:</strong> ${relativePath}</div>
                </div>
            `;
        } else {
            pathDisplay.innerHTML = `
                <div style="line-height: 1.6;">
                    <div><strong>Current Path:</strong> ${relativePath}</div>
                </div>
            `;
        }
    },

    navigateUp() {
        const parts = this.currentPath.split('/').filter(p => p);
        parts.pop();
        const parentPath = parts.join('/');
        this.loadFileList(parentPath);
    },

    navigateToFolder(path) {
        this.loadFileList(path);
    },

    async expandAllFolders(path) {
        if (!this.folderContents[path]) {
            const response = await fetch(`/static-resources/file-tree?path=${encodeURIComponent(path)}`);
            const data = await response.json();
            if (!data.error) {
                this.folderContents[path] = data.items;
            }
        }

        this.expandedFolders.add(path);

        const items = this.folderContents[path] || [];
        for (const item of items) {
            if (item.type === 'directory') {
                await this.expandAllFolders(item.path);
            }
        }

        this.saveExpandedState();
        this.renderFileList();
    },

    collapseAllFolders(path) {
        this.expandedFolders.delete(path);

        const items = this.folderContents[path] || [];
        for (const item of items) {
            if (item.type === 'directory') {
                this.collapseAllFolders(item.path);
            }
        }

        this.saveExpandedState();
        this.renderFileList();
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
        const navigateToMenu = document.getElementById('static-menu-navigate-to');
        const expandAllMenu = document.getElementById('static-menu-expand-all');
        const collapseAllMenu = document.getElementById('static-menu-collapse-all');
        const uploadToMenu = document.getElementById('static-menu-upload-to');

        if (type === 'directory') {
            navigateToMenu.style.display = 'block';
            expandAllMenu.style.display = 'block';
            collapseAllMenu.style.display = 'block';
            uploadToMenu.style.display = 'block';
        } else {
            navigateToMenu.style.display = 'none';
            expandAllMenu.style.display = 'none';
            collapseAllMenu.style.display = 'none';
            uploadToMenu.style.display = 'none';
        }

        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        menu.style.display = 'block';
    },

    navigateToFolderFromMenu() {
        const menu = document.getElementById('static-context-menu');
        menu.style.display = 'none';

        if (!this.selectedItem || this.selectedItemType !== 'directory') return;

        this.navigateToFolder(this.selectedItem);
    },

    async expandAllFromMenu() {
        const menu = document.getElementById('static-context-menu');
        menu.style.display = 'none';

        if (!this.selectedItem || this.selectedItemType !== 'directory') return;

        await this.expandAllFolders(this.selectedItem);
    },

    collapseAllFromMenu() {
        const menu = document.getElementById('static-context-menu');
        menu.style.display = 'none';

        if (!this.selectedItem || this.selectedItemType !== 'directory') return;

        this.collapseAllFolders(this.selectedItem);
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

    executeUpload() {
        if (this.uploadFiles.length === 0) return;

        const uploadBtn = document.getElementById('upload-btn');
        const uploadFileList = document.getElementById('upload-file-list');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const formData = new FormData();
        let totalSize = 0;

        this.uploadFiles.forEach((item, index) => {
            const file = item.file || item;
            const relativePath = item.fullPath || file.webkitRelativePath || file.name;

            totalSize += file.size;
            formData.append('files[]', file);
            formData.append(`file_paths[${index}]`, relativePath);

            console.log(`[StaticResourceBrowser] File ${index}:`, {
                name: file.name,
                size: file.size,
                type: file.type,
                relativePath: relativePath
            });
        });
        formData.append('target_path', this.uploadTargetPath);

        console.log('[StaticResourceBrowser] Upload details:', {
            fileCount: this.uploadFiles.length,
            totalSize: totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
            targetPath: this.uploadTargetPath
        });

        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = 'margin-top: 15px; padding: 15px; background: #2a2d2e; border-radius: 4px;';
        progressDiv.innerHTML = `
            <div style="margin-bottom: 8px; color: #cccccc; font-size: 13px;">
                <span id="upload-progress-text">Preparing upload...</span>
            </div>
            <div style="width: 100%; height: 24px; background: #1e1e1e; border-radius: 4px; overflow: hidden; border: 1px solid #454545;">
                <div id="upload-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #0e639c, #1e7bbf); transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;"></div>
            </div>
            <div style="margin-top: 8px; color: #888; font-size: 11px;">
                <span id="upload-speed-text"></span>
            </div>
        `;
        uploadFileList.appendChild(progressDiv);

        const progressBar = document.getElementById('upload-progress-bar');
        const progressText = document.getElementById('upload-progress-text');
        const speedText = document.getElementById('upload-speed-text');

        console.log('[StaticResourceBrowser] Starting upload request...');

        const xhr = new XMLHttpRequest();
        const startTime = Date.now();
        let lastLoaded = 0;
        let lastTime = startTime;

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                const loadedMB = (e.loaded / 1024 / 1024).toFixed(2);
                const totalMB = (e.total / 1024 / 1024).toFixed(2);

                progressBar.style.width = percentComplete.toFixed(1) + '%';
                progressBar.textContent = percentComplete.toFixed(1) + '%';
                progressText.textContent = `Uploading: ${loadedMB} MB / ${totalMB} MB`;

                const currentTime = Date.now();
                const timeDiff = (currentTime - lastTime) / 1000;
                if (timeDiff > 0.5) {
                    const bytesDiff = e.loaded - lastLoaded;
                    const speedMBps = (bytesDiff / 1024 / 1024) / timeDiff;
                    const remainingBytes = e.total - e.loaded;
                    const remainingSeconds = remainingBytes / (bytesDiff / timeDiff);
                    const remainingMinutes = Math.floor(remainingSeconds / 60);
                    const remainingSecondsDisplay = Math.floor(remainingSeconds % 60);

                    speedText.textContent = `Speed: ${speedMBps.toFixed(2)} MB/s | Remaining: ${remainingMinutes}m ${remainingSecondsDisplay}s`;

                    lastLoaded = e.loaded;
                    lastTime = currentTime;
                }

                console.log(`[StaticResourceBrowser] Upload progress: ${percentComplete.toFixed(1)}% (${loadedMB}/${totalMB} MB)`);
            }
        });

        xhr.addEventListener('load', () => {
            console.log('[StaticResourceBrowser] Upload response received:', {
                status: xhr.status,
                statusText: xhr.statusText,
                headers: xhr.getAllResponseHeaders()
            });

            let result;
            try {
                result = JSON.parse(xhr.responseText);
                console.log('[StaticResourceBrowser] Upload result:', result);
            } catch (e) {
                console.error('[StaticResourceBrowser] Failed to parse response:', xhr.responseText);
                alert('Upload failed: Invalid server response');
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload';
                progressDiv.remove();
                return;
            }

            if (xhr.status === 200 && result.success) {
                const elapsedSeconds = (Date.now() - startTime) / 1000;
                const elapsedMinutes = Math.floor(elapsedSeconds / 60);
                const elapsedSecondsDisplay = Math.floor(elapsedSeconds % 60);

                progressBar.style.background = 'linear-gradient(90deg, #28a745, #34d058)';
                progressText.textContent = `Upload completed in ${elapsedMinutes}m ${elapsedSecondsDisplay}s`;
                speedText.textContent = `Successfully uploaded ${result.uploaded_count} file(s)`;

                setTimeout(() => {
                    alert(`Successfully uploaded ${result.uploaded_count} file(s)!`);
                    this.closeUploadDialog();
                    this.refreshList();
                }, 1000);
            } else {
                progressBar.style.background = '#dc3545';
                progressText.textContent = 'Upload failed';
                speedText.textContent = result.error || 'Unknown error';
                alert('Upload failed: ' + (result.error || JSON.stringify(result) || 'Unknown error'));
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload';
            }
        });

        xhr.addEventListener('error', () => {
            console.error('[StaticResourceBrowser] Upload network error');
            progressBar.style.background = '#dc3545';
            progressText.textContent = 'Network error';
            speedText.textContent = 'Connection lost';
            alert('Upload failed: Network error');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        });

        xhr.addEventListener('timeout', () => {
            console.error('[StaticResourceBrowser] Upload timeout');
            progressBar.style.background = '#dc3545';
            progressText.textContent = 'Upload timeout';
            speedText.textContent = 'Request timed out after 10 hours';
            alert('Upload failed: Request timed out (10 hours)');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        });

        xhr.open('POST', '/static-resources/upload');
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.timeout = 10 * 60 * 60 * 1000;

        xhr.send(formData);
    },

    async refreshList() {
        this.folderContents = {};
        await this.loadFileList(this.currentPath);
        await this.loadExpandedFolders();
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
            const response = await fetch('/translation/simple/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    'X-Translation-Passcode': '12345678'
                },
                body: JSON.stringify({
                    text: dirName,
                    target_language: 'en'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                alert(`Translation failed: ${response.status} - ${JSON.stringify(errorData)}`);
                createBtn.disabled = false;
                createBtn.textContent = 'Create';
                return;
            }

            const data = await response.json();
            finalName = data.translated_text || dirName;
            console.log('[StaticResourceBrowser] Translated:', dirName, '=>', finalName);

            finalName = finalName.replace(/\s+/g, '_');
            finalName = finalName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            finalName = finalName.replace(/_+/g, '_');
            finalName = finalName.replace(/^_+|_+$/g, '');

            if (!finalName) {
                alert('Translation result is empty');
                createBtn.disabled = false;
                createBtn.textContent = 'Create';
                return;
            }
        }

        const response = await fetch('/static-resources/create-directory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({
                parent_path: this.currentPath,
                dir_name: finalName
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            alert('Folder created successfully!');
            this.closeCreateDirDialog();
            this.refreshList();
        } else {
            alert('Failed to create folder: ' + (result.error || 'Unknown error'));
            createBtn.disabled = false;
            createBtn.textContent = 'Create';
        }
    },

    async executeChunkedUpload(file, relativePath, progressCallback) {
        const fileId = `${file.name}_${file.size}_${file.lastModified}`;
        let uploadState = this.loadUploadState(fileId);

        let uploadId = uploadState?.upload_id;
        let uploadedChunks = uploadState?.uploaded_chunks || [];
        const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
        let needReinit = false;

        if (!uploadId) {
            needReinit = true;
        }

        if (needReinit) {
            this.clearUploadState(fileId);

            const initResponse = await fetch('/static-resources/chunked-upload/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    file_name: relativePath,
                    file_size: file.size,
                    chunk_size: this.CHUNK_SIZE,
                    target_path: this.uploadTargetPath,
                    file_hash: fileId
                })
            });

            if (!initResponse.ok) {
                throw new Error('Failed to initialize upload');
            }

            const initData = await initResponse.json();
            uploadId = initData.upload_id;
            uploadedChunks = [];

            this.saveUploadState(fileId, {
                upload_id: uploadId,
                file_name: file.name,
                file_size: file.size,
                relative_path: relativePath,
                uploaded_chunks: [],
                total_chunks: totalChunks
            });
        }

        const uploadInfo = {
            uploadId,
            file,
            fileId,
            totalChunks,
            uploadedChunks: new Set(uploadedChunks),
            retryCount: 0,
            maxRetries: 3
        };

        this.activeUploads.set(fileId, uploadInfo);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            if (uploadInfo.uploadedChunks.has(chunkIndex)) {
                progressCallback(chunkIndex + 1, totalChunks, file.name);
                continue;
            }

            let success = false;
            let retries = 0;

            while (!success && retries < uploadInfo.maxRetries) {
                try {
                    const start = chunkIndex * this.CHUNK_SIZE;
                    const end = Math.min(start + this.CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    const formData = new FormData();
                    formData.append('upload_id', uploadId);
                    formData.append('chunk_index', chunkIndex);
                    formData.append('chunk', chunk);

                    const chunkResponse = await fetch('/static-resources/chunked-upload/chunk', {
                        method: 'POST',
                        headers: {
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                            'Accept': 'application/json'
                        },
                        body: formData
                    });

                    if (chunkResponse.status === 404) {
                        const errorData = await chunkResponse.json();
                        if (errorData.error && errorData.error.includes('Upload session not found')) {
                            console.log('[StaticResourceBrowser] Upload session not found, reinitializing...');
                            this.clearUploadState(fileId);
                            return await this.executeChunkedUpload(file, relativePath, progressCallback);
                        }
                    }

                    if (!chunkResponse.ok) {
                        throw new Error(`Chunk ${chunkIndex} upload failed`);
                    }

                    uploadInfo.uploadedChunks.add(chunkIndex);
                    uploadedChunks.push(chunkIndex);

                    this.saveUploadState(fileId, {
                        upload_id: uploadId,
                        file_name: file.name,
                        file_size: file.size,
                        relative_path: relativePath,
                        uploaded_chunks: uploadedChunks,
                        total_chunks: totalChunks
                    });

                    progressCallback(chunkIndex + 1, totalChunks, file.name);
                    success = true;

                } catch (error) {
                    retries++;
                    console.error(`[StaticResourceBrowser] Chunk ${chunkIndex} upload failed (attempt ${retries}):`, error);

                    if (retries < uploadInfo.maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
                    } else {
                        throw new Error(`Failed to upload chunk ${chunkIndex} after ${uploadInfo.maxRetries} attempts`);
                    }
                }
            }
        }

        const mergeResponse = await fetch('/static-resources/chunked-upload/merge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ upload_id: uploadId })
        });

        if (mergeResponse.status === 404) {
            const errorData = await mergeResponse.json();
            if (errorData.error && errorData.error.includes('Upload session not found')) {
                console.log('[StaticResourceBrowser] Upload session not found during merge, reinitializing...');
                this.clearUploadState(fileId);
                this.activeUploads.delete(fileId);
                return await this.executeChunkedUpload(file, relativePath, progressCallback);
            }
        }

        if (!mergeResponse.ok) {
            const errorData = await mergeResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to merge chunks');
        }

        this.clearUploadState(fileId);
        this.activeUploads.delete(fileId);

        return await mergeResponse.json();
    },

    saveUploadState(fileId, state) {
        const allStates = JSON.parse(localStorage.getItem('chunked_uploads') || '{}');
        allStates[fileId] = {
            ...state,
            last_updated: Date.now()
        };
        localStorage.setItem('chunked_uploads', JSON.stringify(allStates));
    },

    loadUploadState(fileId) {
        const allStates = JSON.parse(localStorage.getItem('chunked_uploads') || '{}');
        const state = allStates[fileId];

        if (state) {
            const ageHours = (Date.now() - state.last_updated) / (1000 * 60 * 60);
            if (ageHours > 24) {
                delete allStates[fileId];
                localStorage.setItem('chunked_uploads', JSON.stringify(allStates));
                return null;
            }
        }

        return state;
    },

    clearUploadState(fileId) {
        const allStates = JSON.parse(localStorage.getItem('chunked_uploads') || '{}');
        delete allStates[fileId];
        localStorage.setItem('chunked_uploads', JSON.stringify(allStates));
    },

    async executeUploadWithChunking() {
        if (this.uploadFiles.length === 0) return;

        const uploadBtn = document.getElementById('upload-btn');
        const uploadFileList = document.getElementById('upload-file-list');
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        const progressDiv = document.createElement('div');
        progressDiv.id = 'chunked-upload-progress';
        progressDiv.style.cssText = 'margin-top: 15px; padding: 15px; background: #2a2d2e; border-radius: 4px;';
        uploadFileList.appendChild(progressDiv);

        let completedFiles = 0;
        const totalFiles = this.uploadFiles.length;
        const startTime = Date.now();

        const updateOverallProgress = () => {
            const percent = (completedFiles / totalFiles * 100).toFixed(1);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;

            progressDiv.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <div style="color: #cccccc; font-size: 14px; margin-bottom: 8px;">
                        Overall Progress: ${completedFiles} / ${totalFiles} files (${percent}%)
                    </div>
                    <div style="width: 100%; height: 24px; background: #1e1e1e; border-radius: 4px; overflow: hidden; border: 1px solid #454545;">
                        <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #0e639c, #1e7bbf); transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">${percent}%</div>
                    </div>
                    <div style="color: #888; font-size: 11px; margin-top: 4px;">
                        Elapsed: ${minutes}m ${seconds}s
                    </div>
                </div>
                <div id="current-file-status" style="color: #888; font-size: 12px; margin-top: 8px;"></div>
            `;
        };

        updateOverallProgress();

        try {
            for (let i = 0; i < this.uploadFiles.length; i++) {
                const item = this.uploadFiles[i];
                const file = item.file || item;
                const relativePath = item.fullPath || file.webkitRelativePath || file.name;

                const statusDiv = document.getElementById('current-file-status');

                await this.executeChunkedUpload(file, relativePath, (uploadedChunks, totalChunks, fileName) => {
                    const filePercent = (uploadedChunks / totalChunks * 100).toFixed(1);
                    statusDiv.innerHTML = `
                        <div style="padding: 8px; background: #1e1e1e; border-radius: 3px; border-left: 3px solid #0e639c;">
                            <div style="color: #cccccc; margin-bottom: 4px;">${fileName}</div>
                            <div style="color: #888; font-size: 11px;">
                                Chunks: ${uploadedChunks} / ${totalChunks} (${filePercent}%)
                            </div>
                        </div>
                    `;
                });

                completedFiles++;
                updateOverallProgress();
            }

            progressDiv.querySelector('div > div > div').style.background = 'linear-gradient(90deg, #28a745, #34d058)';

            setTimeout(() => {
                alert(`Successfully uploaded ${totalFiles} file(s)!`);
                this.closeUploadDialog();
                this.refreshList();
            }, 1000);

        } catch (error) {
            console.error('[StaticResourceBrowser] Chunked upload error:', error);
            alert('Upload failed: ' + error.message + '\n\nThe upload state has been saved. You can retry to resume from where it stopped.');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }
    }
};
