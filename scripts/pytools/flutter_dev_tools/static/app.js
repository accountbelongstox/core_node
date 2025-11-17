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

function renderPanel() {
  const panelEl = document.getElementById('panel');
  const app = apps[activeIndex];
  if (!app) {
    panelEl.innerHTML = '<p>No apps found.</p>';
    return;
  }

  const hasIssues = app.issues.length > 0;
  const missingList = app.missing
    .map((item) => `<li><code>${item}</code></li>`)
    .join('');

  panelEl.innerHTML = `
    <h2>${app.app}</h2>
    <p><strong>Design folder:</strong> <code>${app.design_path}</code></p>
    <p class="${hasIssues ? 'status-bad' : 'status-ok'}">
      ${hasIssues ? 'Issues detected' : 'All required folders/files detected.'}
    </p>
    ${hasIssues ? `<h3>Missing items</h3><ul class="issue-list">${missingList}</ul>` : ''}
    ${hasIssues ? '<button id="fix-btn" class="primary">Create Missing Items</button>' : ''}
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
