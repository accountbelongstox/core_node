// Prompts/Tasks Manager Module - Integrated with floating windows, translation, and audio
// Manages the Tasks/Prompts list panel and integrates with Prompt Mapping Manager
const PromptsTasksManager = {
    // Core properties
    currentCategory: 'global',
    promptFiles: [],

    // Floating window management
    windows: new Map(),
    activeWindow: null,
    windowZIndex: 30000,

    // Translation management
    translationQueue: new Map(),
    translating: false,
    lastEditTimes: new Map(),
    lastSaveTimes: new Map(),
    lastTranslationTimes: new Map(),
    translatedNames: new Map(),
    autoTranslateDelay: 5000,
    autoSaveDelay: 2000,
    nameTranslationQueue: new Set(),
    nameTranslating: false,

    // Audio playback management
    sentenceAudioMap: new Map(),
    currentPlayingIndex: -1,
    lastPlayedIndex: -1,
    playbackSpeed: 1.0,
    currentAudio: null,
    isPlaying: false,
    loopPlayback: false,
    currentPlayingPath: null,
    subtitleElement: null,
    editorContextMenu: null,

    async init() {
        this.setupEventListeners();
        this.loadNameTranslationsCache();
        this.createSubtitleElement();
        this.setupGlobalKeyboardListener();
        await this.loadCategory('global');

        // Start background processes
        this.startAutoTranslateChecker();
        this.startAutoSaveChecker();
        this.startNameTranslationChecker();

        // Global click handler for window management
        window.addEventListener('click', (e) => this.handleWindowClick(e));
    },

    setupEventListeners() {
        const selector = document.getElementById('prompt-category-selector');
        if (selector) {
            selector.addEventListener('change', async (e) => {
                await this.loadCategory(e.target.value);
            });
        }
    },

    createSubtitleElement() {
        this.subtitleElement = document.createElement('div');
        this.subtitleElement.id = 'prompts-subtitle';
        this.subtitleElement.className = 'prompts-subtitle';
        document.body.appendChild(this.subtitleElement);
    },

    setupGlobalKeyboardListener() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                const target = e.target;
                const isInEditor = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;

                if (!isInEditor) {
                    e.preventDefault();
                    this.toggleGlobalPlayback();
                }
            }
        });
    },

    async loadCategory(categoryId) {
        this.currentCategory = categoryId;

        try {
            const data = await apiClientInstance.get(`${ApiClient.PointUrlKey.MCP_TASK_CATEGORIES_FILES}/${categoryId}/files`);

            if (data.success) {
                this.promptFiles = data.data.files || [];
                this.renderFilesList();

                // Sync with mapping manager
                PromptMappingManager.switchCategory(categoryId);
            } else {
                console.error('Failed to load category files:', data.error);
                this.renderEmptyState('Failed to load files');
            }
        } catch (error) {
            console.error('Error loading category files:', error);
            this.renderEmptyState('Error loading files');
        }
    },

    renderFilesList() {
        const container = document.getElementById('prompts-tasks-list');

        if (this.promptFiles.length === 0) {
            this.renderEmptyState('No prompt files in this category');
            return;
        }

        container.innerHTML = '';

        this.promptFiles.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'prompt-file-item';
            fileDiv.dataset.path = file.path;
            fileDiv.dataset.name = file.name;

            const fileName = file.name.replace('.md', '');
            const displayName = this.getTranslatedName(file.name) || fileName;
            const fileSize = this.formatFileSize(file.size);

            fileDiv.innerHTML = `
                <div class="prompt-file-name-container">
                    <div class="prompt-file-name">${displayName}</div>
                    <div class="prompt-file-meta">${fileSize} • ${file.modified}</div>
                </div>
                <div class="prompt-file-actions">
                    <button class="prompt-file-btn-queue" data-action="add-to-queue" data-path="${file.path}" title="Add to Queue">
                        ➜ Queue
                    </button>
                    <button class="prompt-file-btn-delete" data-action="delete-file" data-path="${file.path}" title="Delete File">
                        🗑
                    </button>
                </div>
            `;

            fileDiv.addEventListener('click', (e) => {
                if (!e.target.closest('[data-action]')) {
                    this.openPromptWindow(file.path, file.name);
                }
            });

            fileDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showFileContextMenu(e, file);
            });

            container.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]');
                if (!action) return;

                e.stopPropagation();
                const actionType = action.dataset.action;
                const path = action.dataset.path;

                switch (actionType) {
                    case 'add-to-queue':
                        this.addToQueue(path);
                        break;
                    case 'delete-file':
                        this.deletePromptFile(path);
                        break;
                }
            });

            container.appendChild(fileDiv);

            if (this.containsChinese(file.name) && !this.getTranslatedName(file.name)) {
                this.queueNameTranslation(file.name);
            }
        });
    },

    showFileContextMenu(e, file) {
        const existingMenu = document.getElementById('file-item-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'file-item-context-menu';
        menu.className = 'prompt-context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';

        const menuItems = [
            { label: '📝 Edit', action: () => this.openPromptWindow(file.path, file.name) },
            { label: '➜ Add to Queue', action: () => this.addToQueue(file.path) },
            { label: '🗑 Delete', action: () => this.deletePromptFile(file.path), isDanger: true }
        ];

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.className = item.isDanger ? 'prompt-context-menu-item prompt-context-menu-item-danger' : 'prompt-context-menu-item';
            menuItem.onclick = () => {
                menu.remove();
                item.action();
            };
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    },

    async deletePromptFile(filePath) {
        // Normalize path: replace backslashes with forward slashes
        filePath = filePath.replace(/\\/g, '/');

        console.log('[PromptsTasksManager] Deleting file:', filePath);

        if (!confirm(`Are you sure you want to delete this file?\n\n${filePath}`)) {
            return;
        }

        try {
            const data = await apiClientInstance.post(ApiClient.PointUrlKey.CODE_BROWSER_DELETE_FILE, {
                path: filePath
            });

            if (data.error) {
                console.error('[PromptsTasksManager] Delete failed:', data);
                this.showNotification(`Failed to delete: ${data.error}`, 'error');
                return;
            }

            this.showNotification('File deleted successfully', 'success');

            // Close window if open
            if (this.windows.has(filePath)) {
                const window = this.windows.get(filePath);
                window.element.remove();
                this.windows.delete(filePath);
            }

            // Refresh both the task list and Code Browser file tree
            await this.refresh();

            // Refresh Code Browser file tree (upper panel)
            CodeBrowser.refreshTree();
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification('Error deleting file', 'error');
        }
    },

    renderEmptyState(message) {
        const container = document.getElementById('prompts-tasks-list');
        container.innerHTML = `<div class="prompts-empty-state">${message}</div>`;
    },

    // ============================================
    // FLOATING WINDOW EDITOR SYSTEM
    // ============================================

    async openPromptWindow(path, name) {
        if (this.windows.has(path)) {
            this.bringToFront(path);
            return;
        }

        try {
            const data = await apiClientInstance.get(`${ApiClient.PointUrlKey.CODE_BROWSER_READ_FILE}?path=${encodeURIComponent(path)}`);

            if (data.error) {
                this.showNotification('Error: ' + data.error, 'error');
                return;
            }

            // Ensure content is a string
            const content = String(data.content || '');
            this.createFloatingWindow(path, name, content, data.modified);
        } catch (error) {
            console.error('Failed to open prompt:', error);
            this.showNotification('Failed to open prompt', 'error');
        }
    },

    createFloatingWindow(path, name, content, modified) {
        // Ensure content is always a string
        content = String(content || '');

        const windowId = `prompt-window-${Date.now()}`;
        const windowElement = document.createElement('div');
        windowElement.id = windowId;
        windowElement.style.cssText = `
            position: fixed;
            top: ${100 + (this.windows.size * 30)}px;
            left: ${100 + (this.windows.size * 30)}px;
            width: 700px;
            height: 600px;
            background: linear-gradient(135deg, #1e1e1e 0%, #252526 100%);
            border: 1px solid #454545;
            border-radius: 8px;
            box-shadow: 0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05);
            z-index: ${++this.windowZIndex};
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;

        windowElement.addEventListener('mousedown', () => this.bringToFront(path, windowElement));

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            height: 40px;
            background: linear-gradient(135deg, #2d2d30 0%, #323233 100%);
            border-bottom: 1px solid #454545;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            cursor: move;
            user-select: none;
            border-radius: 8px 8px 0 0;
        `;

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1;';

        const title = document.createElement('span');
        title.textContent = name;
        title.style.cssText = 'color: #cccccc; font-size: 13px; font-weight: 500;';
        titleContainer.appendChild(title);

        const statusIndicator = document.createElement('span');
        statusIndicator.id = `${windowId}-status`;
        statusIndicator.style.cssText = 'color: #888; font-size: 11px; font-style: italic;';
        titleContainer.appendChild(statusIndicator);

        header.appendChild(titleContainer);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 4px;';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.id = `${windowId}-save-btn`;
        saveBtn.style.cssText = `
            padding: 4px 10px;
            background: #0e639c;
            color: #ffffff;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.2s;
        `;
        saveBtn.onmouseover = () => saveBtn.style.background = '#1177bb';
        saveBtn.onmouseout = () => saveBtn.style.background = '#0e639c';
        saveBtn.onclick = () => this.saveWindow(path);
        buttonContainer.appendChild(saveBtn);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            width: 28px;
            height: 28px;
            background: transparent;
            color: #cccccc;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 20px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        closeBtn.onmouseover = () => {
            closeBtn.style.background = '#f48771';
            closeBtn.style.color = '#ffffff';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'transparent';
            closeBtn.style.color = '#cccccc';
        };
        closeBtn.onclick = () => this.closeWindow(path, windowElement);
        buttonContainer.appendChild(closeBtn);

        header.appendChild(buttonContainer);

        // Main container with editor and audio panel
        const mainContainer = document.createElement('div');
        mainContainer.style.cssText = 'flex: 1; display: flex; overflow: hidden;';

        const editorContainer = document.createElement('div');
        editorContainer.style.cssText = 'flex: 0 0 60%; padding: 16px; overflow: hidden; display: flex; flex-direction: column; border-right: 1px solid #3c3c3c;';

        const editor = document.createElement('textarea');
        editor.id = `${windowId}-editor`;
        editor.style.cssText = `
            width: 100%;
            height: 100%;
            background: #1e1e1e;
            color: #d4d4d4;
            border: 1px solid #3c3c3c;
            border-radius: 4px;
            outline: none;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.6;
            resize: none;
            tab-size: 4;
            padding: 12px;
            box-sizing: border-box;
        `;
        editor.value = content;

        editorContainer.appendChild(editor);

        // Audio panel
        const audioPanel = document.createElement('div');
        audioPanel.id = `${windowId}-audio-panel`;
        audioPanel.style.cssText = 'flex: 0 0 40%; display: flex; flex-direction: column; background: #252526;';

        const audioControls = document.createElement('div');
        audioControls.style.cssText = 'padding: 12px; border-bottom: 1px solid #3c3c3c; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;';

        const prevBtn = this.createAudioButton('⏮ Prev', () => this.playPrevious(path));
        const nextBtn = this.createAudioButton('Next ⏭', () => this.playNext(path));
        const latestBtn = this.createAudioButton('▶ Latest', () => this.playLatest(path));

        const speedLabel = document.createElement('span');
        speedLabel.textContent = 'Speed:';
        speedLabel.style.cssText = 'color: #ccc; font-size: 11px; margin-left: 8px;';

        const speedControl = document.createElement('input');
        speedControl.type = 'range';
        speedControl.min = '0.5';
        speedControl.max = '2.0';
        speedControl.step = '0.1';
        speedControl.value = '1.0';
        speedControl.style.cssText = 'width: 80px;';
        speedControl.addEventListener('input', (e) => {
            this.playbackSpeed = parseFloat(e.target.value);
            speedValue.textContent = this.playbackSpeed.toFixed(1) + 'x';
        });

        const speedValue = document.createElement('span');
        speedValue.textContent = '1.0x';
        speedValue.style.cssText = 'color: #ccc; font-size: 11px; min-width: 35px;';

        audioControls.appendChild(prevBtn);
        audioControls.appendChild(nextBtn);
        audioControls.appendChild(latestBtn);
        audioControls.appendChild(speedLabel);
        audioControls.appendChild(speedControl);
        audioControls.appendChild(speedValue);

        const audioList = document.createElement('div');
        audioList.id = `${windowId}-audio-list`;
        audioList.style.cssText = 'flex: 1; overflow-y: auto; padding: 8px;';

        audioPanel.appendChild(audioControls);
        audioPanel.appendChild(audioList);

        mainContainer.appendChild(editorContainer);
        mainContainer.appendChild(audioPanel);

        windowElement.appendChild(header);
        windowElement.appendChild(mainContainer);
        document.body.appendChild(windowElement);

        this.makeDraggable(windowElement, header);
        this.makeResizable(windowElement);

        this.windows.set(path, {
            element: windowElement,
            editor: editor,
            name: name,
            modified: modified,
            lastContent: content,
            isDirty: false,
            statusIndicator: statusIndicator,
            saveBtn: saveBtn,
            audioList: audioList,
            sentences: []
        });

        editor.addEventListener('input', () => this.onEditorInput(path));
        editor.addEventListener('blur', () => this.onEditorBlur(path));
        editor.addEventListener('focus', () => this.onEditorFocus(path));
        editor.addEventListener('contextmenu', (e) => this.showEditorContextMenu(e, path));

        this.createEditorContextMenu();

        this.lastEditTimes.set(path, Date.now());

        if (this.containsChinese(content)) {
            this.translationQueue.set(path, {
                content: editor.value,
                modified: modified,
                scheduledTime: Date.now(),
                isBackground: false
            });
        } else if (content.trim()) {
            setTimeout(() => {
                this.updateAudioForWindow(path, content);
            }, 500);
        }

        this.activeWindow = path;
    },

    makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;

            document.onmouseup = () => {
                document.onmouseup = null;
                document.onmousemove = null;
            };

            document.onmousemove = (e) => {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = (element.offsetTop - pos2) + 'px';
                element.style.left = (element.offsetLeft - pos1) + 'px';
            };
        };
    },

    makeResizable(element) {
        const resizer = document.createElement('div');
        resizer.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: se-resize;
            background: linear-gradient(135deg, transparent 0%, transparent 50%, #454545 50%, #454545 100%);
            border-radius: 0 0 8px 0;
        `;

        resizer.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = element.offsetWidth;
            const startHeight = element.offsetHeight;

            const doDrag = (e) => {
                const newWidth = startWidth + e.clientX - startX;
                const newHeight = startHeight + e.clientY - startY;
                if (newWidth > 400) element.style.width = newWidth + 'px';
                if (newHeight > 300) element.style.height = newHeight + 'px';
            };

            const stopDrag = () => {
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);
            };

            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        };

        element.appendChild(resizer);
    },

    bringToFront(path, element = null) {
        const window = element ? { element: element } : this.windows.get(path);
        if (window) {
            window.element.style.zIndex = ++this.windowZIndex;
            this.activeWindow = path;
        }
    },

    closeWindow(path, element) {
        const window = this.windows.get(path);
        if (window && window.isDirty) {
            if (!confirm('You have unsaved changes. Close anyway?')) return;
        }

        element.remove();
        this.windows.delete(path);
        this.lastEditTimes.delete(path);
        this.lastSaveTimes.delete(path);
        this.translationQueue.delete(path);
        if (this.activeWindow === path) {
            this.activeWindow = null;
        }
    },

    handleWindowClick(e) {
        let current = e.target;
        while (current && current !== document.body) {
            if (current.id && current.id.startsWith('prompt-window-')) {
                for (const [path, window] of this.windows.entries()) {
                    if (window.element === current) {
                        this.bringToFront(path, current);
                        return;
                    }
                }
            }
            current = current.parentElement;
        }
    },

    onEditorInput(path) {
        const window = this.windows.get(path);
        if (!window) return;

        window.isDirty = true;
        this.lastEditTimes.set(path, Date.now());
        this.updateWindowStatus(path, 'Modified (unsaved)');

        this.translationQueue.set(path, {
            content: window.editor.value,
            modified: window.modified,
            scheduledTime: Date.now(),
            isBackground: false
        });
    },

    onEditorBlur(path) {
        this.scheduleTranslation(path);
    },

    onEditorFocus(path) {
        if (this.translationQueue.has(path)) {
            this.translationQueue.delete(path);
        }
    },

    scheduleTranslation(path) {
        const window = this.windows.get(path);
        if (!window || !window.isDirty) return;

        const content = window.editor.value;
        if (!this.containsChinese(content)) return;

        this.translationQueue.set(path, {
            content: content,
            modified: window.modified,
            scheduledTime: Date.now()
        });
    },

    updateWindowStatus(path, message) {
        const window = this.windows.get(path);
        if (window && window.statusIndicator) {
            window.statusIndicator.textContent = message;
        }
    },

    async saveWindow(path) {
        const window = this.windows.get(path);
        if (!window) return;

        const content = window.editor.value;
        this.updateWindowStatus(path, 'Saving...');

        try {
            const data = await apiClientInstance.post(ApiClient.PointUrlKey.CODE_BROWSER_SAVE_FILE, {
                path: path,
                content: content
            });

            if (data.error) {
                this.updateWindowStatus(path, 'Save failed!');
                this.showNotification('Error: ' + data.error, 'error');
                return;
            }

            window.isDirty = false;
            window.lastContent = content;
            window.modified = data.modified || window.modified;
            this.lastSaveTimes.set(path, Date.now());
            this.updateWindowStatus(path, 'Saved');

            setTimeout(() => {
                if (!window.isDirty) {
                    this.updateWindowStatus(path, '');
                }
            }, 2000);
        } catch (error) {
            console.error('Failed to save:', error);
            this.updateWindowStatus(path, 'Save failed!');
        }
    },

    // ============================================
    // AUTO-SAVE SYSTEM
    // ============================================

    startAutoSaveChecker() {
        setInterval(() => {
            this.checkAndAutoSave();
        }, 1000);
    },

    async checkAndAutoSave() {
        const now = Date.now();
        for (const [path, window] of this.windows.entries()) {
            if (!window.isDirty) continue;

            const lastEdit = this.lastEditTimes.get(path) || 0;
            const lastSave = this.lastSaveTimes.get(path) || 0;

            if (now - lastEdit >= this.autoSaveDelay && lastEdit > lastSave) {
                await this.saveWindow(path);
            }
        }
    },

    // ============================================
    // TRANSLATION SYSTEM
    // ============================================

    startAutoTranslateChecker() {
        setInterval(() => {
            this.checkAndTranslate();
        }, 2000);
    },

    async checkAndTranslate() {
        if (this.translating) return;

        const now = Date.now();
        for (const [path, data] of this.translationQueue.entries()) {
            const window = this.windows.get(path);
            if (!window) {
                this.translationQueue.delete(path);
                continue;
            }

            const lastEdit = this.lastEditTimes.get(path) || 0;
            if (now - lastEdit < this.autoTranslateDelay) {
                continue;
            }

            this.translationQueue.delete(path);
            await this.translatePromptContent(path);
        }
    },

    async translatePromptContent(path) {
        const window = this.windows.get(path);
        if (!window) return;

        this.translating = true;
        this.updateWindowStatus(path, 'Translating...');

        try {
            const content = window.editor.value;
            const lines = content.split('\n');
            const translatedLines = [];
            let hasChanges = false;
            let translatedCount = 0;
            let totalChineseLines = 0;

            console.log(`[PromptsTasksManager] Translating file line-by-line: ${path}`);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (window.isDirty) {
                    console.log('[PromptsTasksManager] File was modified during translation, aborting');
                    this.updateWindowStatus(path, 'Translation aborted (file edited)');
                    setTimeout(() => {
                        if (!window.isDirty) {
                            this.updateWindowStatus(path, '');
                        }
                    }, 3000);
                    return;
                }

                if (!this.containsChinese(line)) {
                    translatedLines.push(line);
                    continue;
                }

                totalChineseLines++;
                console.log(`[PromptsTasksManager] Translating line ${i + 1}/${lines.length}`);
                this.updateWindowStatus(path, `Translating line ${i + 1}/${lines.length}...`);

                try {
                    const data = await apiClientInstance.post(ApiClient.PointUrlKey.CODE_BROWSER_PROMPTS_TRANSLATE_LINE, {
                        line: line
                    });

                    if (data.error) {
                        console.error(`[PromptsTasksManager] Translation error for line ${i + 1}:`, data.error);
                        translatedLines.push(line);
                        continue;
                    }

                    if (data.success && data.translated) {
                        if (data.translated !== line) {
                            console.log(`[PromptsTasksManager]   ✓ Line ${i + 1} translated`);
                            translatedLines.push(data.translated);
                            hasChanges = true;
                            translatedCount++;
                        } else {
                            translatedLines.push(line);
                        }
                    } else {
                        translatedLines.push(line);
                    }
                } catch (error) {
                    console.error(`[PromptsTasksManager] Failed to translate line ${i + 1}:`, error);
                    translatedLines.push(line);
                }
            }

            if (hasChanges) {
                const newContent = translatedLines.join('\n');
                console.log(`[PromptsTasksManager] Translation complete. ${translatedCount}/${totalChineseLines} Chinese lines translated. Saving file...`);
                this.updateWindowStatus(path, 'Saving translated content...');

                const saveData = await apiClientInstance.post(ApiClient.PointUrlKey.CODE_BROWSER_SAVE_FILE, {
                    path: path,
                    content: newContent,
                    skip_backup: true,
                    cleanup_old_backups: true
                });

                if (saveData.error) {
                    console.error(`[PromptsTasksManager] Failed to save file:`, saveData.error);
                    this.updateWindowStatus(path, 'Save failed');
                    setTimeout(() => {
                        if (!window.isDirty) {
                            this.updateWindowStatus(path, '');
                        }
                    }, 3000);
                } else {
                    console.log(`[PromptsTasksManager] ✓ File saved successfully: ${path}`);
                    window.editor.value = newContent;
                    window.savedContent = newContent;
                    window.isDirty = false;

                    this.lastTranslationTimes.set(path, Date.now());

                    this.updateWindowStatus(path, `✓ Translated and saved (${translatedCount} lines) - Generating audio...`);

                    await this.updateAudioForWindow(path, newContent);

                    setTimeout(() => {
                        if (!window.isDirty) {
                            this.updateWindowStatus(path, '');
                        }
                    }, 3000);
                }
            } else {
                console.log('[PromptsTasksManager] No translation needed for:', path);
                this.lastTranslationTimes.set(path, Date.now());
                this.updateWindowStatus(path, 'No translation needed');
                setTimeout(() => {
                    if (!window.isDirty) {
                        this.updateWindowStatus(path, '');
                    }
                }, 2000);
            }
        } catch (error) {
            console.error('Translation failed:', error);
            this.updateWindowStatus(path, 'Translation failed');
            setTimeout(() => {
                const window = this.windows.get(path);
                if (window && !window.isDirty) {
                    this.updateWindowStatus(path, '');
                }
            }, 3000);
        } finally {
            this.translating = false;
        }
    },

    containsChinese(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    },

    // ============================================
    // NAME TRANSLATION SYSTEM
    // ============================================

    startNameTranslationChecker() {
        setInterval(() => {
            this.checkAndTranslateNames();
        }, 1000);
    },

    async checkAndTranslateNames() {
        if (this.nameTranslating || this.nameTranslationQueue.size === 0) return;

        const name = Array.from(this.nameTranslationQueue)[0];
        this.nameTranslationQueue.delete(name);

        this.nameTranslating = true;
        try {
            const translated = await this.translateText(name);
            if (translated) {
                console.log(`[PromptsTasksManager] Translated filename: "${name}" -> "${translated}"`);
                this.translatedNames.set(name, translated);
                this.saveNameTranslationCache(name, translated);
                await this.refresh();
            }
        } catch (error) {
            console.error('Name translation failed:', error);
        } finally {
            this.nameTranslating = false;
        }
    },

    queueNameTranslation(name) {
        if (!this.containsChinese(name)) return;
        if (this.getTranslatedName(name)) return;
        this.nameTranslationQueue.add(name);
    },

    getTranslatedName(name) {
        if (this.translatedNames.has(name)) {
            return this.translatedNames.get(name);
        }
        const cached = localStorage.getItem(`prompt_name_${name}`);
        if (cached) {
            this.translatedNames.set(name, cached);
            return cached;
        }
        return null;
    },

    saveNameTranslationCache(name, translated) {
        localStorage.setItem(`prompt_name_${name}`, translated);
    },

    loadNameTranslationsCache() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('prompt_name_')) {
                const name = key.substring(12);
                const translated = localStorage.getItem(key);
                if (translated) {
                    this.translatedNames.set(name, translated);
                }
            }
        }
    },

    async translateText(text) {
        try {
            const data = await apiClientInstance.post(ApiClient.PointUrlKey.CODE_BROWSER_PROMPTS_TRANSLATE_NAME, {
                name: text
            });

            return (data.success && data.translated) ? data.translated : null;
        } catch (error) {
            console.error('Translation failed:', error);
            return null;
        }
    },

    // ============================================
    // AUDIO PLAYBACK SYSTEM
    // ============================================

    createAudioButton(text, onclick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.style.cssText = `
            padding: 6px 12px;
            background: #0e639c;
            color: #fff;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            transition: background 0.2s;
        `;
        btn.onmouseover = () => btn.style.background = '#1177bb';
        btn.onmouseout = () => btn.style.background = '#0e639c';
        btn.onclick = onclick;
        return btn;
    },

    splitIntoSentences(text) {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    },

    async requestTTS(text) {
        try {
            const data = await apiClientInstance.post(ApiClient.PointUrlKey.TTS_GENERATE, {
                text: text,
                language: 'en',
                type: 'sentence'
            });

            if (data.error) {
                console.error('[PromptsTasksManager] TTS generation error:', data.error);
                return null;
            }

            if (data.success && data.audio_url) {
                return data.audio_url;
            }

            return null;
        } catch (error) {
            console.error('[PromptsTasksManager] TTS request failed:', error);
            return null;
        }
    },

    async updateAudioForWindow(path, translatedText) {
        const window = this.windows.get(path);
        if (!window) return;

        const sentences = this.splitIntoSentences(translatedText);
        window.sentences = [];

        window.audioList.innerHTML = '';

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const sentenceData = {
                text: sentence,
                audioUrl: null,
                index: i,
                element: null
            };

            const sentenceEl = document.createElement('div');
            sentenceEl.style.cssText = 'padding: 8px; margin-bottom: 4px; background: #1e1e1e; border-radius: 3px; display: flex; gap: 8px; align-items: start; border: 1px solid #3c3c3c;';

            const playBtn = document.createElement('button');
            playBtn.innerHTML = '▶';
            playBtn.style.cssText = 'width: 24px; height: 24px; border: none; background: #0e639c; color: #fff; border-radius: 3px; cursor: pointer; font-size: 10px; flex-shrink: 0;';
            playBtn.onclick = () => {
                if (playBtn.innerHTML === '⏹') {
                    this.stopPlayback();
                } else {
                    this.loopPlayback = true;
                    this.isPlaying = true;
                    this.currentPlayingPath = path;
                    this.playSentenceWithLoop(path, i);
                }
            };

            const textEl = document.createElement('div');
            textEl.textContent = sentence;
            textEl.style.cssText = 'flex: 1; color: #ccc; font-size: 12px; line-height: 1.5;';

            const statusEl = document.createElement('span');
            statusEl.textContent = '⏳';
            statusEl.style.cssText = 'color: #888; font-size: 11px;';

            sentenceEl.appendChild(playBtn);
            sentenceEl.appendChild(textEl);
            sentenceEl.appendChild(statusEl);

            window.audioList.appendChild(sentenceEl);

            sentenceData.element = sentenceEl;
            sentenceData.playBtn = playBtn;
            sentenceData.statusEl = statusEl;
            window.sentences.push(sentenceData);

            const audioUrl = await this.requestTTS(sentence);
            if (audioUrl) {
                sentenceData.audioUrl = audioUrl;
                statusEl.textContent = '✓';
                statusEl.style.color = '#6a9955';

                if (i === sentences.length - 1 && this.lastPlayedIndex !== -1) {
                    this.lastPlayedIndex = i;
                    this.playSentence(path, i);
                }
            } else {
                statusEl.textContent = '✗';
                statusEl.style.color = '#f48771';
            }
        }

        if (this.lastPlayedIndex === -1 && sentences.length > 0) {
            this.lastPlayedIndex = 0;
        }
    },

    playSentence(path, index) {
        const window = this.windows.get(path);
        if (!window || !window.sentences[index]) return;

        const sentence = window.sentences[index];
        if (!sentence.audioUrl) {
            console.log('[PromptsTasksManager] Audio not ready for sentence:', sentence.text);
            return;
        }

        if (this.currentAudio) {
            this.currentAudio.pause();
        }

        window.sentences.forEach((s) => {
            if (s.playBtn) {
                s.playBtn.innerHTML = '▶';
                s.playBtn.style.background = '#0e639c';
            }
        });

        this.currentAudio = new Audio(sentence.audioUrl);
        this.currentAudio.preload = 'auto';
        this.currentAudio.playbackRate = this.playbackSpeed;

        sentence.playBtn.innerHTML = '⏹';
        sentence.playBtn.style.background = '#c72e2e';

        this.showSubtitle(sentence.text);

        this.currentAudio.onended = () => {
            sentence.playBtn.innerHTML = '▶';
            sentence.playBtn.style.background = '#0e639c';
            this.hideSubtitle();
        };

        window.sentences.forEach((s, i) => {
            if (s.element) {
                s.element.style.background = i === index ? '#264f78' : '#1e1e1e';
            }
        });

        this.currentPlayingIndex = index;
        this.lastPlayedIndex = index;

        const playAudio = () => {
            this.currentAudio.play().catch(err => {
                console.error('[PromptsTasksManager] Audio play failed:', err);
            });
            console.log(`[PromptsTasksManager] Playing sentence ${index + 1}/${window.sentences.length} at ${this.playbackSpeed}x speed`);
        };

        if (this.currentAudio.readyState >= 3) {
            playAudio();
        } else {
            this.currentAudio.addEventListener('canplaythrough', playAudio, { once: true });
            this.currentAudio.load();
        }
    },

    playPrevious(path) {
        const window = this.windows.get(path);
        if (!window || window.sentences.length === 0) return;

        let index = this.currentPlayingIndex > 0 ? this.currentPlayingIndex - 1 : 0;
        this.playSentence(path, index);
    },

    playNext(path) {
        const window = this.windows.get(path);
        if (!window || window.sentences.length === 0) return;

        let index = this.currentPlayingIndex < window.sentences.length - 1 ? this.currentPlayingIndex + 1 : window.sentences.length - 1;
        this.playSentence(path, index);
    },

    playLatest(path) {
        const window = this.windows.get(path);
        if (!window || window.sentences.length === 0) return;

        if (this.lastPlayedIndex >= 0 && this.lastPlayedIndex < window.sentences.length) {
            this.playSentence(path, this.lastPlayedIndex);
        } else {
            this.playSentence(path, window.sentences.length - 1);
        }
    },

    playSentenceWithLoop(path, index) {
        if (!this.isPlaying || !this.loopPlayback) return;

        const window = this.windows.get(path);
        if (!window || !window.sentences[index]) {
            if (this.loopPlayback) {
                this.playSentenceWithLoop(path, 0);
            }
            return;
        }

        const sentence = window.sentences[index];
        if (!sentence.audioUrl) {
            const nextIndex = index + 1 < window.sentences.length ? index + 1 : 0;
            setTimeout(() => this.playSentenceWithLoop(path, nextIndex), 100);
            return;
        }

        if (this.currentAudio) {
            this.currentAudio.pause();
        }

        this.currentAudio = new Audio(sentence.audioUrl);
        this.currentAudio.preload = 'auto';
        this.currentAudio.playbackRate = this.playbackSpeed;

        sentence.playBtn.innerHTML = '⏹';
        sentence.playBtn.style.background = '#c72e2e';

        window.sentences.forEach((s, i) => {
            if (s.element) {
                s.element.style.background = i === index ? '#264f78' : '#1e1e1e';
            }
        });

        this.showSubtitle(sentence.text);

        this.currentAudio.onended = () => {
            sentence.playBtn.innerHTML = '▶';
            sentence.playBtn.style.background = '#0e639c';
            this.hideSubtitle();

            if (this.loopPlayback) {
                const nextIndex = index + 1 < window.sentences.length ? index + 1 : 0;
                setTimeout(() => this.playSentenceWithLoop(path, nextIndex), 300);
            }
        };

        this.currentPlayingIndex = index;
        this.lastPlayedIndex = index;

        const playAudio = () => {
            this.currentAudio.play().catch(err => {
                console.error('[PromptsTasksManager] Audio play failed:', err);
            });
            console.log(`[PromptsTasksManager] Playing sentence ${index + 1}/${window.sentences.length} at ${this.playbackSpeed}x speed (Loop: ${this.loopPlayback})`);
        };

        if (this.currentAudio.readyState >= 3) {
            playAudio();
        } else {
            this.currentAudio.addEventListener('canplaythrough', playAudio, { once: true });
            this.currentAudio.load();
        }
    },

    toggleGlobalPlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            this.startGlobalPlayback();
        }
    },

    startGlobalPlayback() {
        const paths = Array.from(this.windows.keys());
        if (paths.length === 0) return;

        this.loopPlayback = true;
        this.currentPlayingPath = this.activeWindow || paths[0];

        const window = this.windows.get(this.currentPlayingPath);
        if (!window || window.sentences.length === 0) return;

        let startIndex = 0;
        for (let i = 0; i < window.sentences.length; i++) {
            if (window.sentences[i].element && window.sentences[i].element.style.background === 'rgb(38, 79, 120)') {
                startIndex = i;
                break;
            }
        }

        this.isPlaying = true;
        this.playSentenceWithLoop(this.currentPlayingPath, startIndex);
    },

    stopPlayback() {
        this.isPlaying = false;
        this.loopPlayback = false;
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.hideSubtitle();

        this.windows.forEach((window) => {
            window.sentences.forEach((s) => {
                if (s.playBtn) {
                    s.playBtn.innerHTML = '▶';
                    s.playBtn.style.background = '#0e639c';
                }
            });
        });
    },

    showSubtitle(text) {
        if (!this.subtitleElement) return;
        this.subtitleElement.textContent = text;
        this.subtitleElement.classList.add('visible');
    },

    hideSubtitle() {
        if (!this.subtitleElement) return;
        this.subtitleElement.classList.remove('visible');
    },

    // ============================================
    // EDITOR CONTEXT MENU
    // ============================================

    createEditorContextMenu() {
        if (this.editorContextMenu) return;

        this.editorContextMenu = document.createElement('div');
        this.editorContextMenu.id = 'editor-context-menu';
        this.editorContextMenu.style.cssText = `
            display: none;
            position: fixed;
            background: #252526;
            border: 1px solid #454545;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            z-index: 100000;
            min-width: 200px;
            border-radius: 4px;
            padding: 4px 0;
        `;

        const translateItem = document.createElement('div');
        translateItem.textContent = '🌐 Translate & Play Now';
        translateItem.style.cssText = 'padding: 8px 16px; cursor: pointer; color: #cccccc; font-size: 13px;';
        translateItem.onmouseover = () => translateItem.style.background = '#094771';
        translateItem.onmouseout = () => translateItem.style.background = 'transparent';
        translateItem.onclick = () => {
            this.editorContextMenu.style.display = 'none';
            const path = this.editorContextMenu.dataset.path;
            if (path) this.translateAndPlayImmediately(path);
        };

        const copyItem = document.createElement('div');
        copyItem.textContent = '📋 Copy Selected Text';
        copyItem.style.cssText = 'padding: 8px 16px; cursor: pointer; color: #cccccc; font-size: 13px; border-top: 1px solid #454545;';
        copyItem.onmouseover = () => copyItem.style.background = '#094771';
        copyItem.onmouseout = () => copyItem.style.background = 'transparent';
        copyItem.onclick = () => {
            this.editorContextMenu.style.display = 'none';
            this.copyEditorSelection();
        };

        this.editorContextMenu.appendChild(translateItem);
        this.editorContextMenu.appendChild(copyItem);
        document.body.appendChild(this.editorContextMenu);

        document.addEventListener('click', () => {
            this.editorContextMenu.style.display = 'none';
        });
    },

    showEditorContextMenu(e, path) {
        e.preventDefault();
        this.createEditorContextMenu();
        this.editorContextMenu.dataset.path = path;
        this.editorContextMenu.targetEditor = e.target;
        this.editorContextMenu.style.left = e.clientX + 'px';
        this.editorContextMenu.style.top = e.clientY + 'px';
        this.editorContextMenu.style.display = 'block';
    },

    async translateAndPlayImmediately(path) {
        this.lastPlayedIndex = 0;
        await this.translatePromptContent(path);
    },

    async copyEditorSelection() {
        const editor = this.editorContextMenu.targetEditor;
        if (!editor) return;

        const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        const textToCopy = selectedText || editor.value;

        try {
            await navigator.clipboard.writeText(textToCopy);
            console.log(`[PromptsTasksManager] Copied ${selectedText ? 'selected text' : 'all content'} to clipboard`);
        } catch (err) {
            console.error('[PromptsTasksManager] Failed to copy:', err);
        }
    },

    // ============================================
    // QUEUE INTEGRATION
    // ============================================

    async addToQueue(filePath) {
        try {
            const fullPath = filePath.replace(/^_prompts[\\/]/, '');

            const fileData = await apiClientInstance.get(`${ApiClient.PointUrlKey.CODE_BROWSER_READ_FILE}?path=${encodeURIComponent(fullPath)}`);

            if (fileData.error) {
                this.showNotification('Failed to read file', 'error');
                return;
            }

            // Ensure content is a string
            const content = (fileData.content != null) ? String(fileData.content) : '';

            const result = await apiClientInstance.post(ApiClient.PointUrlKey.MCP_TASK_QUEUE_ADD, {
                category_id: this.currentCategory,
                file_path: filePath,
                content: content
            });

            if (result.success) {
                this.showNotification(`Added ${result.data.paragraphs_added} tasks to queue`, 'success');
            } else {
                this.showNotification(`Failed to add to queue: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error adding to queue:', error);
            this.showNotification('Error adding to queue', 'error');
        }
    },

    showNewTaskDialog() {
        const fileName = prompt('Enter new task file name (without .md):');
        if (!fileName) return;

        const path = this.currentCategory === 'global'
            ? `_prompts/${fileName}.md`
            : `_prompts/${this.currentCategory}/${fileName}.md`;

        this.createNewTask(path);
    },

    async createNewTask(path) {
        try {
            const data = await apiClientInstance.post(ApiClient.PointUrlKey.CODE_BROWSER_PROMPTS_CREATE, {
                name: path.split('/').pop()
            });

            if (data.success) {
                this.showNotification('Task file created successfully', 'success');
                await this.refresh();
            } else {
                this.showNotification(`Failed to create task: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Error creating task:', error);
            this.showNotification('Error creating task', 'error');
        }
    },

    async refresh() {
        await this.loadCategory(this.currentCategory);
    },

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
