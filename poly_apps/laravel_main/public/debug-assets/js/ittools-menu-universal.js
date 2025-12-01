// ============================================
// NAMESPACE: ITTools.UniversalMenu
// FILE: ittools-menu-universal.js
// PURPOSE: Universal reusable menu component
// ============================================

ITTools.UniversalMenu = {
    HISTORY_KEY: 'ittools_history',
    STATE_KEY: 'ittools_state',
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
                    </div>
                `).join('')}
            </div>
        `;
        container.innerHTML = html;
        
        const globalContainer = document.getElementById('global-dropdown-container');
        if (globalContainer) {
            const dropdownHtml = categories.map(cat => `
                <div class="ittools-top-dropdown-content" data-dropdown-for="${cat.id}" style="display: none; pointer-events: auto;">
                    ${cat.tools.map(tool => `
                        <div class="ittools-top-dropdown-tool" 
                             data-tool-id="${tool.id}"
                             data-tool-label="${tool.label}"
                             data-category-id="${cat.id}">
                            ${tool.label}
                        </div>
                    `).join('')}
                </div>
            `).join('');
            globalContainer.innerHTML = dropdownHtml;
        }
        
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
        const globalContainer = document.getElementById('global-dropdown-container');
        
        if (!globalContainer) {
            console.error('Global dropdown container not found');
            return;
        }
        
        const hideAllDropdowns = () => {
            const allDropdowns = globalContainer.querySelectorAll('.ittools-top-dropdown-content');
            allDropdowns.forEach(dd => {
                dd.style.display = 'none';
            });
            items.forEach(i => i.classList.remove('open'));
        };
        
        items.forEach(item => {
            const dropdownId = item.getAttribute('data-dropdown-id');
            const trigger = item.querySelector('.ittools-top-dropdown-trigger');
            
            item.addEventListener('mouseenter', () => {
                hideAllDropdowns();
                
                const dropdown = globalContainer.querySelector(`[data-dropdown-for="${dropdownId}"]`);
                if (trigger && dropdown) {
                    const rect = trigger.getBoundingClientRect();
                    dropdown.style.top = rect.bottom + 'px';
                    dropdown.style.left = rect.left + 'px';
                    dropdown.style.display = 'block';
                    item.classList.add('open');
                }
            });
        });
        
        container.addEventListener('mouseleave', (e) => {
            const toElement = e.relatedTarget;
            if (!toElement || !toElement.closest('#global-dropdown-container')) {
                setTimeout(hideAllDropdowns, 100);
            }
        });
        
        globalContainer.addEventListener('mouseleave', (e) => {
            const toElement = e.relatedTarget;
            if (!toElement || !toElement.closest('.ittools-top-dropdown-bar')) {
                hideAllDropdowns();
            }
        });
        
        globalContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            const tool = e.target.closest('.ittools-top-dropdown-tool');
            if (tool) {
                e.preventDefault();
                const toolId = tool.getAttribute('data-tool-id');
                const toolLabel = tool.getAttribute('data-tool-label');
                if (toolId) {
                    this.selectTool(toolId, toolLabel);
                    hideAllDropdowns();
                }
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ittools-top-dropdown-bar') && 
                !e.target.closest('#global-dropdown-container')) {
                hideAllDropdowns();
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
        this.saveState(toolId);
    },
    
    saveState(toolId) {
        try {
            const expandedGroups = [];
            document.querySelectorAll('.ittools-menu-group-header.expanded').forEach(header => {
                const groupId = header.getAttribute('data-group-id');
                if (groupId) expandedGroups.push(groupId);
            });
            const state = { lastTool: toolId, expandedGroups: expandedGroups };
            localStorage.setItem(this.STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    },
    
    getState() {
        try {
            const stored = localStorage.getItem(this.STATE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    },
    
    restoreState() {
        const state = this.getState();
        if (!state) return;
        
        if (state.expandedGroups && state.expandedGroups.length > 0) {
            state.expandedGroups.forEach(groupId => {
                if (typeof ITTools.Menu !== 'undefined' && ITTools.Menu.expandGroup) {
                    ITTools.Menu.expandGroup(groupId, false);
                }
            });
        }
        
        if (state.lastTool) {
            const allTools = this.getAllToolsMap();
            const toolInfo = allTools[state.lastTool];
            if (toolInfo) {
                setTimeout(() => {
                    ITTools.Menu.activateSubmenu(state.lastTool, false);
                    if (typeof ITTools.Tools !== 'undefined' && ITTools.Tools.loadTool) {
                        ITTools.Tools.loadTool(state.lastTool);
                    }
                }, 100);
            }
        }
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
