/**
 * Menu System - Extensible menu bar with settings
 */

class MenuSystem {
  constructor() {
    this.menuItems = [];
    this.currentConfig = null;
    this.initializeMenuStructure();
  }

  /**
   * Initialize menu structure
   */
  initializeMenuStructure() {
    this.menuItems = [
      {
        id: 'file',
        label: 'File',
        icon: '📁',
        items: [
          { id: 'reload', label: 'Reload', action: () => window.location.reload() },
          { id: 'settings', label: 'Settings', action: () => this.openSettings() },
          { id: 'separator-1', type: 'separator' },
          { id: 'shutdown', label: 'Shutdown Server', action: () => this.shutdownServer() }
        ]
      },
      {
        id: 'view',
        label: 'View',
        icon: '👁️',
        items: [
          { id: 'toggle-tree', label: 'Toggle File Tree', action: () => this.togglePanel('tree') },
          { id: 'toggle-prompts', label: 'Toggle Prompts', action: () => this.togglePanel('prompts') },
          { id: 'separator-2', type: 'separator' },
          { id: 'expand-all', label: 'Expand All Folders', action: () => this.expandAllFolders() },
          { id: 'collapse-all', label: 'Collapse All Folders', action: () => this.collapseAllFolders() }
        ]
      },
      {
        id: 'tools',
        label: 'Tools',
        icon: '🔧',
        items: [
          { id: 'update-pageview', label: 'Update PageView Maps', action: () => this.updatePageViewMaps() },
          { id: 'system-info', label: 'System Information', action: () => this.showSystemInfo() },
          { id: 'clear-cache', label: 'Clear Cache', action: () => this.clearCache() }
        ]
      },
      {
        id: 'help',
        label: 'Help',
        icon: '❓',
        items: [
          { id: 'documentation', label: 'Documentation', action: () => this.openDocumentation() },
          { id: 'about', label: 'About', action: () => this.showAbout() }
        ]
      }
    ];
  }

  /**
   * Render menu bar
   */
  render() {
    const menuBar = document.getElementById('menu-bar');
    if (!menuBar) return;

    menuBar.innerHTML = this.menuItems.map(menu => `
      <div class="menu-item" data-menu-id="${menu.id}">
        <span class="menu-icon">${menu.icon || ''}</span>
        <span class="menu-label">${menu.label}</span>
        <div class="menu-dropdown" style="display: none;">
          ${this.renderMenuItems(menu.items)}
        </div>
      </div>
    `).join('');

    this.attachEventListeners();
  }

  /**
   * Render menu items (dropdown)
   */
  renderMenuItems(items) {
    return items.map(item => {
      if (item.type === 'separator') {
        return '<div class="menu-separator"></div>';
      }
      return `
        <div class="menu-dropdown-item" data-item-id="${item.id}">
          ${item.label}
        </div>
      `;
    }).join('');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Toggle dropdown on menu click
    document.querySelectorAll('.menu-item').forEach(menu => {
      menu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown(menu);
      });
    });

    // Execute action on item click
    document.querySelectorAll('.menu-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = item.dataset.itemId;
        this.executeAction(itemId);
        this.closeAllDropdowns();
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      this.closeAllDropdowns();
    });
  }

  /**
   * Toggle dropdown visibility
   */
  toggleDropdown(menuElement) {
    const dropdown = menuElement.querySelector('.menu-dropdown');
    const isVisible = dropdown.style.display !== 'none';

    // Close all others first
    this.closeAllDropdowns();

    // Toggle this one
    dropdown.style.display = isVisible ? 'none' : 'block';
  }

  /**
   * Close all dropdowns
   */
  closeAllDropdowns() {
    document.querySelectorAll('.menu-dropdown').forEach(dropdown => {
      dropdown.style.display = 'none';
    });
  }

  /**
   * Execute menu action
   */
  executeAction(itemId) {
    // Find action in menu structure
    for (const menu of this.menuItems) {
      const item = menu.items.find(i => i.id === itemId);
      if (item && item.action) {
        item.action();
        return;
      }
    }
  }

  /**
   * Open settings dialog
   */
  async openSettings() {
    if (window.settingsManager) {
      window.settingsManager.show();
    }
  }

  /**
   * Shutdown server
   */
  async shutdownServer() {
    if (!confirm('Are you sure you want to shutdown the server?')) return;

    try {
      const response = await fetch('/api/shutdown', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        alert('Server shutting down...');
      }
    } catch (error) {
      console.error('[Menu] Shutdown failed:', error);
    }
  }

  /**
   * Toggle panel visibility
   */
  togglePanel(panelType) {
    const panel = document.getElementById(panelType === 'tree' ? 'sidebar' : 'prompts-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  /**
   * Expand all folders
   */
  expandAllFolders() {
    if (window.treeView) {
      window.treeView.expandAll();
    }
  }

  /**
   * Collapse all folders
   */
  collapseAllFolders() {
    if (window.treeView) {
      window.treeView.collapseAll();
    }
  }

  /**
   * Update PageView maps
   */
  async updatePageViewMaps() {
    if (window.pageViewUpdater) {
      await window.pageViewUpdater.updatePageViewMap('all', false);
    }
  }

  /**
   * Show system information
   */
  async showSystemInfo() {
    try {
      const response = await fetch('/api/system/info');
      const data = await response.json();

      if (data.success) {
        alert(JSON.stringify(data.system, null, 2));
      }
    } catch (error) {
      console.error('[Menu] Failed to get system info:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    if (confirm('Clear all cached data?')) {
      localStorage.clear();
      alert('Cache cleared. Reloading...');
      window.location.reload();
    }
  }

  /**
   * Open documentation
   */
  openDocumentation() {
    window.open('https://claude.com/claude-code', '_blank');
  }

  /**
   * Show about dialog
   */
  showAbout() {
    alert('Flutter Design Documentation Tool\\nVersion: 2.0\\nPowered by pycore');
  }
}

// Export globally
window.MenuSystem = MenuSystem;
