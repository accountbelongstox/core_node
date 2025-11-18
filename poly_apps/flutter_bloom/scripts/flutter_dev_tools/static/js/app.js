/**
 * Main Application Logic
 * Coordinates between API, tree view, and file viewer
 */

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
 * Render app tabs
 */
function renderTabs() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';

  apps.forEach((app, index) => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (index === activeIndex ? ' active' : '');
    tab.textContent = app.app;
    tab.addEventListener('click', () => {
      activeIndex = index;
      storageManager.setLastSelectedApp(activeIndex); // Save to localStorage
      renderTabs();
      renderPanel();
      loadTreeForCurrentApp();
    });
    tabsEl.appendChild(tab);
  });
}

/**
 * Render main panel (app details and missing items)
 */
function renderPanel() {
  const panelEl = document.getElementById('panel');
  const app = apps[activeIndex];

  if (!app) {
    panelEl.innerHTML = '<p>No apps found.</p>';
    return;
  }

  currentApp = app;
  const hasIssues = app.issues.length > 0;
  const designPath = app.design_path || `${app.app}/design_docs_and_progress`;

  let content = `
    <h2>${app.app}</h2>
    <p><strong>Design folder:</strong> <code>${designPath}</code></p>
    <p class="${hasIssues ? 'status-bad' : 'status-ok'}">
      ${hasIssues ? `⚠ Issues detected: ${app.missing.length} items missing` : '✓ All required folders/files detected.'}
    </p>
  `;

  // Show missing items tree if there are issues
  if (hasIssues && app.tree) {
    content += `
      <h3>Missing Structure (Tree View)</h3>
      <div class="tree-view">
        <div class="tree-item">
          <span class="tree-icon">📁</span>
          <span class="tree-name folder">${app.tree.name}</span>
        </div>
        ${buildMissingTreeHTML(app.tree, 1)}
      </div>
      <button id="fix-btn" class="primary">Create Missing Items</button>
      <p class="warning-text">⚠ Note: Existing files will NOT be overwritten</p>
    `;
  }

  panelEl.innerHTML = content;

  // Attach fix button handler
  if (hasIssues) {
    const fixBtn = document.getElementById('fix-btn');
    if (fixBtn) {
      fixBtn.addEventListener('click', () => handleFixButton(app));
    }
  }

  // Clear file viewer when switching apps
  if (fileViewer) {
    fileViewer.clear();
  }
}

/**
 * Build HTML for missing items tree
 */
function buildMissingTreeHTML(node, indent = 0) {
  if (!node || !node.children) return '';

  let html = '';
  const entries = Object.entries(node.children);

  entries.forEach(([key, child]) => {
    const isFile = child.type === 'file';
    const icon = isFile ? '📄' : '📁';
    const indentStyle = `style="margin-left: ${indent * 20}px"`;

    html += `<div class="tree-item" ${indentStyle}>`;
    html += `<span class="tree-icon">${icon}</span>`;
    html += `<span class="tree-name ${isFile ? 'file' : 'folder'}">${escapeHtml(child.name)}</span>`;
    html += `</div>`;

    if (!isFile && child.children) {
      html += buildMissingTreeHTML(child, indent + 1);
    }
  });

  return html;
}

/**
 * Handle "Create Missing Items" button click
 */
async function handleFixButton(app) {
  const fixBtn = document.getElementById('fix-btn');
  fixBtn.disabled = true;
  fixBtn.textContent = 'Creating...';

  try {
    const resp = await fetch(`/api/apps/${encodeURIComponent(app.app)}/fix`, {
      method: 'POST'
    });

    const result = await resp.json();

    if (!result.success) {
      alert(`Failed to create items: ${result.error || 'Unknown error'}`);
      return;
    }

    const createdCount = result.created ? result.created.length : 0;
    alert(`Successfully created ${createdCount} items!`);

    // Reload apps
    await fetchApps();
    const newIndex = apps.findIndex((entry) => entry.app === app.app);
    activeIndex = newIndex === -1 ? 0 : newIndex;

    renderTabs();
    renderPanel();
    loadTreeForCurrentApp();

  } catch (error) {
    alert(`Request failed: ${error}`);
  } finally {
    fixBtn.disabled = false;
    fixBtn.textContent = 'Create Missing Items';
  }
}

/**
 * Load file tree for current app
 */
async function loadTreeForCurrentApp() {
  const app = apps[activeIndex];
  const sidebar = document.getElementById('sidebar');
  const treePlaceholder = document.getElementById('tree-placeholder');
  const fileTreeEl = document.getElementById('file-tree');

  console.log('[DEBUG] Loading tree for app:', app ? app.app : 'none', 'has_design_dir:', app ? app.has_design_dir : false);

  if (!app || !app.has_design_dir) {
    // Show placeholder, hide tree
    sidebar.classList.remove('hidden');
    treePlaceholder.style.display = 'block';
    fileTreeEl.style.display = 'none';
    treeView.clear();
    return;
  }

  // Show tree, hide placeholder
  sidebar.classList.remove('hidden');
  treePlaceholder.style.display = 'none';
  fileTreeEl.style.display = 'block';

  // Load tree
  console.log('[DEBUG] Fetching tree for app:', app.app);
  await treeView.loadTree(app.app);
}

/**
 * Handle "Open in Explorer" button click
 */
async function handleOpenFolder() {
  if (!currentApp || !currentApp.design_path) {
    alert('No design folder to open');
    return;
  }

  try {
    const response = await fetch('/api/folder/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentApp.design_path })
    });

    const result = await response.json();
    if (!result.success) {
      alert(`Failed to open folder: ${result.error}`);
    }
  } catch (error) {
    alert(`Failed to open folder: ${error.message}`);
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
