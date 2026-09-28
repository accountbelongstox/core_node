let apps = [];
let activeIndex = 0;

async function fetchApps() {
  const response = await fetch('/api/apps');
  apps = await response.json();
}

function renderTabs() {
  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';
  apps.forEach((app, index) => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (index === activeIndex ? ' active' : '');
    tab.textContent = app.app;
    tab.addEventListener('click', () => {
      activeIndex = index;
      renderTabs();
      renderPanel();
    });
    tabsEl.appendChild(tab);
  });
}

function buildTreeHTML(node, indent = 0) {
  if (!node || !node.children) return '';

  let html = '';
  const entries = Object.entries(node.children);

  entries.forEach(([key, child]) => {
    const isFile = child.type === 'file';
    const icon = isFile ? '📄' : '📁';
    const indentStyle = `style="margin-left: ${indent * 20}px"`;

    html += `<div class="tree-item" ${indentStyle}>`;
    html += `<span class="tree-icon">${icon}</span>`;
    html += `<span class="tree-name ${isFile ? 'file' : 'folder'}">${child.name}</span>`;
    html += `</div>`;

    if (!isFile && child.children) {
      html += buildTreeHTML(child, indent + 1);
    }
  });

  return html;
}

function renderPanel() {
  const panelEl = document.getElementById('panel');
  const app = apps[activeIndex];
  if (!app) {
    panelEl.innerHTML = '<p>No apps found.</p>';
    return;
  }

  const hasIssues = app.issues.length > 0;
  const designPath = app.design_path || `${app.app}/design_docs_and_progress`;

  let treeHTML = '';
  if (hasIssues && app.tree) {
    treeHTML = `
      <h3>Missing Structure (Tree View)</h3>
      <div class="tree-view">
        <div class="tree-item">
          <span class="tree-icon">📁</span>
          <span class="tree-name folder">${app.tree.name}</span>
        </div>
        ${buildTreeHTML(app.tree, 1)}
      </div>
    `;
  }

  panelEl.innerHTML = `
    <h2>${app.app}</h2>
    <p><strong>Design folder:</strong> <code>${designPath}</code></p>
    <p class="${hasIssues ? 'status-bad' : 'status-ok'}">
      ${hasIssues ? `⚠ Issues detected: ${app.missing.length} items missing` : '✓ All required folders/files detected.'}
    </p>
    ${treeHTML}
    ${hasIssues ? '<button id="fix-btn" class="primary">Create Missing Items</button>' : ''}
    ${hasIssues ? '<p class="warning-text">⚠ Note: Existing files will NOT be overwritten</p>' : ''}
  `;

  if (hasIssues) {
    const fixBtn = document.getElementById('fix-btn');
    fixBtn.addEventListener('click', async () => {
      fixBtn.disabled = true;
      fixBtn.textContent = 'Creating...';
      try {
        const resp = await fetch(`/api/apps/${encodeURIComponent(app.app)}/fix`, {
          method: 'POST'
        });
        if (!resp.ok) {
          const message = await resp.text();
          alert(`Failed to create items: ${message}`);
        } else {
          const result = await resp.json();
          const createdCount = result.created ? result.created.length : 0;
          alert(`Successfully created ${createdCount} items!`);

          await fetchApps();
          const newIndex = apps.findIndex((entry) => entry.app === app.app);
          activeIndex = newIndex === -1 ? 0 : newIndex;
          renderTabs();
          renderPanel();
        }
      } catch (error) {
        alert(`Request failed: ${error}`);
      }
    });
  }
}

async function init() {
  await fetchApps();
  renderTabs();
  renderPanel();
}

document.addEventListener('DOMContentLoaded', init);
