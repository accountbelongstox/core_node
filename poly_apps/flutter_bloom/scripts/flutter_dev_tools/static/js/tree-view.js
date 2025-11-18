/**
 * Tree View Component
 * Expandable/collapsible file tree with click handlers
 */

class TreeView {
  constructor(containerEl) {
    this.container = containerEl;
    this.treeData = null;
    this.expandedFolders = new Set();
    this.selectedItem = null;
    this.selectedFolder = null;
    this.currentAppName = null;
    this.baseDir = null;
    this.onFileClick = null;
    this.onFolderClick = null;
    this.onFolderSelect = null;
  }

  /**
   * Load and render tree from API
   */
  async loadTree(appName) {
    try {
      const response = await fetch(`/api/apps/${encodeURIComponent(appName)}/tree`);
      const data = await response.json();

      if (data.error) {
        this.showError(data.error);
        return;
      }

      this.treeData = data;
      this.currentAppName = appName;

      // Restore expanded folders from localStorage
      const savedExpanded = storageManager.getExpandedFolders(appName);

      if (savedExpanded.size === 0) {
        // First time loading this app - expand all folders by default
        this.expandedFolders = this.getAllFolderPaths(data);
        // Save initial state
        storageManager.setExpandedFolders(appName, this.expandedFolders);
      } else {
        // Use cached state
        this.expandedFolders = savedExpanded;
      }

      this.render();
    } catch (error) {
      this.showError(`Failed to load tree: ${error.message}`);
    }
  }

  /**
   * Get all folder paths in tree (for default expand all)
   */
  getAllFolderPaths(node, paths = new Set()) {
    if (!node) return paths;

    if (node.type === 'folder' && node.path) {
      paths.add(node.path);
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.getAllFolderPaths(child, paths);
      }
    }

    return paths;
  }

  /**
   * Render the tree
   */
  render() {
    this.container.innerHTML = '';

    if (!this.treeData || !this.treeData.children) {
      this.container.innerHTML = '<p class="tree-placeholder">No files found</p>';
      return;
    }

    const rootEl = this.renderNode(this.treeData, 0);
    this.container.appendChild(rootEl);
  }

  /**
   * Render a tree node (folder or file)
   */
  renderNode(node, level) {
    const div = document.createElement('div');

    if (node.type === 'folder') {
      // Folder item
      const itemDiv = document.createElement('div');
      itemDiv.className = 'tree-item folder';
      itemDiv.style.paddingLeft = `${level * 20}px`;

      const isExpanded = this.expandedFolders.has(node.path);

      // Toggle button
      const toggle = document.createElement('span');
      toggle.className = node.children && node.children.length > 0
        ? (isExpanded ? 'tree-toggle expanded' : 'tree-toggle collapsed')
        : 'tree-toggle empty';
      itemDiv.appendChild(toggle);

      // Folder icon
      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = '📁';
      itemDiv.appendChild(icon);

      // Folder name
      const name = document.createElement('span');
      name.className = 'tree-name folder';
      name.textContent = node.name;
      itemDiv.appendChild(name);

      // Highlight if selected
      if (this.selectedFolder === node.path) {
        itemDiv.classList.add('selected');
      }

      // Click handler for folder
      itemDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFolder(node.path);
        this.selectFolder(node);
        if (this.onFolderClick) {
          this.onFolderClick(node);
        }
      });

      div.appendChild(itemDiv);

      // Children
      if (node.children && node.children.length > 0) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = isExpanded ? 'tree-children' : 'tree-children collapsed';

        for (const child of node.children) {
          childrenDiv.appendChild(this.renderNode(child, level + 1));
        }

        div.appendChild(childrenDiv);
      }
    } else {
      // File item
      const itemDiv = document.createElement('div');
      itemDiv.className = 'tree-item file';
      itemDiv.style.paddingLeft = `${level * 20 + 16}px`; // Extra indent for files

      if (this.selectedItem === node.path) {
        itemDiv.classList.add('selected');
      }

      // File icon
      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = this.getFileIcon(node.extension);
      itemDiv.appendChild(icon);

      // File name
      const name = document.createElement('span');
      name.className = 'tree-name file';
      name.textContent = node.name;
      itemDiv.appendChild(name);

      // Click handler for file
      itemDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectFile(node);
      });

      div.appendChild(itemDiv);
    }

    return div;
  }

  /**
   * Toggle folder expanded state
   */
  toggleFolder(path) {
    if (this.expandedFolders.has(path)) {
      this.expandedFolders.delete(path);
    } else {
      this.expandedFolders.add(path);
    }

    // Save to localStorage
    if (this.currentAppName) {
      storageManager.setExpandedFolders(this.currentAppName, this.expandedFolders);
    }

    this.render();

    // Trigger callback
    if (this.onFolderClick) {
      this.onFolderClick({ path });
    }
  }

  /**
   * Select a file
   */
  selectFile(node) {
    this.selectedItem = node.path;
    this.render();

    if (this.onFileClick) {
      this.onFileClick(node);
    }
  }

  /**
   * Select a folder and show its path
   */
  selectFolder(node) {
    this.selectedFolder = node.path;
    this.render();

    if (this.onFolderSelect) {
      // Get absolute path
      const absolutePath = this.getAbsolutePath(node.path);
      this.onFolderSelect(node, absolutePath);
    }
  }

  /**
   * Get absolute path for a relative path
   * Convert relative path to absolute path using baseDir
   */
  getAbsolutePath(relativePath) {
    if (!this.baseDir) {
      return relativePath;
    }

    // Remove leading slash if exists
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

    // Combine baseDir with relative path
    // Handle both Windows and Linux path separators
    const separator = this.baseDir.includes('\\') ? '\\' : '/';
    return this.baseDir + separator + cleanPath.replace(/\//g, separator);
  }

  /**
   * Set base directory for path resolution
   */
  setBaseDir(baseDir) {
    this.baseDir = baseDir;
  }

  /**
   * Get icon for file based on extension
   */
  getFileIcon(extension) {
    const iconMap = {
      '.md': '📝',
      '.txt': '📄',
      '.json': '🔧',
      '.dart': '🎯',
      '.yaml': '⚙️',
      '.yml': '⚙️',
      '.png': '🖼️',
      '.jpg': '🖼️',
      '.svg': '🎨',
    };
    return iconMap[extension] || '📄';
  }

  /**
   * Show error message
   */
  showError(message) {
    this.container.innerHTML = `<p class="tree-placeholder" style="color: #b91c1c;">${message}</p>`;
  }

  /**
   * Clear tree
   */
  clear() {
    this.container.innerHTML = '<p class="tree-placeholder">Select an app with existing design directory</p>';
    this.treeData = null;
    this.expandedFolders.clear();
    this.selectedItem = null;
  }
}

// Make TreeView available globally
window.TreeView = TreeView;
