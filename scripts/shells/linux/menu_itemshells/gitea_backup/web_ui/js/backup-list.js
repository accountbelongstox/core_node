// Backup List Display Functions

let backupsData = {};

async function loadBackups() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const backupListEl = document.getElementById('backupList');
    
    LoadingState.show('loading');
    ErrorState.hide();
    backupListEl.innerHTML = '';
    
    try {
        backupsData = await API.getBackups();
        allBackups = backupsData; // Store for filtering
        
        updateNamespaceFilter(backupsData);
        displayBackups(backupsData);
    } catch (error) {
        console.error('Error loading backups:', error);
        ErrorState.show(`Error loading backups: ${error.message}`);
    } finally {
        LoadingState.hide('loading');
    }
}

function displayBackups(backups) {
    const backupListEl = document.getElementById('backupList');
    backupListEl.innerHTML = '';
    
    if (!backups || Object.keys(backups).length === 0) {
        const emptyState = Components.emptyState();
        if (emptyState) backupListEl.appendChild(emptyState);
        return;
    }
    
    // 不离组件复用，使用DOM操作而不是innerHTML
    for (const [namespace, backupsList] of Object.entries(backups)) {
        const namespaceSection = Components.namespaceSection(namespace, backupsList);
        if (!namespaceSection) continue;
        
        const namespaceContainer = namespaceSection.querySelector('.namespace-section');
        
        for (const backup of backupsList) {
            const backupItem = Components.backupItem(backup, namespace);
            if (backupItem && namespaceContainer) {
                namespaceContainer.appendChild(backupItem);
            }
        }
        
        backupListEl.appendChild(namespaceSection);
    }
    
    // Update batch selection visibility
    if (window.updateBatchSelection) {
        window.updateBatchSelection();
    }
}

// Make displayBackups available globally for filter.js
window.displayBackups = displayBackups;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadBackups);
    }
    
    loadBackups();
});

