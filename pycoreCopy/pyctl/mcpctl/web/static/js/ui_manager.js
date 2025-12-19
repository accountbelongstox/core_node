/**
 * UI Manager - Handles UI interactions and component updates
 *
 * Extensible module for managing UI state and interactions
 */

class UIManager {
    constructor() {
        this.currentTab = 'dashboard';
        this.currentView = 'dashboard';
        this.eventHandlers = new Map();

        this.init();
    }

    /**
     * Initialize UI event handlers
     */
    init() {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Top navigation
        document.querySelectorAll('.top-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.target.dataset.view;
                this.switchView(view);
            });
        });

        // Sidebar actions
        document.querySelectorAll('[data-action]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const action = e.target.dataset.action;
                this.handleAction(action);
            });
        });

        // Sidebar sections
        document.querySelectorAll('[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.dataset.section;
                this.handleSection(section);
            });
        });
    }

    /**
     * Switch active tab
     */
    switchTab(tabName) {
        // Update tab headers
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });

        this.currentTab = tabName;
        this.trigger('tab-change', { tab: tabName });
    }

    /**
     * Switch active view
     */
    switchView(viewName) {
        document.querySelectorAll('.top-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        this.currentView = viewName;
        this.trigger('view-change', { view: viewName });
    }

    /**
     * Handle sidebar actions
     */
    handleAction(action) {
        this.trigger('action', { action });
    }

    /**
     * Handle sidebar sections
     */
    handleSection(section) {
        this.trigger('section', { section });
    }

    /**
     * Update backend info display
     */
    updateBackendInfo(info) {
        this.setElementText('backend-id', info.backend_id || '-');
        this.setElementText('status', info.status || '-');
        this.setElementText('singleton-port', info.singleton_port || '-');
        this.setElementText('rpc-port', info.rpc_port || '-');
        this.setElementText('start-time', this.formatTimestamp(info.start_time));

        // Update status badge
        const statusBadge = document.getElementById('connection-status');
        if (statusBadge) {
            statusBadge.textContent = info.status === 'running' ? 'Connected' : 'Disconnected';
            statusBadge.classList.toggle('connected', info.status === 'running');
            statusBadge.classList.toggle('error', info.status !== 'running');
        }
    }

    /**
     * Update processing state display
     */
    updateProcessingState(state) {
        const indicator = document.getElementById('state-indicator');
        if (indicator) {
            indicator.textContent = state.state || 'IDLE';
            indicator.classList.toggle('busy', state.state === 'BUSY');
        }

        this.setElementText('active-tasks', state.active_tasks || 0);
        this.setElementText('can-shutdown', state.can_shutdown ? 'Yes' : 'No');
    }

    /**
     * Update tools list
     */
    updateToolsList(tools) {
        this.setElementText('tool-count', tools.length);

        const toolsContainer = document.getElementById('tools-list');
        if (!toolsContainer) return;

        toolsContainer.innerHTML = '';

        tools.forEach(tool => {
            const toolCard = document.createElement('div');
            toolCard.className = 'tool-card';

            const category = this.extractCategory(tool);

            toolCard.innerHTML = `
                <div class="tool-name">${tool}</div>
                <div class="tool-category">${category}</div>
            `;

            toolsContainer.appendChild(toolCard);
        });
    }

    /**
     * Add event to log
     */
    addEvent(message, type = 'info') {
        const eventLog = document.getElementById('event-log');
        if (!eventLog) return;

        const eventItem = document.createElement('div');
        eventItem.className = 'event-item';

        const time = new Date().toLocaleTimeString();

        eventItem.innerHTML = `
            <span class="time">${time}</span>
            <span class="message">${message}</span>
        `;

        // Add to top of log
        eventLog.insertBefore(eventItem, eventLog.firstChild);

        // Keep only last 100 events
        while (eventLog.children.length > 100) {
            eventLog.removeChild(eventLog.lastChild);
        }
    }

    /**
     * Update uptime display
     */
    updateUptime(startTime) {
        if (!startTime) return;

        const start = new Date(startTime * 1000);
        const now = new Date();
        const diff = Math.floor((now - start) / 1000);

        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        const uptime = `${hours}h ${minutes}m ${seconds}s`;
        this.setElementText('uptime', uptime);
    }

    /**
     * Update last update timestamp
     */
    updateLastUpdate() {
        const now = new Date().toLocaleTimeString();
        this.setElementText('last-update', now);
    }

    /**
     * Update request count
     */
    updateRequestCount(count) {
        this.setElementText('request-count', count);
    }

    /**
     * Helper: Set element text content
     */
    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * Helper: Format timestamp
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }

    /**
     * Helper: Extract tool category
     */
    extractCategory(toolName) {
        if (toolName.includes('file') || toolName.includes('img') || toolName.includes('doc')) {
            return 'File Processing';
        } else if (toolName.includes('database')) {
            return 'Database';
        } else if (toolName.includes('codebase')) {
            return 'Codebase';
        }
        return 'Unknown';
    }

    /**
     * Event system: Register handler
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * Event system: Trigger event
     */
    trigger(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }
}

// Export for use in other scripts
window.UIManager = UIManager;
