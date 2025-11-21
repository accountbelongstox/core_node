// ============================================
// NAMESPACE: ITTools.UniversalMenu
// FILE: ittools-menu-universal.js
// PURPOSE: Universal reusable menu component
// ============================================

ITTools.UniversalMenu = {
    HISTORY_KEY: 'ittools_history',
    MAX_HISTORY: 20,

    getMenuConfig() {
        if (typeof ITToolsMenuConfig !== 'undefined') {
            return ITToolsMenuConfig.categories;
        }
        return [];
    },

    renderLeftMenu(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const categories = this.getMenuConfig();
        const html = `
            <div class="ittools-left-menu-scroll">
                ${categories.map(cat => `
                    <div class="ittools-menu-group">
                        <div class="ittools-menu-group-header" data-group-id="${cat.id}">
                            <span>${cat.icon} ${cat.label}</span>
                            <span class="ittools-menu-toggle">▶</span>
                        </div>
                        <div class="ittools-submenu" data-submenu-of="${cat.id}">
                            ${cat.tools.map(tool => `
                                <div class="ittools-submenu-item" 
                                     data-submenu-id="${tool.id}" 
                                     data-tool-label="${tool.label}"
                                     ${tool.clientSide ? 'data-client-side="true"' : ''}>
                                    ${tool.label}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
        this.attachLeftMenuEvents(container);
    },

    renderTopMenu(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const categories = this.getMenuConfig();
        const html = `
            <div class="ittools-top-dropdown-bar">
                ${categories.map(cat => `
                    <div class="ittools-top-dropdown-item" data-dropdown-id="${cat.id}">
                        <span class="ittools-top-dropdown-trigger">${cat.icon} ${cat.label}</span>
                        <div class="ittools-top-dropdown-content">
                            ${cat.tools.map(tool => `
                                <div class="ittools-top-dropdown-tool" 
                                     data-tool-id="${tool.id}"
                                     data-tool-label="${tool.label}">
                                    ${tool.label}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
        this.attachTopMenuEvents(container);
    },

    renderHistoryBar(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const history = this.getHistory();
        const allTools = this.getAllToolsMap();
        
        const html = `
            <div class="ittools-history-wrapper">
                <div class="ittools-history-label">Recent:</div>
                <div class="ittools-history-scroll">
                    <div class="ittools-history-items">
                        ${history.length === 0 ? '<span class="ittools-history-empty">No recent tools</span>' : ''}
                        ${history.map(item => {
                            const toolInfo = allTools[item.id] || { label: item.label || item.id };
                            return `
                                <div class="ittools-history-item" 
                                     data-history-id="${item.id}"
                                     data-tool-label="${toolInfo.label}"
                                     title="${toolInfo.label}">
                                    ${toolInfo.label}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <button class="ittools-history-clear" onclick="ITTools.UniversalMenu.clearHistory()" title="Clear history">×</button>
            </div>
        `;
        container.innerHTML = html;
        this.attachHistoryEvents(container);
    },

    getAllToolsMap() {
        const map = {};
        const categories = this.getMenuConfig();
        categories.forEach(cat => {
            cat.tools.forEach(tool => {
                map[tool.id] = { label: tool.label, categoryId: cat.id, icon: cat.icon };
            });
        });
        return map;
    },

    attachLeftMenuEvents(container) {
        container.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const groupHeader = e.target.closest('.ittools-menu-group-header');
            if (groupHeader) {
                e.preventDefault();
                const groupId = groupHeader.getAttribute('data-group-id');
                if (groupId) {
                    ITTools.Menu.toggleGroup(groupId);
                }
                return;
            }
            
            const submenuItem = e.target.closest('.ittools-submenu-item');
            if (submenuItem) {
                e.preventDefault();
                const submenuId = submenuItem.getAttribute('data-submenu-id');
                const toolLabel = submenuItem.getAttribute('data-tool-label');
                if (submenuId) {
                    this.selectTool(submenuId, toolLabel);
                }
                return;
            }
        });
    },

    attachTopMenuEvents(container) {
        const items = container.querySelectorAll('.ittools-top-dropdown-item');
        items.forEach(item => {
            item.addEventListener('mouseenter', () => {
                items.forEach(i => i.classList.remove('open'));
                item.classList.add('open');
            });
        });
        
        container.addEventListener('mouseleave', () => {
            items.forEach(item => item.classList.remove('open'));
        });
        
        container.addEventListener('click', (e) => {
            e.stopPropagation();
            const tool = e.target.closest('.ittools-top-dropdown-tool');
            if (tool) {
                e.preventDefault();
                const toolId = tool.getAttribute('data-tool-id');
                const toolLabel = tool.getAttribute('data-tool-label');
                if (toolId) {
                    this.selectTool(toolId, toolLabel);
                    container.querySelectorAll('.ittools-top-dropdown-item').forEach(i => i.classList.remove('open'));
                }
            }
        });
    },

    attachHistoryEvents(container) {
        container.addEventListener('click', (e) => {
            e.stopPropagation();
            const historyItem = e.target.closest('.ittools-history-item');
            if (historyItem) {
                e.preventDefault();
                const toolId = historyItem.getAttribute('data-history-id');
                const toolLabel = historyItem.getAttribute('data-tool-label');
                if (toolId) {
                    this.selectTool(toolId, toolLabel);
                }
            }
        });

        const scrollContainer = container.querySelector('.ittools-history-scroll');
        if (scrollContainer) {
            scrollContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                scrollContainer.scrollLeft += e.deltaY;
            });
        }
    },

    selectTool(toolId, toolLabel) {
        ITTools.Menu.activateSubmenu(toolId);
        if (typeof ITTools.Tools !== 'undefined' && ITTools.Tools.loadTool) {
            ITTools.Tools.loadTool(toolId);
        }
        this.addToHistory(toolId, toolLabel);
        this.refreshHistoryBar();
    },

    getHistory() {
        try {
            const stored = localStorage.getItem(this.HISTORY_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    },

    addToHistory(toolId, toolLabel) {
        let history = this.getHistory();
        history = history.filter(item => item.id !== toolId);
        history.unshift({ id: toolId, label: toolLabel, timestamp: Date.now() });
        if (history.length > this.MAX_HISTORY) {
            history = history.slice(0, this.MAX_HISTORY);
        }
        try {
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('Failed to save history:', e);
        }
    },

    clearHistory() {
        try {
            localStorage.removeItem(this.HISTORY_KEY);
            this.refreshHistoryBar();
            ITTools.UI.showToast('History cleared', 'success');
        } catch (e) {
            console.error('Failed to clear history:', e);
        }
    },

    refreshHistoryBar() {
        const container = document.getElementById('ittools-history-bar');
        if (container) {
            this.renderHistoryBar('ittools-history-bar');
        }
    },

    init() {
        this.renderLeftMenu('ittools-dynamic-menu');
        
        const topMenuContainer = document.getElementById('ittools-top-dropdown-menu');
        if (topMenuContainer) {
            this.renderTopMenu('ittools-top-dropdown-menu');
        }
        
        const historyContainer = document.getElementById('ittools-history-bar');
        if (historyContainer) {
            this.renderHistoryBar('ittools-history-bar');
        }
        
        console.log('ITTools UniversalMenu initialized');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof ITTools !== 'undefined' && typeof ITToolsMenuConfig !== 'undefined') {
        setTimeout(() => ITTools.UniversalMenu.init(), 100);
    }
});

console.log('ITTools Universal Menu component loaded');
