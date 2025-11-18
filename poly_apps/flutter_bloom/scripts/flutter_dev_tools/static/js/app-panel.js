/**
 * App Panel Manager - Handles main panel rendering
 * Includes: Tabs, app details, missing items tree
 */

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
    <p>
      <strong>Design folder:</strong>
      <code>${designPath}</code>
      <button id="open-design-folder-btn" class="btn-icon" title="Open in Explorer">📁</button>
    </p>
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

  // Attach open design folder button handler
  const openDesignFolderBtn = document.getElementById('open-design-folder-btn');
  if (openDesignFolderBtn) {
    openDesignFolderBtn.addEventListener('click', () => handleOpenDesignFolder(app));
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
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
