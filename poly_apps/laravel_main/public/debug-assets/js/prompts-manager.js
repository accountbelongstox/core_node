// Prompts Manager Module - Floating multi-window prompt editor with auto-translation
const PromptsManager = {
    windows: new Map(),
    activeWindow: null,
    translationQueue: new Map(),
    translating: false,
    lastEditTimes: new Map(),
    lastSaveTimes: new Map(),
    lastTranslationTimes: new Map(),
    translatedNames: new Map(),
    windowZIndex: 30000,
    autoTranslateDelay: 5000,
    autoSaveDelay: 2000,
    nameTranslationQueue: new Set(),
    nameTranslating: false,
    renameQueue: new Set(),
    renaming: false,
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
        const authResult = await this.checkAuth();
        this.createPromptsMenu(authResult.authenticated);
        this.loadNameTranslationsCache();
        this.createSubtitleElement();
        this.setupGlobalKeyboardListener();
        if (authResult.authenticated) {
            await this.loadPrompts();
            await this.scanAllPromptsForRenaming();
            await this.scanAllPromptsForTranslation();
            this.startAutoTranslateChecker();
            this.startAutoSaveChecker();
            this.startNameTranslationChecker();
            this.startAutoRenameChecker();
            this.startFileContentTranslationChecker();
        }
        window.addEventListener('click', (e) => this.handleWindowClick(e));
    },

    createSubtitleElement() {
        this.subtitleElement = document.createElement('div');
        this.subtitleElement.id = 'prompts-subtitle';
        this.subtitleElement.style.cssText = `
            display: none;
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            max-width: 80%;
            text-align: center;
            z-index: 100000;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            line-height: 1.6;
        `;
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

    createPromptsMenu(isAuthenticated = false) {
        const existingMenu = document.getElementById('prompts-menu-bar');
        if (existingMenu) existingMenu.remove();

        const codeBrowserSection = document.getElementById('code-browser-section');
        if (!codeBrowserSection) return;

        const menuBar = document.createElement('div');
        menuBar.id = 'prompts-menu-bar';
        menuBar.style.cssText = `
            width: 100%;
            height: 40px;
            background: linear-gradient(135deg, #2d2d30 0%, #252526 100%);
            border-bottom: 1px solid #454545;
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 8px;
            overflow-x: auto;
            overflow-y: hidden;
            box-sizing: border-box;
        `;

        const label = document.createElement('span');
        label.id = 'prompts-menu-label';
        label.textContent = 'Tasks/Prompts:';
        label.style.cssText = 'color: #cccccc; font-size: 13px; font-weight: 500; flex-shrink: 0;';
        menuBar.appendChild(label);

        this.translateMenuLabel();

        const createBtn = document.createElement('button');
        createBtn.textContent = isAuthenticated ? '+ New Task' : '+ New Task (Login Required)';
        createBtn.disabled = !isAuthenticated;
        createBtn.title = isAuthenticated ? 'Create a new task' : 'Please login to create tasks';
        createBtn.style.cssText = `
            padding: 4px 12px;
            background: ${isAuthenticated ? 'linear-gradient(135deg, #0e639c 0%, #1177bb 100%)' : '#3c3c3c'};
            color: ${isAuthenticated ? '#ffffff' : '#888888'};
            border: ${isAuthenticated ? 'none' : '1px solid #454545'};
            border-radius: 4px;
            cursor: ${isAuthenticated ? 'pointer' : 'not-allowed'};
            font-size: 12px;
            flex-shrink: 0;
            transition: all 0.2s;
            box-shadow: ${isAuthenticated ? '0 2px 4px rgba(0,0,0,0.3)' : 'none'};
            opacity: ${isAuthenticated ? '1' : '0.6'};
        `;
        if (isAuthenticated) {
            createBtn.onmouseover = () => {
                createBtn.style.background = 'linear-gradient(135deg, #1177bb 0%, #1a8dd9 100%)';
                createBtn.style.transform = 'translateY(-1px)';
                createBtn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.4)';
            };
            createBtn.onmouseout = () => {
                createBtn.style.background = 'linear-gradient(135deg, #0e639c 0%, #1177bb 100%)';
                createBtn.style.transform = 'translateY(0)';
                createBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            };
            createBtn.onclick = () => this.createNewPrompt();
        } else {
            createBtn.onclick = () => {
                alert('Please login to create new tasks. Authentication is required to access Code Browser and Tasks/Prompts features.');
            };
        }
        menuBar.appendChild(createBtn);

        const refreshBtn = document.createElement('button');
        refreshBtn.innerHTML = '&#128260; Refresh';
        refreshBtn.style.cssText = `
            padding: 4px 10px;
            background: #3c3c3c;
            color: #cccccc;
            border: 1px solid #454545;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex-shrink: 0;
            transition: all 0.2s;
        `;
        refreshBtn.onmouseover = () => {
            refreshBtn.style.background = '#505050';
            refreshBtn.style.borderColor = '#5a5a5a';
        };
        refreshBtn.onmouseout = () => {
            refreshBtn.style.background = '#3c3c3c';
            refreshBtn.style.borderColor = '#454545';
        };
        refreshBtn.onclick = () => this.loadPrompts();
        menuBar.appendChild(refreshBtn);

        const separator = document.createElement('div');
        separator.style.cssText = 'width: 1px; height: 24px; background: #454545; margin: 0 8px; flex-shrink: 0;';
        menuBar.appendChild(separator);

        const promptsList = document.createElement('div');
        promptsList.id = 'prompts-menu-list';
        promptsList.style.cssText = 'display: flex; gap: 4px; align-items: center; flex: 1; overflow-x: auto;';
        menuBar.appendChild(promptsList);

        const cardBody = codeBrowserSection.querySelector('.card-body');
        cardBody.insertBefore(menuBar, cardBody.firstChild);
    },

    async loadPrompts() {
        try {
            const response = await APIClient.get('/code-browser/prompts');
            const data = await response.json();

            const list = document.getElementById('prompts-menu-list');
            if (!list) return;

            list.innerHTML = '';

            if (response.status === 401 || (data.error && data.error.includes('authenticat'))) {
                const authMsg = document.createElement('span');
                authMsg.textContent = 'Please login to view and manage tasks.';
                authMsg.style.cssText = 'color: #f48771; font-size: 12px; font-style: italic;';
                list.appendChild(authMsg);
                return;
            }

            if (!data.items || data.items.length === 0) {
                const emptyMsg = document.createElement('span');
                emptyMsg.textContent = 'No tasks yet. Click "+ New Task" to create one.';
                emptyMsg.style.cssText = 'color: #888; font-size: 12px; font-style: italic;';
                list.appendChild(emptyMsg);
                return;
            }

            data.items.forEach(item => {
                const btn = document.createElement('button');
                const displayName = this.getTranslatedName(item.name) || item.name;
                btn.textContent = displayName;
                btn.title = item.name;
                btn.style.cssText = `
                    padding: 4px 12px;
                    background: #3c3c3c;
                    color: #cccccc;
                    border: 1px solid #454545;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    white-space: nowrap;
                    flex-shrink: 0;
                    transition: all 0.2s;
                `;
                btn.onmouseover = () => {
                    btn.style.background = '#505050';
                    btn.style.borderColor = '#5a5a5a';
                };
                btn.onmouseout = () => {
                    btn.style.background = '#3c3c3c';
                    btn.style.borderColor = '#454545';
                };
                btn.onclick = () => this.openPromptWindow(item.path, item.name);
                list.appendChild(btn);

                if (this.containsChinese(item.name) && !this.getTranslatedName(item.name)) {
                    this.queueNameTranslation(item.name);
                }
            });
        } catch (error) {
            console.error('Failed to load prompts:', error);
            const list = document.getElementById('prompts-menu-list');
            if (list) {
                list.innerHTML = '<span style="color: #f48771; font-size: 12px;">Failed to load tasks</span>';
            }
        }
    },

    async createNewPrompt() {
        const rawName = prompt('Enter prompt file name:');
        if (!rawName || !rawName.trim()) return;

        let processedName = rawName.trim()
            .replace(/\s+/g, ' ');

        if (processedName.includes(' ')) {
            const words = processedName.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
            processedName = words.join(' ');

            if (!confirm(`Your filename contains spaces. It will be saved as:\n"${processedName}"\n\nIs this correct?`)) {
                return;
            }
        } else {
            processedName = processedName.charAt(0).toUpperCase() + processedName.slice(1).toLowerCase();
        }

        if (!processedName.toLowerCase().endsWith('.md')) {
            processedName += '.md';
        }

        try {
            console.log('[PromptsManager] Creating prompt:', processedName);
            const response = await APIClient.post('/code-browser/prompts/create', { name: processedName });
            console.log('[PromptsManager] Response status:', response.status);
            console.log('[PromptsManager] Response headers:', response.headers);

            const data = await response.json();
            console.log('[PromptsManager] Response data:', data);

            if (data.error) {
                alert('Error: ' + data.error);
                console.error('[PromptsManager] Server error:', data.error);
                return;
            }

            await this.loadPrompts();
            this.openPromptWindow(data.path, data.name);

            if (this.containsChinese(data.name)) {
                this.queueNameTranslation(data.name);
            }
        } catch (error) {
            console.error('Failed to create prompt:', error);
            alert('Failed to create prompt. Please check console for details.');
        }
    },

    async openPromptWindow(path, name) {
        if (this.windows.has(path)) {
            this.bringToFront(path);
            return;
        }

        try {
            const response = await APIClient.get(`/code-browser/read-file?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            this.createFloatingWindow(path, name, data.content, data.modified);
        } catch (error) {
            console.error('Failed to open prompt:', error);
            alert('Failed to open prompt. Please check console for details.');
        }
    },

    createFloatingWindow(path, name, content, modified) {
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
            const response = await APIClient.post('/code-browser/save-file', {
                path: path,
                content: content
            });

            const data = await response.json();
            if (data.error) {
                this.updateWindowStatus(path, 'Save failed!');
                alert('Error: ' + data.error);
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

            console.log(`[PromptsManager] Translating file line-by-line: ${path}`);

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (window.isDirty) {
                    console.log('[PromptsManager] File was modified during translation, aborting');
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
                console.log(`[PromptsManager] Translating line ${i + 1}/${lines.length}`);
                this.updateWindowStatus(path, `Translating line ${i + 1}/${lines.length}...`);

                try {
                    const response = await APIClient.post('/code-browser/prompts/translate-line', {
                        line: line
                    });

                    const data = await response.json();

                    if (data.error) {
                        console.error(`[PromptsManager] Translation error for line ${i + 1}:`, data.error);
                        translatedLines.push(line);
                        continue;
                    }

                    if (data.success && data.translated) {
                        if (data.translated !== line) {
                            console.log(`[PromptsManager]   ✓ Line ${i + 1} translated`);
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
                    console.error(`[PromptsManager] Failed to translate line ${i + 1}:`, error);
                    translatedLines.push(line);
                }
            }

            if (hasChanges) {
                const newContent = translatedLines.join('\n');
                console.log(`[PromptsManager] Translation complete. ${translatedCount}/${totalChineseLines} Chinese lines translated. Saving file...`);
                this.updateWindowStatus(path, 'Saving translated content...');

                const saveResponse = await APIClient.post('/code-browser/save-file', {
                    path: path,
                    content: newContent,
                    skip_backup: true,
                    cleanup_old_backups: true
                });

                const saveData = await saveResponse.json();

                if (saveData.error) {
                    console.error(`[PromptsManager] Failed to save file:`, saveData.error);
                    this.updateWindowStatus(path, 'Save failed');
                    setTimeout(() => {
                        if (!window.isDirty) {
                            this.updateWindowStatus(path, '');
                        }
                    }, 3000);
                } else {
                    console.log(`[PromptsManager] ✓ File saved successfully: ${path}`);
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
                console.log('[PromptsManager] No translation needed for:', path);
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
                console.log(`[PromptsManager] Translated filename: "${name}" -> "${translated}"`);
                this.translatedNames.set(name, translated);
                this.saveNameTranslationCache(name, translated);
                await this.loadPrompts();
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
            const response = await APIClient.post('/code-browser/prompts/translate-name', {
                name: text
            });

            const data = await response.json();
            return (data.success && data.translated) ? data.translated : null;
        } catch (error) {
            console.error('Translation failed:', error);
            return null;
        }
    },

    containsChinese(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    },

    async scanAllPromptsForRenaming() {
        try {
            console.log('[PromptsManager] Scanning all prompts for auto-renaming...');
            const response = await APIClient.get('/code-browser/prompts');
            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                console.log('[PromptsManager] No prompts to scan for renaming');
                return;
            }

            for (const item of data.items) {
                const filename = item.name;
                if (this.containsChinese(filename)) {
                    console.log(`[PromptsManager] File "${filename}" contains Chinese, queuing for auto-rename`);
                    this.renameQueue.add(item.path);
                }
            }

            console.log(`[PromptsManager] Scan complete. ${this.renameQueue.size} file(s) queued for auto-rename`);
        } catch (error) {
            console.error('[PromptsManager] Error scanning prompts for renaming:', error);
        }
    },

    startAutoRenameChecker() {
        setInterval(() => {
            this.checkAndAutoRename();
        }, 2000);
    },

    async checkAndAutoRename() {
        if (this.renaming || this.renameQueue.size === 0) return;

        const path = Array.from(this.renameQueue)[0];
        this.renameQueue.delete(path);

        this.renaming = true;
        try {
            await this.autoRenameFile(path);
        } catch (error) {
            console.error(`[PromptsManager] Failed to auto-rename ${path}:`, error);
        } finally {
            this.renaming = false;
        }
    },

    async autoRenameFile(path) {
        try {
            console.log(`[PromptsManager] Auto-renaming file: ${path}`);
            const response = await APIClient.post('/code-browser/auto-rename-to-english', {
                path: path
            });

            const data = await response.json();

            if (data.success && data.renamed) {
                console.log(`[PromptsManager] File renamed: ${data.original_name} → ${data.translated_name}`);
                await this.loadPrompts();

                const openWindow = this.windows.get(path);
                if (openWindow) {
                    this.closeWindow(path);
                    setTimeout(() => {
                        this.openPrompt(data.new_path);
                    }, 100);
                }
            } else if (data.success && !data.renamed) {
                console.log(`[PromptsManager] File already in English: ${path}`);
            } else {
                console.error(`[PromptsManager] Auto-rename failed: ${data.error}`);
            }
        } catch (error) {
            console.error(`[PromptsManager] Auto-rename error for ${path}:`, error);
        }
    },

    async translateMenuLabel() {
        const label = document.getElementById('prompts-menu-label');
        if (!label) return;

        const originalText = label.textContent;
        const browserLang = navigator.language || navigator.userLanguage;

        if (browserLang.startsWith('zh')) {
            const cached = localStorage.getItem('menu_label_zh');
            if (cached) {
                label.textContent = cached;
                label.title = originalText;
                return;
            }

            try {
                const translated = await this.translateText(originalText);
                if (translated && translated !== originalText) {
                    localStorage.setItem('menu_label_zh', translated);
                    label.textContent = translated;
                    label.title = originalText;
                }
            } catch (error) {
                console.error('Failed to translate menu label:', error);
            }
        }
    },

    async scanAllPromptsForTranslation() {
        try {
            console.log('[PromptsManager] Scanning all prompts for translation...');
            const response = await APIClient.get('/code-browser/prompts');
            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                console.log('[PromptsManager] No prompts to scan');
                return;
            }

            for (const item of data.items) {
                const fileResponse = await APIClient.get(`/code-browser/read-file?path=${encodeURIComponent(item.path)}`);
                const fileData = await fileResponse.json();

                if (fileData.content && this.containsChinese(fileData.content)) {
                    console.log(`[PromptsManager] File "${item.name}" contains Chinese, adding to translation queue`);
                    this.translationQueue.set(item.path, {
                        content: fileData.content,
                        modified: fileData.modified,
                        scheduledTime: Date.now(),
                        isBackground: true
                    });
                }
            }

            console.log(`[PromptsManager] Scan complete. ${this.translationQueue.size} file(s) queued for translation`);
        } catch (error) {
            console.error('[PromptsManager] Error scanning prompts:', error);
        }
    },

    startFileContentTranslationChecker() {
        setInterval(() => {
            this.checkAndTranslateAllFiles();
        }, 5000);
    },

    async checkAndTranslateAllFiles() {
        if (this.translating) return;

        const now = Date.now();

        console.log(`[PromptsManager] Checking ${this.translationQueue.size} file(s) in translation queue`);

        for (const [path, data] of this.translationQueue.entries()) {
            const window = this.windows.get(path);

            const contentToCheck = window ? window.editor.value : data.content;

            if (!this.containsChinese(contentToCheck)) {
                console.log(`[PromptsManager] Skipping ${path}: no Chinese content`);
                this.translationQueue.delete(path);
                continue;
            }

            const lastEditTime = this.lastEditTimes.get(path) || 0;
            const lastTranslationTime = this.lastTranslationTimes.get(path) || 0;

            const timeSinceEdit = lastEditTime ? Math.floor((now - lastEditTime) / 1000) : 'never';
            const timeSinceTranslation = lastTranslationTime ? Math.floor((now - lastTranslationTime) / 1000) : 'never';

            if (lastEditTime > 0 && now - lastEditTime < 5000) {
                console.log(`[PromptsManager] Skipping ${path}: edited ${timeSinceEdit}s ago (need 5s)`);
                continue;
            }

            if (lastEditTime > 0 && lastTranslationTime > 0 && lastEditTime <= lastTranslationTime) {
                console.log(`[PromptsManager] Skipping ${path}: already translated (edit: ${timeSinceEdit}s ago, translation: ${timeSinceTranslation}s ago)`);
                continue;
            }

            if (lastEditTime === 0 && lastTranslationTime === 0) {
                console.log(`[PromptsManager] Background file ${path} ready for translation`);
            }

            console.log(`[PromptsManager] File needs translation: ${path} (edited ${timeSinceEdit}s ago, last translated ${timeSinceTranslation}s ago)`);

            if (window) {
                await this.translatePromptContent(path);
            } else {
                await this.translateBackgroundFile(path, data);
            }
            break;
        }
    },

    async translateBackgroundFile(path, fileData) {
        this.translating = true;

        try {
            console.log(`[PromptsManager] Translating file line-by-line: ${path}`);

            const lines = fileData.content.split('\n');
            const translatedLines = [];
            let hasChanges = false;
            let translatedCount = 0;
            let totalChineseLines = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (!this.containsChinese(line)) {
                    translatedLines.push(line);
                    continue;
                }

                totalChineseLines++;
                console.log(`[PromptsManager] Translating line ${i + 1}/${lines.length}: "${line.substring(0, 50)}${line.length > 50 ? '...' : ''}"`);

                try {
                    const response = await APIClient.post('/code-browser/prompts/translate-line', {
                        line: line
                    });

                    const data = await response.json();

                    if (data.error) {
                        console.error(`[PromptsManager] Translation error for line ${i + 1}:`, data.error);
                        translatedLines.push(line);
                        continue;
                    }

                    if (data.success && data.translated) {
                        if (data.translated !== line) {
                            console.log(`[PromptsManager]   ✓ Line ${i + 1} translated: "${data.translated.substring(0, 50)}${data.translated.length > 50 ? '...' : ''}"`);
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
                    console.error(`[PromptsManager] Failed to translate line ${i + 1}:`, error);
                    translatedLines.push(line);
                }
            }

            if (hasChanges) {
                const newContent = translatedLines.join('\n');
                console.log(`[PromptsManager] Translation complete. ${translatedCount}/${totalChineseLines} Chinese lines translated. Saving file...`);

                const saveResponse = await APIClient.post('/code-browser/save-file', {
                    path: path,
                    content: newContent,
                    skip_backup: true,
                    cleanup_old_backups: true
                });

                const saveData = await saveResponse.json();

                if (saveData.error) {
                    console.error(`[PromptsManager] Failed to save file:`, saveData.error);
                } else {
                    console.log(`[PromptsManager] ✓ File saved successfully: ${path}`);

                    this.lastTranslationTimes.set(path, Date.now());

                    const window = this.windows.get(path);
                    if (window && window.editor) {
                        window.editor.value = newContent;
                        window.savedContent = newContent;
                        console.log(`[PromptsManager] ✓ Editor content updated`);
                    }
                }
            } else {
                console.log(`[PromptsManager] No translation changes for: ${path}`);
                this.lastTranslationTimes.set(path, Date.now());
            }
        } catch (error) {
            console.error(`[PromptsManager] Translation process failed for ${path}:`, error);
        } finally {
            this.translating = false;
        }
    },

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
            const response = await APIClient.post('/tts/generate', {
                text: text,
                language: 'en',
                type: 'sentence'
            });

            const data = await response.json();

            if (data.error) {
                console.error('[PromptsManager] TTS generation error:', data.error);
                return null;
            }

            if (data.success && data.audio_url) {
                return data.audio_url;
            }

            return null;
        } catch (error) {
            console.error('[PromptsManager] TTS request failed:', error);
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
            console.log('[PromptsManager] Audio not ready for sentence:', sentence.text);
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

        // Wait for audio to be loaded before playing to avoid blank period
        const playAudio = () => {
            this.currentAudio.play().catch(err => {
                console.error('[PromptsManager] Audio play failed:', err);
            });
            console.log(`[PromptsManager] Playing sentence ${index + 1}/${window.sentences.length} at ${this.playbackSpeed}x speed`);
        };

        if (this.currentAudio.readyState >= 3) {
            // Audio already loaded
            playAudio();
        } else {
            // Wait for audio to load
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
        // Set lastPlayedIndex to trigger auto-play after translation
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
            console.log(`[PromptsManager] Copied ${selectedText ? 'selected text' : 'all content'} to clipboard`);

            // Show brief feedback
            const originalText = this.editorContextMenu.querySelector('div:last-child').textContent;
            this.editorContextMenu.querySelector('div:last-child').textContent = selectedText ? '✓ Copied Selected!' : '✓ Copied All!';
            setTimeout(() => {
                this.editorContextMenu.querySelector('div:last-child').textContent = originalText;
            }, 1500);
        } catch (err) {
            console.error('[PromptsManager] Failed to copy:', err);
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

        // Wait for audio to be loaded before playing to avoid blank period
        const playAudio = () => {
            this.currentAudio.play().catch(err => {
                console.error('[PromptsManager] Audio play failed:', err);
            });
            console.log(`[PromptsManager] Playing sentence ${index + 1}/${window.sentences.length} at ${this.playbackSpeed}x speed (Loop: ${this.loopPlayback})`);
        };

        if (this.currentAudio.readyState >= 3) {
            // Audio already loaded
            playAudio();
        } else {
            // Wait for audio to load
            this.currentAudio.addEventListener('canplaythrough', playAudio, { once: true });
            this.currentAudio.load();
        }
    },

    showSubtitle(text) {
        if (!this.subtitleElement) return;
        this.subtitleElement.textContent = text;
        this.subtitleElement.style.display = 'block';
    },

    hideSubtitle() {
        if (!this.subtitleElement) return;
        this.subtitleElement.style.display = 'none';
    }
};
