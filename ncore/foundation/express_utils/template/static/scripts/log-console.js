class LogConsole {
    constructor() {
        this.originalPosition = { x: 0, y: 0 };
        this.originalSize = { width: 400, height: 300 };
        this.container = null;
        this.colors = {
            error: '#D0021B',
            warn: '#F5A623',
            info: '#4A90E2',
            log: '#888888',
            command: '#FF6B6B',
            success: '#7ED321',
            debug: '#9013FE',
            group: '#00BCD4',
            custom: '#FF9800',
            refresh: '#2196F3',
            multiProgress: '#4CAF50',
            logObject: '#795548',
            logExecutionTime: '#607D8B'
        };
        this.init();
    }

    saveState() {
        const state = {
            position: {
                x: parseFloat(this.container.getAttribute('data-x')) || 0,
                y: parseFloat(this.container.getAttribute('data-y')) || 0
            },
            size: {
                width: parseFloat(this.container.style.width) || 400,
                height: parseFloat(this.container.style.height) || 300
            },
            collapsed: this.container.classList.contains('collapsed')
        };
        localStorage.setItem('logConsoleState', JSON.stringify(state));
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('logConsoleState');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // Restore position
                if (state.position) {
                    this.container.style.transform = `translate(${state.position.x}px, ${state.position.y}px)`;
                    this.container.setAttribute('data-x', state.position.x);
                    this.container.setAttribute('data-y', state.position.y);
                }
                
                // Restore size
                if (state.size) {
                    this.container.style.width = `${state.size.width}px`;
                    this.container.style.height = `${state.size.height}px`;
                    this.originalSize = state.size;
                }
                
                // Restore collapsed state
                if (state.collapsed) {
                    this.container.classList.add('collapsed');
                    this.container.querySelector('.collapse-btn').textContent = '+';
                }
            }
        } catch (error) {
            console.warn('Failed to load log console state:', error);
        }
    }

    init() {
        this.container = document.getElementById('log-container') || this.createLogContainer();
        this.loadState();
        return this.container;
    }

    createLogContainer() {
        const container = document.createElement('div');
        container.id = 'log-container';
        container.className = 'log-container';
        container.style.transform = 'translate(0px, 0px)';
        container.setAttribute('data-x', 0);
        container.setAttribute('data-y', 0);

        // Create title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'log-container-title';
        
        // Add title text
        const titleText = document.createElement('span');
        titleText.className = 'title';
        titleText.textContent = 'Log Console';
        titleBar.appendChild(titleText);

        // Add controls
        const controls = document.createElement('div');
        controls.className = 'controls';
        
        const collapseBtn = document.createElement('span');
        collapseBtn.className = 'control-btn collapse-btn';
        collapseBtn.textContent = '−';
        collapseBtn.onclick = () => this.toggleCollapse();
        controls.appendChild(collapseBtn);

        titleBar.appendChild(controls);
        container.appendChild(titleBar);

        // Create content area
        const content = document.createElement('div');
        content.className = 'log-content';
        container.appendChild(content);

        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        container.appendChild(resizeHandle);

        document.body.appendChild(container);

        this.setupInteractions(container);
        return container;
    }

    setupInteractions(container) {
        // Enable dragging
        interact(container)
            .draggable({
                inertia: true,
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    })
                ],
                autoScroll: true,
                allowFrom: '.log-container-title',
                listeners: {
                    move: (event) => this.dragMoveListener(event)
                }
            })
            .resizable({
                edges: { right: true, bottom: true, left: true, top: true },
                listeners: {
                    move: (event) => {
                        const target = event.target;
                        let x = (parseFloat(target.getAttribute('data-x')) || 0);
                        let y = (parseFloat(target.getAttribute('data-y')) || 0);

                        // Update the element's style
                        target.style.width = event.rect.width + 'px';
                        target.style.height = event.rect.height + 'px';

                        // Translate when resizing from top or left edges
                        x += event.deltaRect.left;
                        y += event.deltaRect.top;

                        target.style.transform = `translate(${x}px, ${y}px)`;

                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);

                        // Save size to localStorage
                        this.saveState();
                    }
                },
                modifiers: [
                    interact.modifiers.restrictEdges({
                        outer: 'parent'
                    }),
                    interact.modifiers.restrictSize({
                        min: { width: 200, height: 100 }
                    })
                ],
                inertia: true
            });

        // Load saved size if exists
        const savedSize = localStorage.getItem('logConsoleSize');
        if (savedSize) {
            const size = JSON.parse(savedSize);
            container.style.width = `${size.width}px`;
            container.style.height = `${size.height}px`;
        }
    }

    dragMoveListener(event) {
        const target = event.target.closest('.log-container');
        if (!target) return;

        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

        target.style.transform = `translate(${x}px, ${y}px)`;
        target.setAttribute('data-x', x);
        target.setAttribute('data-y', y);

        // Check for docking
        const rect = target.getBoundingClientRect();
        const windowWidth = window.innerWidth;

        target.classList.remove('docked-left', 'docked-right');
        if (rect.right > windowWidth - 30 && rect.right < windowWidth + 30) {
            target.classList.add('docked-right');
        } else if (rect.left < 30 && rect.left > -30) {
            target.classList.add('docked-left');
        }

        // Save state after position change
        this.saveState();
    }

    toggleCollapse() {
        const btn = this.container.querySelector('.collapse-btn');
        
        if (this.container.classList.contains('collapsed')) {
            this.container.classList.remove('collapsed');
            btn.textContent = '−';
            // Restore original size
            this.container.style.width = this.originalSize.width + 'px';
            this.container.style.height = this.originalSize.height + 'px';
        } else {
            // Store original size
            this.originalSize = {
                width: parseFloat(this.container.style.width) || 400,
                height: parseFloat(this.container.style.height) || 300
            };
            this.container.classList.add('collapsed');
            btn.textContent = '+';
        }
        
        // Save state after collapse toggle
        this.saveState();
    }

    appendLog(level, message, data = null) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${level}`;
        
        const color = this.colors[level] || '#fff';
        logEntry.style.borderLeft = `3px solid ${color}`;
        logEntry.style.color = color;

        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> <span style="color: ${color}">${message}</span>`;
        
        // Add data if present
        if (data) {
            const dataElement = document.createElement('pre');
            dataElement.style.color = color;
            dataElement.style.opacity = '0.8';  // Slightly dimmer for data
            dataElement.textContent = JSON.stringify(data, null, 2);
            logEntry.appendChild(dataElement);
        }
        
        // Add to container and scroll to bottom
        const content = this.container.querySelector('.log-content');
        content.appendChild(logEntry);
        content.scrollTop = content.scrollHeight;
        
        // Keep only last 100 messages
        while (content.children.length > 100) {
            content.removeChild(content.firstChild);
        }
    }
}

window.LogConsole = LogConsole;