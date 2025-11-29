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
    baseRealPath: '',
    rootDisplayName: 'Static Root',
    pendingDeletePath: null,
    pendingDeleteStats: null,

    // Video player state
    videoPlayer: null,
    videoPlaylist: [],
    currentVideoIndex: -1,
    isFileListExpanded: false,
    isPlaylistExpanded: false,
    videoNavTimeout: null,

    async init() {
        console.log('[StaticResourceBrowser] Initializing...');
        this.loadExpandedState();
        this.loadVideoSettings();
        await this.loadFileList();
        await this.loadExpandedFolders();
        this.setupEventListeners();
        this.setupVideoHoverEvents();
    },
    
    // Load video settings from localStorage
    loadVideoSettings() {
        const skipIntro = localStorage.getItem('video-skip-intro');
        const autoPlayNext = localStorage.getItem('video-auto-play-next');
        
        if (skipIntro !== null) {
            const skipInput = document.getElementById('video-skip-intro');
            if (skipInput) skipInput.value = skipIntro;
        }
        if (autoPlayNext !== null) {
            const autoPlayCheckbox = document.getElementById('video-auto-play-next');
            if (autoPlayCheckbox) autoPlayCheckbox.checked = autoPlayNext === 'true';
        }
    },
    
    // Save video settings to localStorage
    saveVideoSettings() {
        const skipInput = document.getElementById('video-skip-intro');
        const autoPlayCheckbox = document.getElementById('video-auto-play-next');
        
        if (skipInput) localStorage.setItem('video-skip-intro', skipInput.value);
        if (autoPlayCheckbox) localStorage.setItem('video-auto-play-next', autoPlayCheckbox.checked);
    },
    
    // Setup hover events for showing video controls
    setupVideoHoverEvents() {
        const container = document.getElementById('preview-container');
        if (container) {
            container.addEventListener('mousemove', () => this.showVideoNav());
            container.addEventListener('touchstart', () => this.showVideoNav());
        }
    },
    
    // Show floating video navigation
    showVideoNav() {
        const leftNav = document.getElementById('video-nav-left');
        const rightNav = document.getElementById('video-nav-right');
        const settingsBar = document.getElementById('video-settings-bar');
        
        if (leftNav) leftNav.classList.add('visible');
        if (rightNav) rightNav.classList.add('visible');
        if (settingsBar && settingsBar.classList.contains('floating')) {
            settingsBar.classList.add('visible');
        }
        
        clearTimeout(this.videoNavTimeout);
        this.videoNavTimeout = setTimeout(() => this.hideVideoNav(), 3000);
    },
    
    // Hide floating video navigation
    hideVideoNav() {
        const leftNav = document.getElementById('video-nav-left');
        const rightNav = document.getElementById('video-nav-right');
        const settingsBar = document.getElementById('video-settings-bar');
        
        if (leftNav) leftNav.classList.remove('visible');
        if (rightNav) rightNav.classList.remove('visible');
        if (settingsBar && settingsBar.classList.contains('floating')) {
            settingsBar.classList.remove('visible');
        }
    },
    
    // Toggle file list (slide from left on mobile)
    toggleFileList() {
        const panel = document.getElementById('static-file-list-panel');
        const overlay = document.getElementById('file-list-overlay');
        const toggleBtn = document.getElementById('mobile-file-list-toggle');
        
        if (panel) {
            this.isFileListExpanded = !this.isFileListExpanded;
            panel.classList.toggle('expanded', this.isFileListExpanded);
            
            if (overlay) {
                overlay.classList.toggle('active', this.isFileListExpanded);
            }
            if (toggleBtn) {
                toggleBtn.classList.toggle('hidden', this.isFileListExpanded);
            }
        }
    },
    
    // Close file list (for mobile)
    closeFileList() {
        if (window.innerWidth <= 768 && this.isFileListExpanded) {
            this.toggleFileList();
        }
    },
    
    // Toggle playlist panel
    togglePlaylist() {
        const panel = document.getElementById('video-playlist-panel');
        if (panel) {
            this.isPlaylistExpanded = !this.isPlaylistExpanded;
            panel.classList.toggle('expanded', this.isPlaylistExpanded);
        }
    },
    
    // Smart sort function for files
    smartSort(items) {
        const chineseNumbers = {
            '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
            '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19,
            '二十': 20, '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25, '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29,
            '三十': 30, '三十一': 31, '三十二': 32, '三十三': 33, '三十四': 34, '三十五': 35, '三十六': 36, '三十七': 37, '三十八': 38, '三十九': 39,
            '四十': 40, '五十': 50, '六十': 60, '七十': 70, '八十': 80, '九十': 90, '一百': 100
        };
        
        const extractNumber = (name) => {
            // Try various patterns to extract number
            const patterns = [
                // Pattern: 第X课, 第X章, 第X集
                /第([零一二三四五六七八九十百千]+)[课章集节篇]/,
                /第(\d+)[课章集节篇]/,
                // Pattern: (1), [1], 【1】, @1, ＠1
                /[\(（\[【@＠](\d+)[\)）\]】]?/,
                // Pattern: 1. or 1、or 1_ or 1-
                /^(\d+)[\.、_\-\s]/,
                // Pattern: starts with number
                /^(\d+)/,
                // Chinese numbers at start
                /^([零一二三四五六七八九十百千]+)[、\.]/,
                // Pattern: Lesson 1, Episode 1, etc.
                /(?:lesson|episode|chapter|part|ep|ch)\s*(\d+)/i,
            ];
            
            for (const pattern of patterns) {
                const match = name.match(pattern);
                if (match) {
                    const numStr = match[1];
                    // Check if it's a Chinese number
                    if (chineseNumbers.hasOwnProperty(numStr)) {
                        return chineseNumbers[numStr];
                    }
                    // Check for compound Chinese numbers like 二十一
                    for (const [cn, num] of Object.entries(chineseNumbers)) {
                        if (numStr === cn) {
                            return num;
                        }
                    }
                    // Try parsing as integer
                    const num = parseInt(numStr, 10);
                    if (!isNaN(num)) {
                        return num;
                    }
                }
            }
            return Infinity; // No number found, sort to end
        };
        
        return [...items].sort((a, b) => {
            // Folders first
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            
            const numA = extractNumber(a.name);
            const numB = extractNumber(b.name);
            
            // If both have numbers, sort by number
            if (numA !== Infinity && numB !== Infinity) {
                if (numA !== numB) return numA - numB;
            }
            
            // If only one has a number, it comes first
            if (numA !== Infinity && numB === Infinity) return -1;
            if (numA === Infinity && numB !== Infinity) return 1;
            
            // Fallback to alphabetical
            return a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
        });
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
        this.updatePathDisplay(this.currentPath, this.baseRealPath);
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

        const deleteDialog = document.getElementById('static-delete-dialog');
        deleteDialog.addEventListener('click', (e) => {
            if (e.target === deleteDialog) {
                this.closeDeleteDialog();
            }
        });

        const deleteInput = document.getElementById('static-delete-confirm-input');
        deleteInput.addEventListener('input', () => {
            this.updateDeleteConfirmState();
        });
        deleteInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' && deleteInput.value.trim() === '确认') {
                this.executeDelete();
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

    async loadFileList(path = '', options = {}) {
        const {
            updateCurrent = true,
            updatePathDisplay = updateCurrent
        } = options;

        const response = await fetch(`/static-resources/file-tree?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.error) {
            console.error('[StaticResourceBrowser] Error:', data.error);
            return null;
        }

        if (data.realPath) {
            this.baseRealPath = data.realPath;
        }
        if (path === '' && data.path) {
            this.rootDisplayName = data.path;
        }

        this.folderContents[path] = data.items;

        if (updateCurrent) {
            this.setCurrentPath(path);
        } else if (updatePathDisplay) {
            this.updatePathDisplay(this.currentPath, this.baseRealPath);
        }
        this.renderFileList();
        return data.items;
    },

    renderFileList() {
        const container = document.getElementById('static-file-list');
        const rootItems = this.folderContents[''] || [];
        const items = rootItems.length > 0 ? rootItems : (this.folderContents[this.currentPath] || []);

        if (items.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No files found</div>';
            return;
        }

        let html = '';

        if (rootItems.length > 0) {
            const isRootSelected = !this.currentPath;
            html += `
                <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; color: #dcdcaa; ${isRootSelected ? 'background: #2a2d2e;' : ''}"
                     onclick="StaticResourceBrowser.handleRootClick()">
                    <span style="margin-right: 8px;">🗂️</span>
                    <span style="font-weight: 500;">${this.rootDisplayName}</span>
                </div>
            `;
        }

        html += this.renderItems(items, 0);
        container.innerHTML = html;
    },

    renderItems(items, depth) {
        let html = '';
        const indent = depth * 20;
        
        // Apply smart sorting
        const sortedItems = this.smartSort(items);

        sortedItems.forEach(item => {
            if (item.type === 'directory') {
                const isExpanded = this.expandedFolders.has(item.path);
                const arrow = isExpanded ? '▼' : '▶';
                const icon = isExpanded ? '📂' : '📁';

                const isSelected = this.currentPath === item.path;
                const safePath = item.path.replace(/'/g, "\\'");

                html += `
                    <div style="padding: 8px 12px; padding-left: ${12 + indent}px; cursor: pointer; border-bottom: 1px solid #333; user-select: none; ${isSelected ? 'background: #2a2d2e;' : ''}"
                         onclick="StaticResourceBrowser.selectFolder('${safePath}')"
                         ondblclick="StaticResourceBrowser.toggleFolder('${safePath}', false)"
                         oncontextmenu="StaticResourceBrowser.showContextMenu(event, '${safePath}', 'directory')">
                        <div style="display: flex; align-items: center; color: #dcdcaa;">
                            <span style="margin-right: 4px; font-size: 10px; width: 12px; display: inline-block;"
                                  onclick="event.stopPropagation(); StaticResourceBrowser.toggleFolder('${safePath}', false)">${arrow}</span>
                            <span style="margin-right: 8px;">${icon}</span>
                            <span style="font-weight: 500;" onclick="StaticResourceBrowser.handleFolderLabelClick(event, '${safePath}')">${item.name}</span>
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

    handleRootClick() {
        this.setCurrentPath('');
        this.renderFileList();
    },

    handleFolderLabelClick(event, path) {
        if (event) {
            event.stopPropagation();
        }
        this.selectFolder(path);
        this.toggleFolder(path, false);
    },

    selectFolder(path) {
        this.setCurrentPath(path);
        this.ensurePathExpanded(path);
        this.renderFileList();
    },

    setCurrentPath(path) {
        this.currentPath = path || '';
        this.updatePathDisplay(this.currentPath, this.baseRealPath);
    },

    ensurePathExpanded(path) {
        if (!path) {
            return;
        }

        const parts = path.split('/').filter(Boolean);
        let current = '';
        let changed = false;

        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            if (!this.expandedFolders.has(current)) {
                this.expandedFolders.add(current);
                changed = true;
            }
        }

        if (path && !this.expandedFolders.has(path)) {
            this.expandedFolders.add(path);
            changed = true;
        }

        if (changed) {
            this.saveExpandedState();
        }
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
            this.selectFolder(path);
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
        this.selectFolder(parentPath);
    },

    async navigateToFolder(path) {
        this.selectFolder(path);
        if (path && !this.expandedFolders.has(path)) {
            this.expandedFolders.add(path);
            this.saveExpandedState();
        }
        if (path && !this.folderContents[path]) {
            await this.loadFileList(path, { updateCurrent: false, updatePathDisplay: false });
        } else {
            this.renderFileList();
        }
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
        const settingsBar = document.getElementById('video-settings-bar');
        const playlistPanel = document.getElementById('video-playlist-panel');

        fileName.textContent = path.split('/').pop();
        fileInfo.textContent = 'Loading...';
        
        // Dispose previous video player if exists
        this.disposeVideoPlayer();
        
        // Hide video controls by default
        if (settingsBar) settingsBar.style.display = 'none';
        if (playlistPanel) playlistPanel.style.display = 'none';

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
                // Use Video.js for video playback
                this.setupVideoPlayer(path, mimeType, data);
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
                    <textarea readonly style="width: 100%; height: 100%; background: #1e1e1e; color: #d4d4d4; border: 1px solid #333; padding: 15px; font-family: 'Consolas', monospace; font-size: 13px; line-height: 1.6; resize: none; tab-size: 4;">${this.escapeHtml(data.content)}</textarea>
                `;
            } else {
                container.innerHTML = `
                    <div class="static-preview-empty">
                        <div class="static-preview-empty-icon">${this.getFileIcon(mimeType, data.extension)}</div>
                        <p class="static-preview-empty-text">${data.path.split('/').pop()}</p>
                        <p class="static-preview-empty-hint">${data.mimeType} | ${this.formatFileSize(data.size)}</p>
                        <button onclick="window.open('/static-resources/stream-file?path=${encodeURIComponent(path)}', '_blank')"
                                class="video-nav-btn" style="margin-top: 20px;">
                            Download / Open
                        </button>
                    </div>
                `;
            }
            
            // Close file list on mobile after selecting a file
            this.closeFileList();
        } catch (error) {
            console.error('[StaticResourceBrowser] Preview error:', error);
            container.innerHTML = `<div style="color: #dc3545; text-align: center;">Failed to load file</div>`;
        }
    },
    
    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Setup Video.js player
    setupVideoPlayer(path, mimeType, data) {
        const container = document.getElementById('preview-container');
        const settingsBar = document.getElementById('video-settings-bar');
        const playlistPanel = document.getElementById('video-playlist-panel');
        
        // Build video playlist from current folder
        this.buildVideoPlaylist(path);
        
        // Create video element with floating nav buttons
        const navLeftHtml = document.getElementById('video-nav-left') ? '' : `
            <div id="video-nav-left" class="video-nav-floating left">
                <button class="video-nav-btn large" id="video-prev-btn-float" onclick="StaticResourceBrowser.playPrevVideo()" disabled>⏮</button>
            </div>
        `;
        const navRightHtml = document.getElementById('video-nav-right') ? '' : `
            <div id="video-nav-right" class="video-nav-floating right">
                <button class="video-nav-btn large" id="video-next-btn-float" onclick="StaticResourceBrowser.playNextVideo()" disabled>⏭</button>
            </div>
        `;
        
        container.innerHTML = `
            ${navLeftHtml}
            ${navRightHtml}
            <div class="video-js-wrapper">
                <video id="static-video-player" class="video-js vjs-big-play-centered vjs-fluid"
                       controls preload="auto" playsinline>
                    <source src="/static-resources/stream-file?path=${encodeURIComponent(path)}" type="${mimeType}">
                    <p class="vjs-no-js">Please enable JavaScript to view this video.</p>
                </video>
            </div>
        `;
        
        // Initialize Video.js
        if (typeof videojs !== 'undefined') {
            this.videoPlayer = videojs('static-video-player', {
                controls: true,
                autoplay: false,
                preload: 'auto',
                fluid: true,
                responsive: true,
                playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
                controlBar: {
                    children: [
                        'playToggle',
                        'volumePanel',
                        'currentTimeDisplay',
                        'timeDivider',
                        'durationDisplay',
                        'progressControl',
                        'playbackRateMenuButton',
                        'fullscreenToggle'
                    ]
                }
            });
            
            // Apply skip intro when video loads
            this.videoPlayer.on('loadedmetadata', () => {
                this.applySkipIntro();
            });
            
            // Handle video ended - auto play next
            this.videoPlayer.on('ended', () => {
                const autoPlayCheckbox = document.getElementById('video-auto-play-next');
                if (autoPlayCheckbox && autoPlayCheckbox.checked) {
                    this.playNextVideo();
                }
            });
            
            // Handle fullscreen change
            this.videoPlayer.on('fullscreenchange', () => {
                this.handleFullscreenChange();
            });
            
            // Save settings when changed
            const skipInput = document.getElementById('video-skip-intro');
            const autoPlayCheckbox = document.getElementById('video-auto-play-next');
            
            if (skipInput) {
                skipInput.removeEventListener('change', this.saveVideoSettings);
                skipInput.addEventListener('change', () => this.saveVideoSettings());
            }
            if (autoPlayCheckbox) {
                autoPlayCheckbox.removeEventListener('change', this.saveVideoSettings);
                autoPlayCheckbox.addEventListener('change', () => this.saveVideoSettings());
            }
        } else {
            // Fallback to native video
            container.innerHTML = `
                <video controls style="max-width: 100%; max-height: 100%;">
                    <source src="/static-resources/stream-file?path=${encodeURIComponent(path)}" type="${mimeType}">
                    Your browser does not support the video tag.
                </video>
            `;
        }
        
        // Show video settings bar
        if (settingsBar) {
            settingsBar.style.display = 'flex';
        }
        
        // Update playlist count badge
        const countBadge = document.getElementById('playlist-count-badge');
        if (countBadge) {
            countBadge.textContent = this.videoPlaylist.length;
        }
        
        // Render playlist (collapsed by default)
        this.renderVideoPlaylist();
        
        this.updateVideoNavButtons();
        
        // Show nav on initial load
        this.showVideoNav();
    },
    
    // Handle fullscreen change
    handleFullscreenChange() {
        const isFullscreen = this.videoPlayer && this.videoPlayer.isFullscreen();
        const settingsBar = document.getElementById('video-settings-bar');
        
        if (isFullscreen) {
            // In fullscreen, make settings bar floating
            if (settingsBar) {
                settingsBar.classList.add('floating');
            }
        } else {
            // Exit fullscreen on mobile, keep floating
            if (window.innerWidth > 768 && settingsBar) {
                settingsBar.classList.remove('floating');
            }
        }
    },
    
    // Dispose video player
    disposeVideoPlayer() {
        if (this.videoPlayer) {
            try {
                this.videoPlayer.dispose();
            } catch (e) {
                console.log('[StaticResourceBrowser] Video player dispose:', e);
            }
            this.videoPlayer = null;
        }
    },
    
    // Apply skip intro setting
    applySkipIntro() {
        const skipInput = document.getElementById('video-skip-intro');
        if (skipInput && this.videoPlayer) {
            const skipSeconds = parseInt(skipInput.value) || 0;
            if (skipSeconds > 0) {
                this.videoPlayer.currentTime(skipSeconds);
            }
        }
    },
    
    // Build video playlist from current folder
    buildVideoPlaylist(currentPath) {
        const folderPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        const items = this.folderContents[folderPath] || this.folderContents[''] || [];
        
        // Filter videos and apply smart sorting
        const videos = items.filter(item => 
            item.type === 'file' && item.mimeType && item.mimeType.startsWith('video/')
        );
        this.videoPlaylist = this.smartSort(videos);
        
        this.currentVideoIndex = this.videoPlaylist.findIndex(item => item.path === currentPath);
    },
    
    // Render video playlist
    renderVideoPlaylist() {
        const playlistContainer = document.getElementById('video-playlist');
        const countSpan = document.getElementById('video-playlist-count');
        
        if (!playlistContainer) return;
        
        if (countSpan) {
            countSpan.textContent = `${this.currentVideoIndex + 1} / ${this.videoPlaylist.length}`;
        }
        
        playlistContainer.innerHTML = this.videoPlaylist.map((item, index) => `
            <div class="video-playlist-item ${index === this.currentVideoIndex ? 'active' : ''}"
                 onclick="StaticResourceBrowser.playVideoAtIndex(${index})">
                <span class="video-playlist-item-index">${index + 1}</span>
                <span class="video-playlist-item-name">${item.name}</span>
            </div>
        `).join('');
        
        // Scroll active item into view
        const activeItem = playlistContainer.querySelector('.video-playlist-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },
    
    // Play video at specific index
    playVideoAtIndex(index) {
        if (index >= 0 && index < this.videoPlaylist.length) {
            const video = this.videoPlaylist[index];
            this.previewFile(video.path, video.mimeType);
        }
    },
    
    // Play next video
    playNextVideo() {
        if (this.currentVideoIndex < this.videoPlaylist.length - 1) {
            this.playVideoAtIndex(this.currentVideoIndex + 1);
        }
    },
    
    // Play previous video
    playPrevVideo() {
        if (this.currentVideoIndex > 0) {
            this.playVideoAtIndex(this.currentVideoIndex - 1);
        }
    },
    
    // Update navigation buttons state
    updateVideoNavButtons() {
        const prevBtn = document.getElementById('video-prev-btn');
        const nextBtn = document.getElementById('video-next-btn');
        const prevBtnFloat = document.getElementById('video-prev-btn-float');
        const nextBtnFloat = document.getElementById('video-next-btn-float');
        
        const isPrevDisabled = this.currentVideoIndex <= 0;
        const isNextDisabled = this.currentVideoIndex >= this.videoPlaylist.length - 1;
        
        if (prevBtn) prevBtn.disabled = isPrevDisabled;
        if (nextBtn) nextBtn.disabled = isNextDisabled;
        if (prevBtnFloat) prevBtnFloat.disabled = isPrevDisabled;
        if (nextBtnFloat) nextBtnFloat.disabled = isNextDisabled;
        
        // Update playlist count badge
        const countBadge = document.getElementById('playlist-count-badge');
        if (countBadge) {
            countBadge.textContent = `${this.currentVideoIndex + 1}/${this.videoPlaylist.length}`;
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

    async promptDeleteSelection() {
        if (!this.selectedItem) return;

        const menu = document.getElementById('static-context-menu');
        menu.style.display = 'none';

        this.pendingDeletePath = this.selectedItem;
        this.pendingDeleteStats = null;

        const dialog = document.getElementById('static-delete-dialog');
        const summary = document.getElementById('static-delete-summary');
        const confirmInput = document.getElementById('static-delete-confirm-input');
        const confirmBtn = document.getElementById('static-delete-confirm-btn');

        summary.textContent = 'Preparing delete summary...';
        confirmInput.value = '';
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Delete';

        dialog.style.display = 'flex';
        confirmInput.focus();

        try {
            const response = await fetch('/static-resources/delete-preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    path: this.pendingDeletePath
                })
            });

            const data = await response.json();

            if (data.error) {
                alert('Failed to load delete summary: ' + data.error);
                this.closeDeleteDialog();
                return;
            }

            this.pendingDeleteStats = data.stats || { files: 0, directories: 0, total_items: 0 };
            const files = this.pendingDeleteStats.files ?? 0;
            const directories = this.pendingDeleteStats.directories ?? 0;
            let message = `Deleting <strong>${files}</strong> file(s)`;

            if (directories > 0) {
                message += ` and <strong>${directories}</strong> folder(s)`;
            }

            message += ` from <code>${this.escapeHtml(this.pendingDeletePath)}</code>. `;
            message += `Type <strong>确认</strong> to confirm.`;

            summary.innerHTML = message;
        } catch (error) {
            console.error('[StaticResourceBrowser] Delete preview error:', error);
            alert('Failed to load delete summary');
            this.closeDeleteDialog();
        }
    },

    closeDeleteDialog() {
        const dialog = document.getElementById('static-delete-dialog');
        dialog.style.display = 'none';
        this.pendingDeletePath = null;
        this.pendingDeleteStats = null;

        const confirmBtn = document.getElementById('static-delete-confirm-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Delete';

        const confirmInput = document.getElementById('static-delete-confirm-input');
        confirmInput.value = '';
    },

    updateDeleteConfirmState() {
        const confirmInput = document.getElementById('static-delete-confirm-input');
        const confirmBtn = document.getElementById('static-delete-confirm-btn');

        confirmBtn.disabled = confirmInput.value.trim() !== '确认';
    },

    async executeDelete() {
        if (!this.pendingDeletePath) {
            return;
        }

        const confirmInput = document.getElementById('static-delete-confirm-input');
        if (confirmInput.value.trim() !== '确认') {
            alert('Please type 确认 to proceed.');
            return;
        }

        const confirmBtn = document.getElementById('static-delete-confirm-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        try {
            const response = await fetch('/static-resources/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                },
                body: JSON.stringify({
                    path: this.pendingDeletePath
                })
            });

            const result = await response.json();

            if (result.error) {
                alert('Delete failed: ' + result.error);
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Delete';
                return;
            }

            await this.refreshList();
            this.closeDeleteDialog();
        } catch (error) {
            console.error('[StaticResourceBrowser] Delete error:', error);
            alert('Delete failed');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Delete';
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
        const targetPath = this.currentPath || '';
        this.folderContents = {};

        if (targetPath !== '') {
            await this.loadFileList('', { updateCurrent: false, updatePathDisplay: false });
        }

        await this.loadFileList(targetPath, { updateCurrent: true, updatePathDisplay: true });
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
