// Prompts Manager Module - Floating multi-window prompt editor with auto-translation
const PromptsManager = {
    windows: new Map(),
    activeWindow: null,
    translationQueue: new Map(),
    translating: false,
    lastEditTimes: new Map(),
    translatedCache: new Set(),
    windowZIndex: 30000,
    autoTranslateDelay: 10000,

    async init() {
        this.createPromptsMenu();
        await this.loadPrompts();
        this.startAutoTranslateChecker();
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
            background: #2d2d30;
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
            background: #0e639c;
            color: #ffffff;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            flex-shrink: 0;
        `;
        createBtn.onmouseover = () => createBtn.style.background = '#1177bb';
        createBtn.onmouseout = () => createBtn.style.background = '#0e639c';
        createBtn.onclick = () => this.createNewPrompt();
        menuBar.appendChild(createBtn);

        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄 Refresh';
        refreshBtn.style.cssText = `
            padding: 4px 10px;
            background: #3c3c3c;
            color: #cccccc;
            border: 1px solid #454545;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            flex-shrink: 0;
        `;
        refreshBtn.onmouseover = () => refreshBtn.style.background = '#505050';
        refreshBtn.onmouseout = () => refreshBtn.style.background = '#3c3c3c';
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
                `;
                btn.onmouseover = () => btn.style.background = '#505050';
                btn.onmouseout = () => btn.style.background = '#3c3c3c';
                btn.onclick = () => this.openPromptWindow(item.path, item.name);
                list.appendChild(btn);

                if (this.containsChinese(item.name)) {
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
            const response = await APIClient.post('/code-browser/prompts/create', { name: processedName });

            const data = await response.json();
            if (data.error) {
                alert('Error: ' + data.error);
                return;
            }

            await this.loadPrompts();
            this.openPromptWindow(data.path, data.name);
        } catch (error) {
            console.error('Failed to create prompt:', error);
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
        }
    },

    createFloatingWindow(path, name, content, modified) {
        const windowId = `prompt-window-${Date.now()}`;
        const windowElement = document.createElement('div');
        windowElement.id = windowId;
        windowElement.style.cssText = `
            position: fixed;
            top: 100px;
            left: 100px;
            width: 600px;
            height: 500px;
            background: #1e1e1e;
            border: 1px solid #454545;
            border-radius: 6px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
            z-index: ${++this.windowZIndex};
            display: flex;
            flex-direction: column;
        `;

        windowElement.addEventListener('mousedown', () => this.bringToFront(path, windowElement));

        const header = document.createElement('div');
        header.style.cssText = `
            height: 36px;
            background: #2d2d30;
            border-bottom: 1px solid #454545;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 12px;
            cursor: move;
            user-select: none;
            border-radius: 6px 6px 0 0;
        `;

        const title = document.createElement('span');
        title.textContent = name;
        title.style.cssText = 'color: #cccccc; font-size: 13px; font-weight: 500;';
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            width: 24px;
            height: 24px;
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
        `;
        closeBtn.onmouseover = () => closeBtn.style.background = '#f48771';
        closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
        closeBtn.onclick = () => this.closeWindow(path, windowElement);
        header.appendChild(closeBtn);

        const editorContainer = document.createElement('div');
        editorContainer.style.cssText = 'flex: 1; padding: 12px; overflow: hidden;';

        const editor = document.createElement('textarea');
        editor.style.cssText = `
            width: 100%;
            height: 100%;
            background: #1e1e1e;
            color: #d4d4d4;
            border: none;
            outline: none;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.6;
            resize: none;
            tab-size: 4;
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
            isDirty: false
        });

        editor.addEventListener('input', () => this.onEditorInput(path));
        editor.addEventListener('blur', () => this.onEditorBlur(path));
        editor.addEventListener('focus', () => this.onEditorFocus(path));

        this.activeWindow = path;
    },

    makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        handle.onmousedown = (e) => {
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
            width: 16px;
            height: 16px;
            cursor: se-resize;
        `;

        resizer.onmousedown = (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = element.offsetWidth;
            const startHeight = element.offsetHeight;

            const doDrag = (e) => {
                element.style.width = (startWidth + e.clientX - startX) + 'px';
                element.style.height = (startHeight + e.clientY - startY) + 'px';
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
        const window = element || this.windows.get(path)?.element;
        if (window) {
            window.style.zIndex = ++this.windowZIndex;
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

        try {
            const response = await APIClient.post('/code-browser/prompts/translate', {
                path: path,
                last_modified: window.modified
            });

            const data = await response.json();

            if (data.error && data.modified) {
                console.log('File modified during translation, discarding result');
                return;
            }

            if (data.success && data.has_changes) {
                const currentContent = window.editor.value;
                const response2 = await APIClient.get(`/code-browser/read-file?path=${encodeURIComponent(path)}`);
                const newData = await response2.json();

                if (window.editor.value === currentContent) {
                    console.log('Translation applied to:', path);
                    window.modified = newData.modified;
                    window.isDirty = false;
                } else {
                    console.log('Content changed during translation, result discarded');
                }
            }
        } catch (error) {
            console.error('Translation failed:', error);
        } finally {
            this.translating = false;
        }
    },

    async queueNameTranslation(name) {
        setTimeout(async () => {
            const translated = await this.translateText(name);
            if (translated) {
                localStorage.setItem(`prompt_name_${name}`, translated);
                this.loadPrompts();
            }
        }, 100);
    },

    getTranslatedName(name) {
        return localStorage.getItem(`prompt_name_${name}`);
    },

    async translateText(text) {
        try {
            const token = '12345678';
            const response = await APIClient.post('/translation/simple/google', {
                text: text,
                target_language: 'en',
                passcode: token
            }, { includeAuth: false });

            const data = await response.json();
            return (data.success && data.translated_text) ? data.translated_text : null;
        } catch (error) {
            console.error('Translation failed:', error);
            return null;
        }
    },

    containsChinese(text) {
        return /[\u4e00-\u9fa5]/.test(text);
    }
};
