/**
 * Folder Manager - Handles folder operations
 * Includes: Open folder, update path display, etc.
 */

// Current selected folder path
let currentSelectedFolderPath = null;

/**
 * Handle "Open in Explorer" button click (sidebar)
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
 * Handle "Open Design Folder" button click (main panel)
 */
async function handleOpenDesignFolder(app) {
  if (!app || !app.design_path) {
    alert('No design folder to open');
    return;
  }

  try {
    const response = await fetch('/api/folder/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: app.design_path })
    });

    const result = await response.json();
    if (!result.success) {
      alert(`Failed to open folder: ${result.error}`);
    }
    // Success - folder opened, no need to show alert
  } catch (error) {
    alert(`Failed to open folder: ${error.message}`);
  }
}

/**
 * Update current folder path display
 */
function updateCurrentFolderPath(absolutePath) {
  const currentFolderPathEl = document.getElementById('current-folder-path');
  const currentFolderTextEl = document.getElementById('current-folder-text');
  const openCurrentFolderBtn = document.getElementById('open-current-folder-btn');

  if (!absolutePath) {
    currentFolderPathEl.style.display = 'none';
    currentSelectedFolderPath = null;
    return;
  }

  currentSelectedFolderPath = absolutePath;
  currentFolderTextEl.textContent = absolutePath;
  currentFolderTextEl.title = absolutePath; // Show full path on hover
  currentFolderPathEl.style.display = 'block';

  // Remove old event listener and add new one
  const newOpenBtn = openCurrentFolderBtn.cloneNode(true);
  openCurrentFolderBtn.parentNode.replaceChild(newOpenBtn, openCurrentFolderBtn);

  newOpenBtn.addEventListener('click', () => handleOpenCurrentFolder(absolutePath));
}

/**
 * Handle "Open Current Folder" button click
 */
async function handleOpenCurrentFolder(folderPath) {
  if (!folderPath) {
    alert('No folder selected');
    return;
  }

  try {
    const response = await fetch('/api/folder/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });

    const result = await response.json();
    if (!result.success) {
      alert(`Failed to open folder: ${result.error}`);
    }
    // Success - folder opened, no need to show alert
  } catch (error) {
    alert(`Failed to open folder: ${error.message}`);
  }
}
