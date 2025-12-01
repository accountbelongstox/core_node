// Code Browser Module
const CodeBrowser = {
    currentPath: '',
    currentFile: null,
    contextMenuTarget: null,
    contextMenuTargetType: null,
    isModified: false,
    expandedFolders: new Set(),
    confirmCallback: null,
    baseDirectory: null,
    skipCacheDirectories: [
        'node_modules', 'vendor', '.git', '__pycache__',
        '.vite', '.nuxt', '.next', 'dist', 'build',
        '.dart_tool', '.flutter-plugins', '.gradle',
        'target', 'out', '.cache', '.parcel-cache',
        '.turbo', '.svelte-kit', '.astro'
    ],

    async loadCsrfToken() {
        await APIClient.initCsrfToken();
    },

    async init() {
        await this.loadCsrfToken();
        
        const authCheckEl = document.getElementById('code-browser-auth-check');
        const contentEl = document.getElementById('code-browser-content');
        
        if (!authCheckEl || !contentEl) {
            console.warn('Code browser elements not found, section may not be loaded yet');
            return;
        }
        
        const authResult = await this.checkAuth();
        if (!authResult.authenticated) {
            authCheckEl.style.display = 'block';
            contentEl.style.display = 'none';
            return;
        }

        authCheckEl.style.display = 'none';
        contentEl.style.display = 'block';

        if (authResult.base_directory) {
            this.baseDirectory = authResult.base_directory;
            const pathDisplay = document.getElementById('code-browser-path-display');
            const existsStatus = authResult.base_directory_exists ? '✅ Exists' : '❌ Not Found';
            pathDisplay.innerHTML = `📂 Mapped Directory: <strong>${authResult.base_directory}</strong> ${existsStatus}`;
            pathDisplay.style.color = authResult.base_directory_exists ? '#28a745' : '#dc3545';
        }

        this.loadExpandedState();
        this.loadFileTree('');
        this.setupContextMenu();
        this.setupEditorEvents();
    },

    async checkAuth() {
        try {
            const userToken = localStorage.getItem('user_token');
            const headers = userToken ? { 'Auth-User-Token': userToken } : {};

            const response = await APIClient.get('/code-browser/auth-check', { headers });
            return await response.json();
        } catch (error) {
            console.error('Auth check failed:', error);
            return { authenticated: false };
        }
    },

    async loadFileTree(path) {
        try {
            const response = await APIClient.get(`/code-browser/file-tree?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (data.error) {
                console.error('Error loading file tree:', data.error);
                return;
            }

            this.renderFileTree(data.items, path);
        } catch (error) {
            console.error('Failed to load file tree:', error);
        }
    },

    renderFileTree(items, basePath) {
        const treeContainer = document.getElementById('file-tree');
        if (basePath === '') treeContainer.innerHTML = '';

        const depth = basePath === '' ? 0 : this.getDepth(basePath) + 1;

        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const itemDiv = document.createElement('div');

            const indent = '    '.repeat(depth);
            const branch = isLast ? '└── ' : '├── ';
            const prefix = depth > 0 ? indent + branch : '';

            itemDiv.style.cursor = 'pointer';
            itemDiv.style.padding = '2px 8px';
            itemDiv.style.userSelect = 'none';
            itemDiv.style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
            itemDiv.style.fontSize = '13px';
            itemDiv.style.lineHeight = '20px';
            itemDiv.style.whiteSpace = 'pre';

            itemDiv.addEventListener('mouseover', () => itemDiv.style.background = '#2a2d2e');
            itemDiv.addEventListener('mouseout', () => itemDiv.style.background = 'transparent');

            if (item.type === 'directory') {
                const isExpanded = this.expandedFolders.has(item.path);
                const icon = isExpanded ? '📂' : '📁';
                itemDiv.innerHTML = `${prefix}${icon} <span style="color: #75beff;">${item.name}/</span>`;

                itemDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleFolder(item.path, itemDiv);
                });

                itemDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.contextMenuTarget = item.path;
                    this.contextMenuTargetType = 'directory';
                    this.showContextMenu(e.clientX, e.clientY);
                });
            } else {
                const icon = this.getFileIcon(item.extension);
                itemDiv.innerHTML = `${prefix}${icon} <span style="color: #cccccc;">${item.name}</span>`;

                itemDiv.addEventListener('click', () => {
                    if (item.editable) this.loadFile(item.path);
                    else alert('This file type cannot be edited');
                });

                itemDiv.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.contextMenuTarget = item.path;
                    this.contextMenuTargetType = 'file';
                    this.showContextMenu(e.clientX, e.clientY);
                });
            }

            if (basePath === '') {
                treeContainer.appendChild(itemDiv);
            } else {
                const parentFolder = document.querySelector(`[data-folder="${basePath}"]`);
                if (parentFolder) parentFolder.appendChild(itemDiv);
            }
        });
    },

    async toggleFolder(path, folderElement) {
        const isExpanded = this.expandedFolders.has(path);

        const nameSpan = folderElement.querySelector('span');
        const folderName = nameSpan ? nameSpan.textContent.replace('/', '') : '';
        const currentHTML = folderElement.innerHTML;
        const prefixMatch = currentHTML.match(/^([\s├└─│]*)/);
        const prefix = prefixMatch ? prefixMatch[1] : '';

        if (isExpanded) {
            this.expandedFolders.delete(path);
            folderElement.innerHTML = `${prefix}📁 <span style="color: #75beff;">${folderName}/</span>`;

            const childrenContainer = document.querySelector(`[data-folder="${path}"]`);
            if (childrenContainer) childrenContainer.remove();
        } else {
            this.expandedFolders.add(path);
            folderElement.innerHTML = `${prefix}📂 <span style="color: #75beff;">${folderName}/</span>`;

            const childrenContainer = document.createElement('div');
            childrenContainer.setAttribute('data-folder', path);
            folderElement.parentElement.insertBefore(childrenContainer, folderElement.nextSibling);

            await this.loadFolderContents(path, childrenContainer);
        }

        this.saveExpandedState();
    },

    async loadFolderContents(path, container) {
        try {
            const response = await APIClient.get(`/code-browser/file-tree?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (data.error) {
                console.error('Error loading folder contents:', data.error);
                return;
            }

            const depth = this.getDepth(path) + 1;

            data.items.forEach((item, index) => {
                const isLast = index === data.items.length - 1;
                const itemDiv = document.createElement('div');

                const indent = '    '.repeat(depth);
                const branch = isLast ? '└── ' : '├── ';
                const prefix = depth > 0 ? indent + branch : '';

                itemDiv.style.cursor = 'pointer';
                itemDiv.style.padding = '2px 8px';
                itemDiv.style.userSelect = 'none';
                itemDiv.style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
                itemDiv.style.fontSize = '13px';
                itemDiv.style.lineHeight = '20px';
                itemDiv.style.whiteSpace = 'pre';

                itemDiv.addEventListener('mouseover', () => itemDiv.style.background = '#2a2d2e');
                itemDiv.addEventListener('mouseout', () => itemDiv.style.background = 'transparent');

                if (item.type === 'directory') {
                    const icon = '📁';
                    itemDiv.innerHTML = `${prefix}${icon} <span style="color: #75beff;">${item.name}/</span>`;

                    itemDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleFolder(item.path, itemDiv);
                    });

                    itemDiv.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        this.contextMenuTarget = item.path;
                        this.contextMenuTargetType = 'directory';
                        this.showContextMenu(e.clientX, e.clientY);
                    });
                } else {
                    const icon = this.getFileIcon(item.extension);
                    itemDiv.innerHTML = `${prefix}${icon} <span style="color: #cccccc;">${item.name}</span>`;

                    itemDiv.addEventListener('click', () => {
                        if (item.editable) this.loadFile(item.path);
                        else alert('This file type cannot be edited');
                    });

                    itemDiv.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        this.contextMenuTarget = item.path;
                        this.contextMenuTargetType = 'file';
                        this.showContextMenu(e.clientX, e.clientY);
                    });
                }

                container.appendChild(itemDiv);
            });
        } catch (error) {
            console.error('Failed to load folder contents:', error);
        }
    },

    getDepth(path) {
        if (!path) return 0;
        return path.split('/').length - 1;
    },

    getFileIcon(extension) {
        const icons = {
            'php': '🐘', 'js': '📜', 'py': '🔷', 'html': '🌐',
            'css': '🎨', 'json': '📋', 'md': '📝', 'txt': '📄',
            'yaml': '⚙️', 'yml': '⚙️', 'xml': '📰', 'sh': '💻', 'sql': '🗄️'
        };
        return icons[extension] || '📄';
    },

    async loadFile(path) {
        if (this.isModified && !confirm('You have unsaved changes. Do you want to discard them?')) return;

        try {
            const response = await APIClient.get(`/code-browser/read-file?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (data.error) {
                console.error('Error loading file:', data.error);
                return;
            }

            this.currentFile = {
                path: data.path,
                content: data.content,
                extension: data.extension
            };

            document.getElementById('code-editor').value = data.content;
            document.getElementById('code-editor').readOnly = false;
            document.getElementById('current-file-path').textContent = data.path;
            document.getElementById('file-status').textContent = `${(data.size / 1024).toFixed(2)} KB - Modified: ${data.modified}`;
            document.getElementById('save-file-btn').style.display = 'inline-block';
            document.getElementById('close-file-btn').disabled = false;

            this.isModified = false;
        } catch (error) {
            console.error('Failed to load file:', error);
        }
    },

    async saveFile() {
        if (!this.currentFile) {
            alert('No file is currently open');
            return;
        }

        try {
            const content = document.getElementById('code-editor').value;

            const response = await APIClient.post('/code-browser/save-file', {
                path: this.currentFile.path,
                content: content
            });

            const data = await response.json();
            if (data.error) {
                console.error('Error saving file:', data.error);
                return;
            }

            this.isModified = false;
            document.getElementById('file-status').textContent = `Saved successfully - Backup: ${data.backup}`;
            setTimeout(() => this.loadFile(this.currentFile.path), 1000);
        } catch (error) {
            console.error('Failed to save file:', error);
        }
    },

    closeFile() {
        if (this.isModified && !confirm('You have unsaved changes. Do you want to discard them?')) return;

        this.currentFile = null;
        this.isModified = false;
        document.getElementById('code-editor').value = '';
        document.getElementById('code-editor').readOnly = true;
        document.getElementById('current-file-path').textContent = 'No file selected';
        document.getElementById('file-status').textContent = '';
        document.getElementById('save-file-btn').style.display = 'none';
        document.getElementById('close-file-btn').disabled = true;
    },

    refreshTree() {
        const treeContainer = document.getElementById('file-tree');
        treeContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Loading...</div>';
        this.loadFileTree('');
    },

    setupEditorEvents() {
        const editor = document.getElementById('code-editor');
        editor.addEventListener('input', () => {
            this.isModified = true;
            document.getElementById('file-status').textContent = '● Modified (unsaved)';
        });

        editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            }
        });
    },

    setupContextMenu() {
        document.addEventListener('click', () => {
            document.getElementById('file-context-menu').style.display = 'none';
        });
    },

    showContextMenu(x, y) {
        const menu = document.getElementById('file-context-menu');
        const menuDelete = document.getElementById('menu-delete');
        const menuRestore = document.getElementById('menu-restore');
        const menuRename = document.getElementById('menu-rename');
        const menuCopyPath = document.getElementById('menu-copy-path');
        const menuCopyAbsPath = document.getElementById('menu-copy-abspath');

        const isInDelete = this.contextMenuTarget && this.contextMenuTarget.startsWith('_delete/');
        const isSpecialFolder = this.contextMenuTarget === '_delete' || this.contextMenuTarget === '_prompts';
        const canRename = !isSpecialFolder && this.contextMenuTarget && this.contextMenuTargetType;

        if (this.contextMenuTargetType === 'file') {
            if (isInDelete) {
                menuDelete.style.display = 'none';
                menuRestore.style.display = 'block';
            } else {
                menuDelete.style.display = 'block';
                menuRestore.style.display = 'none';
            }
        } else {
            menuDelete.style.display = 'none';
            menuRestore.style.display = 'none';
        }

        menuRename.style.display = canRename ? 'block' : 'none';
        menuCopyPath.style.display = this.contextMenuTarget ? 'block' : 'none';
        menuCopyAbsPath.style.display = this.contextMenuTarget ? 'block' : 'none';

        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    },

    copyRelativePath() {
        if (this.contextMenuTarget) {
            navigator.clipboard.writeText(this.contextMenuTarget).then(() => {
                console.log('Relative path copied: ' + this.contextMenuTarget);
            });
        }
        document.getElementById('file-context-menu').style.display = 'none';
    },

    copyAbsolutePath() {
        if (this.contextMenuTarget && this.baseDirectory) {
            const separator = this.baseDirectory.endsWith('/') ? '' : '/';
            const absolutePath = this.baseDirectory + separator + this.contextMenuTarget;
            navigator.clipboard.writeText(absolutePath).then(() => {
                console.log('Absolute path copied: ' + absolutePath);
            });
        }
        document.getElementById('file-context-menu').style.display = 'none';
    },

    async deleteFile() {
        if (!this.contextMenuTarget) return;
        document.getElementById('file-context-menu').style.display = 'none';

        this.showConfirmDialog(
            'Delete File',
            `Are you sure you want to move this file to _delete directory?\n\n${this.contextMenuTarget}`,
            async () => {
                const response = await APIClient.post('/code-browser/delete-file', { path: this.contextMenuTarget });
                const data = await response.json();

                if (data.error) {
                    const errorDetails = data.details ? `\n\nDetails: ${data.details}\nSource: ${data.source}\nTarget: ${data.target}` : '';
                    alert('Error: ' + data.error + errorDetails);
                    console.error('Delete file error:', data);
                    return;
                }

                console.log('File deleted successfully');
                this.refreshTree();
            }
        );
    },

    restoreFile() {
        if (!this.contextMenuTarget) return;
        document.getElementById('file-context-menu').style.display = 'none';

        this.showConfirmDialog(
            'Restore File',
            `Are you sure you want to restore this file?\n\n${this.contextMenuTarget}`,
            async () => {
                try {
                    const response = await APIClient.post('/code-browser/restore-file', { path: this.contextMenuTarget });

                    const data = await response.json();
                    if (data.error) {
                        if (data.exists) {
                            alert('File already exists at target location and will not be overwritten.');
                        } else {
                            alert('Error: ' + data.error);
                        }
                        return;
                    }

                    console.log('File restored successfully');
                    this.refreshTree();
                } catch (error) {
                    console.error('Failed to restore file:', error);
                }
            }
        );
    },

    renameItem() {
        if (!this.contextMenuTarget) return;
        document.getElementById('file-context-menu').style.display = 'none';

        const currentName = this.contextMenuTarget.split('/').pop();
        document.getElementById('rename-input').value = currentName;
        document.getElementById('rename-dialog').style.display = 'flex';
        document.getElementById('rename-input').focus();
        document.getElementById('rename-input').select();
    },

    async executeRename() {
        const newName = document.getElementById('rename-input').value.trim();
        if (!newName) return;

        try {
            const response = await APIClient.post('/code-browser/rename-item', {
                path: this.contextMenuTarget,
                new_name: newName
            });

            const data = await response.json();
            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            console.log('Item renamed successfully');
            this.closeRenameDialog();
            this.refreshTree();
        } catch (error) {
            console.error('Failed to rename item:', error);
        }
    },

    closeRenameDialog() {
        document.getElementById('rename-dialog').style.display = 'none';
        document.getElementById('rename-input').value = '';
    },

    async autoRenameToEnglish() {
        if (!this.contextMenuTarget) return;
        document.getElementById('file-context-menu').style.display = 'none';

        try {
            const response = await APIClient.post('/code-browser/auto-rename-to-english', {
                path: this.contextMenuTarget
            });

            const data = await response.json();

            if (!data.success) {
                alert(data.error || 'Failed to auto-rename file');
                return;
            }

            if (data.renamed) {
                console.log(`File auto-renamed: ${data.original_name} → ${data.translated_name}`);
                alert(`Successfully renamed:\n${data.original_name}\n→\n${data.translated_name}`);
            } else {
                alert(data.message || 'Filename already in English');
            }

            this.refreshTree();
        } catch (error) {
            console.error('Failed to auto-rename file:', error);
            alert('Failed to auto-rename file');
        }
    },

    showConfirmDialog(title, message, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        this.confirmCallback = callback;
        document.getElementById('confirm-dialog').style.display = 'flex';
    },

    confirmDialogOk() {
        if (this.confirmCallback) {
            this.confirmCallback();
            this.confirmCallback = null;
        }
        this.closeConfirmDialog();
    },

    closeConfirmDialog() {
        document.getElementById('confirm-dialog').style.display = 'none';
        this.confirmCallback = null;
    },

    async translateChineseLines() {
        if (!this.contextMenuTarget || this.contextMenuTargetType !== 'file') return;
        document.getElementById('file-context-menu').style.display = 'none';

        try {
            const response = await APIClient.get(`/code-browser/read-file?path=${encodeURIComponent(this.contextMenuTarget)}`);
            const data = await response.json();

            if (data.error) {
                alert('Error reading file: ' + data.error);
                return;
            }

            const lines = data.content.split('\n');
            const translatedLines = [];
            let hasChanges = false;
            let translatedCount = 0;

            console.log(`[CodeBrowser] Translating file line-by-line: ${this.contextMenuTarget}`);
            document.getElementById('file-status').textContent = 'Translating Chinese lines...';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (!/[\u4e00-\u9fa5]/.test(line)) {
                    translatedLines.push(line);
                    continue;
                }

                console.log(`[CodeBrowser] Translating line ${i + 1}/${lines.length}`);
                document.getElementById('file-status').textContent = `Translating line ${i + 1}/${lines.length}...`;

                try {
                    const translateResponse = await APIClient.post('/code-browser/prompts/translate-line', {
                        line: line
                    });

                    const translateData = await translateResponse.json();

                    if (translateData.error) {
                        console.error(`[CodeBrowser] Translation error for line ${i + 1}:`, translateData.error);
                        translatedLines.push(line);
                        continue;
                    }

                    if (translateData.success && translateData.translated) {
                        if (translateData.translated !== line) {
                            console.log(`[CodeBrowser] ✓ Line ${i + 1} translated`);
                            translatedLines.push(translateData.translated);
                            hasChanges = true;
                            translatedCount++;
                        } else {
                            translatedLines.push(line);
                        }
                    } else {
                        translatedLines.push(line);
                    }
                } catch (error) {
                    console.error(`[CodeBrowser] Failed to translate line ${i + 1}:`, error);
                    translatedLines.push(line);
                }
            }

            if (hasChanges) {
                const newContent = translatedLines.join('\n');
                console.log(`[CodeBrowser] Translation complete. ${translatedCount} lines translated. Saving file...`);
                document.getElementById('file-status').textContent = 'Saving translated content...';

                const saveResponse = await APIClient.post('/code-browser/save-file', {
                    path: this.contextMenuTarget,
                    content: newContent
                });

                const saveData = await saveResponse.json();

                if (saveData.error) {
                    alert('Error saving file: ' + saveData.error);
                    document.getElementById('file-status').textContent = 'Save failed';
                } else {
                    console.log(`[CodeBrowser] ✓ File saved successfully: ${this.contextMenuTarget}`);
                    document.getElementById('file-status').textContent = `Translation complete! ${translatedCount} lines translated and saved.`;

                    if (this.currentFile && this.currentFile.path === this.contextMenuTarget) {
                        document.getElementById('code-editor').value = newContent;
                        this.isModified = false;
                    }

                    setTimeout(() => {
                        document.getElementById('file-status').textContent = `${(saveData.size / 1024).toFixed(2)} KB - Modified: ${saveData.modified}`;
                    }, 3000);
                }
            } else {
                console.log('[CodeBrowser] No Chinese lines found for translation');
                document.getElementById('file-status').textContent = 'No Chinese lines found';
                setTimeout(() => {
                    if (this.currentFile && this.currentFile.path) {
                        document.getElementById('file-status').textContent = `${(data.size / 1024).toFixed(2)} KB - Modified: ${data.modified}`;
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Translation failed:', error);
            alert('Failed to translate file. Please check console for details.');
            document.getElementById('file-status').textContent = 'Translation failed';
        }
    },

    shouldSkipCache(path) {
        const pathParts = path.split('/');
        return pathParts.some(part => this.skipCacheDirectories.includes(part));
    },

    loadExpandedState() {
        try {
            const saved = localStorage.getItem('code_browser_expanded_folders');
            if (saved) {
                const folders = JSON.parse(saved);
                folders.forEach(folder => {
                    if (!this.shouldSkipCache(folder)) {
                        this.expandedFolders.add(folder);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load expanded state:', error);
        }
    },

    saveExpandedState() {
        try {
            const foldersToSave = Array.from(this.expandedFolders).filter(folder =>
                !this.shouldSkipCache(folder)
            );
            localStorage.setItem('code_browser_expanded_folders', JSON.stringify(foldersToSave));
        } catch (error) {
            console.error('Failed to save expanded state:', error);
        }
    }
};
