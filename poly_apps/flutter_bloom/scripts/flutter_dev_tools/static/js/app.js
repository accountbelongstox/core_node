/**
 * Main Application - Core initialization and coordination
 * Note: Most functionality is split into separate modules:
 * - app-panel.js: Tab and panel rendering
 * - folder-manager.js: Folder operations
 * - tree-view.js: File tree component
 * - file-viewer.js: File content display/editing
 * - storage-manager.js: LocalStorage persistence
 */

// Global state
let apps = [];
let activeIndex = 0;
let treeView = null;
let fileViewer = null;
let currentApp = null;

/**
 * Fetch all apps from API
 */
async function fetchApps() {
  const response = await fetch('/api/apps');
  apps = await response.json();
}

/**
 * Load file tree for current app
 */
async function loadTreeForCurrentApp() {
  const app = apps[activeIndex];
  const sidebar = document.getElementById('sidebar');
  const treePlaceholder = document.getElementById('tree-placeholder');
  const fileTreeEl = document.getElementById('file-tree');
  const currentFolderPathEl = document.getElementById('current-folder-path');

  console.log('[DEBUG] Loading tree for app:', app ? app.app : 'none', 'has_design_dir:', app ? app.has_design_dir : false);

  if (!app || !app.has_design_dir) {
    // Show placeholder, hide tree
    sidebar.classList.remove('hidden');
    treePlaceholder.style.display = 'block';
    fileTreeEl.style.display = 'none';
    currentFolderPathEl.style.display = 'none';
    treeView.clear();
    return;
  }

  // Show tree, hide placeholder
  sidebar.classList.remove('hidden');
  treePlaceholder.style.display = 'none';
  fileTreeEl.style.display = 'block';

  // Set base directory for path resolution (use design_path as base)
  treeView.setBaseDir(app.design_path);

  // Load tree
  console.log('[DEBUG] Fetching tree for app:', app.app);
  await treeView.loadTree(app.app);
}

/**
 * Initialize application
 */
async function init() {
  // Initialize components
  treeView = new TreeView(document.getElementById('file-tree'));
  fileViewer = new FileViewer(document.getElementById('panel'));

  // Set up tree view event handlers
  treeView.onFileClick = (node) => {
    // Load file content when file is clicked
    // node.path is relative to app root, design_path is absolute
    const fullPath = currentApp.design_path.replace(/\\/g, '/') + '/' + node.path.split('/').slice(1).join('/');
    console.log('[DEBUG] Loading file:', fullPath);
    fileViewer.loadFile(fullPath);

    // Save last viewed file
    if (currentApp) {
      storageManager.setLastViewedFile(currentApp.app, fullPath);
    }
  };

  treeView.onFolderClick = (node) => {
    // Save expanded state
    if (currentApp && treeView.currentAppName) {
      storageManager.setExpandedFolders(treeView.currentAppName, treeView.expandedFolders);
    }
  };

  treeView.onFolderSelect = (node, absolutePath) => {
    // Update current folder path display
    updateCurrentFolderPath(absolutePath);
  };

  // Set up open folder button
  const openFolderBtn = document.getElementById('open-folder-btn');
  openFolderBtn.addEventListener('click', handleOpenFolder);

  // Load and render
  await fetchApps();

  // Restore last selected app from localStorage
  const lastIndex = storageManager.getLastSelectedApp();
  if (lastIndex >= 0 && lastIndex < apps.length) {
    activeIndex = lastIndex;
  }

  renderTabs();
  renderPanel();
  loadTreeForCurrentApp();
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', init);
