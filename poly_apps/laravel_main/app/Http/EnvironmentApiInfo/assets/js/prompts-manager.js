// Prompts Manager Module - Floating multi-window prompt editor with auto-translation
const PromptsManager = {
    windows: new Map(),
    activeWindow: null,
    translationQueue: new Map(),
    translating: false,
    lastEditTimes: new Map(),
    lastSaveTimes: new Map(),
    translatedNames: new Map(),
    windowZIndex: 30000,
    autoTranslateDelay: 10000,
    autoSaveDelay: 5000,
    nameTranslationQueue: new Set(),
    nameTranslating: false,

    async init() {
        this.createPromptsMenu();
        this.loadNameTranslationsCache();
        await this.loadPrompts();
        this.startAutoTranslateChecker();
        this.startAutoSaveChecker();
        this.startNameTranslationChecker();
        window.addEventListener('click', (e) => this.handleWindowClick(e));
    },

    createPromptsMenu() {
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
        label.textContent = 'Tasks/Prompts:';
        label.style.cssText = 'color: #cccccc; font-size: 13px; font-weight: 500; flex-shrink: 0;';
        menuBar.appendChild(label);

        const createBtn = document.createElement('button');
        createBtn.textContent = '+ New Task';
        createBtn.style.cssText = `
            padding: 4px 12px;
            background: linear-gradient(135deg, #0e639c 0%, #1177bb 100%);
            color: #ffffff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex-shrink: 0;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
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
        if (cardBody) {
            cardBody.insertBefore(menuBar, cardBody.firstChild);
        }
    },

    async loadPrompts() {
        try {
            const response = await APIClient.get('/code-browser/prompts');
            const data = await response.json();

            const list = document.getElementById('prompts-menu-list');
            if (!list) return;

            list.innerHTML = '';

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
            .replace(/\s+/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

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

        const editorContainer = document.createElement('div');
        editorContainer.style.cssText = 'flex: 1; padding: 16px; overflow: hidden; display: flex; flex-direction: column;';

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
        windowElement.appendChild(header);
        windowElement.appendChild(editorContainer);
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
            saveBtn: saveBtn
        });

        editor.addEventListener('input', () => this.onEditorInput(path));
        editor.addEventListener('blur', () => this.onEditorBlur(path));
        editor.addEventListener('focus', () => this.onEditorFocus(path));

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

            if (window.editor === document.activeElement) {
                continue;
            }

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

            if (window.editor === document.activeElement) {
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
            const response = await APIClient.post('/code-browser/prompts/translate', {
                path: path,
                last_modified: window.modified
            });

            const data = await response.json();

            if (data.error && data.modified) {
                this.updateWindowStatus(path, 'Translation skipped (file changed)');
                return;
            }

            if (data.success && data.has_changes) {
                const currentContent = window.editor.value;

                await this.saveWindow(path);

                const response2 = await APIClient.get(`/code-browser/read-file?path=${encodeURIComponent(path)}`);
                const newData = await response2.json();

                if (window.editor.value === currentContent && !window.isDirty) {
                    window.editor.value = newData.content;
                    window.lastContent = newData.content;
                    window.modified = newData.modified;
                    this.updateWindowStatus(path, 'Translated');

                    setTimeout(() => {
                        if (!window.isDirty) {
                            this.updateWindowStatus(path, '');
                        }
                    }, 3000);
                } else {
                    this.updateWindowStatus(path, 'Translation done (not reloaded)');
                }
            } else {
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
    }
};
