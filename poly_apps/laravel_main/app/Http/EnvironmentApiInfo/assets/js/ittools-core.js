// ============================================
// NAMESPACE: ITTools Core JavaScript
// FILE: ittools-core.js
// PURPOSE: Core functionality for ITTools system
// ============================================

const ITTools = {
    // ============================================
    // NAMESPACE: ITTools.State
    // PURPOSE: State management and localStorage
    // ============================================
    State: {
        STORAGE_KEY: 'ittools_state',
        
        get() {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                try {
                    return JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to parse ITTools state:', e);
                    return this.getDefaultState();
                }
            }
            return this.getDefaultState();
        },
        
        getDefaultState() {
            return {
                activeTopMenu: 'tools',
                expandedGroups: {},
                activeSubmenu: null,
                rightPanelVisible: false,
                recentTools: []
            };
        },
        
        save(state) {
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
            } catch (e) {
                console.error('Failed to save ITTools state:', e);
            }
        },
        
        update(updates) {
            const current = this.get();
            const newState = { ...current, ...updates };
            this.save(newState);
            return newState;
        },
        
        toggleGroup(groupId) {
            const state = this.get();
            state.expandedGroups[groupId] = !state.expandedGroups[groupId];
            this.save(state);
            return state.expandedGroups[groupId];
        },
        
        setActiveSubmenu(submenuId) {
            return this.update({ activeSubmenu: submenuId });
        },
        
        setActiveTopMenu(menuId) {
            return this.update({ activeTopMenu: menuId });
        },
        
        toggleRightPanel() {
            const state = this.get();
            return this.update({ rightPanelVisible: !state.rightPanelVisible });
        },
        
        addRecentTool(toolId) {
            const state = this.get();
            state.recentTools = state.recentTools.filter(id => id !== toolId);
            state.recentTools.unshift(toolId);
            if (state.recentTools.length > 10) {
                state.recentTools = state.recentTools.slice(0, 10);
            }
            this.save(state);
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.Menu
    // PURPOSE: Menu management and navigation
    // ============================================
    Menu: {
        init() {
            const state = ITTools.State.get();
            this.restoreMenuState(state);
        },
        
        restoreMenuState(state) {
            Object.keys(state.expandedGroups).forEach(groupId => {
                if (state.expandedGroups[groupId]) {
                    this.expandGroup(groupId, false);
                }
            });
            
            if (state.activeSubmenu) {
                this.activateSubmenu(state.activeSubmenu, false);
            }
            
            if (state.activeTopMenu) {
                this.activateTopMenu(state.activeTopMenu, false);
            }
        },
        
        toggleGroup(groupId) {
            const isExpanded = ITTools.State.toggleGroup(groupId);
            const group = document.querySelector(`[data-group-id="${groupId}"]`);
            const submenu = document.querySelector(`[data-submenu-of="${groupId}"]`);
            const toggle = group?.querySelector('.ittools-menu-toggle');
            
            if (group && submenu && toggle) {
                if (isExpanded) {
                    group.classList.add('expanded');
                    submenu.classList.add('expanded');
                    toggle.classList.add('expanded');
                } else {
                    group.classList.remove('expanded');
                    submenu.classList.remove('expanded');
                    toggle.classList.remove('expanded');
                }
            }
        },
        
        expandGroup(groupId, save = true) {
            const group = document.querySelector(`[data-group-id="${groupId}"]`);
            const submenu = document.querySelector(`[data-submenu-of="${groupId}"]`);
            const toggle = group?.querySelector('.ittools-menu-toggle');
            
            if (group && submenu && toggle) {
                group.classList.add('expanded');
                submenu.classList.add('expanded');
                toggle.classList.add('expanded');
                
                if (save) {
                    const state = ITTools.State.get();
                    state.expandedGroups[groupId] = true;
                    ITTools.State.save(state);
                }
            }
        },
        
        activateSubmenu(submenuId, save = true) {
            document.querySelectorAll('.ittools-submenu-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const submenuItem = document.querySelector(`[data-submenu-id="${submenuId}"]`);
            if (submenuItem) {
                submenuItem.classList.add('active');
                if (save) {
                    ITTools.State.setActiveSubmenu(submenuId);
                    ITTools.State.addRecentTool(submenuId);
                }
            }
        },
        
        activateTopMenu(menuId, save = true) {
            document.querySelectorAll('.ittools-top-menu-item').forEach(item => {
                item.classList.remove('active');
            });
            
            const menuItem = document.querySelector(`[data-top-menu-id="${menuId}"]`);
            if (menuItem) {
                menuItem.classList.add('active');
                if (save) {
                    ITTools.State.setActiveTopMenu(menuId);
                }
            }
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.API
    // PURPOSE: API communication layer
    // ============================================
    API: {
        baseUrl: '/api/ittools/v1',
        
        async call(endpoint, method = 'POST', data = null) {
            const url = this.baseUrl + endpoint;
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };
            
            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.body = JSON.stringify(data);
            }
            
            try {
                const response = await fetch(url, options);
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.message || 'API request failed');
                }
                
                return {
                    success: true,
                    data: result
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        },
        
        async get(endpoint) {
            return this.call(endpoint, 'GET');
        },
        
        async post(endpoint, data) {
            return this.call(endpoint, 'POST', data);
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.UI
    // PURPOSE: UI helper functions
    // ============================================
    UI: {
        showResult(elementId, result, isSuccess = true) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            element.textContent = typeof result === 'object' 
                ? JSON.stringify(result, null, 2) 
                : result;
            element.className = 'ittools-result ' + (isSuccess ? 'success' : 'error');
            element.style.display = 'block';
        },
        
        clearResult(elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = 'none';
                element.textContent = '';
            }
        },
        
        showLoading(elementId, message = 'Processing...') {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = message;
                element.className = 'ittools-result';
                element.style.display = 'block';
            }
        },
        
        copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('Copied to clipboard!', 'success');
            }).catch(err => {
                this.showToast('Failed to copy', 'error');
                console.error('Copy failed:', err);
            });
        },
        
        showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = 'ittools-toast ' + type;
            toast.textContent = message;
            toast.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 6px; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10000; font-size: 14px; font-weight: 500;';
            
            if (type === 'success') {
                toast.style.borderLeft = '4px solid #28a745';
                toast.style.color = '#28a745';
            } else if (type === 'error') {
                toast.style.borderLeft = '4px solid #dc3545';
                toast.style.color = '#dc3545';
            }
            
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },
        
        toggleRightPanel() {
            const state = ITTools.State.toggleRightPanel();
            const panel = document.querySelector('.ittools-right-panel');
            if (panel) {
                panel.classList.toggle('visible', state.rightPanelVisible);
            }
        }
    },
    
    // ============================================
    // NAMESPACE: ITTools.Init
    // PURPOSE: Initialization functions
    // ============================================
    Init: {
        run() {
            console.log('Initializing ITTools...');
            ITTools.Menu.init();
            this.attachEventListeners();
            console.log('ITTools initialized successfully');
        },
        
        attachEventListeners() {
            document.addEventListener('click', (e) => {
                if (e.target.matches('.ittools-menu-group-header')) {
                    const groupId = e.target.getAttribute('data-group-id');
                    if (groupId) {
                        ITTools.Menu.toggleGroup(groupId);
                    }
                }
                
                if (e.target.matches('.ittools-submenu-item') || e.target.closest('.ittools-submenu-item')) {
                    const item = e.target.matches('.ittools-submenu-item') 
                        ? e.target 
                        : e.target.closest('.ittools-submenu-item');
                    const submenuId = item.getAttribute('data-submenu-id');
                    if (submenuId) {
                        ITTools.Menu.activateSubmenu(submenuId);
                        ITTools.Tools.loadTool(submenuId);
                    }
                }
                
                if (e.target.matches('.ittools-top-menu-item')) {
                    const menuId = e.target.getAttribute('data-top-menu-id');
                    if (menuId) {
                        ITTools.Menu.activateTopMenu(menuId);
                    }
                }
            });
        }
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ITTools.Init.run());
} else {
    ITTools.Init.run();
}
