// Statistics Functions

let statsData = null;

async function loadStatistics() {
    try {
        statsData = await API.getStatistics();
        displayStatistics(statsData);
    } catch (error) {
        console.error('Error loading statistics:', error);
        showNotification('Error loading statistics: ' + error.message, 'error');
    }
}

function displayStatistics(data) {
    const statsGrid = document.getElementById('statsData');
    if (!statsGrid) return;
    
    statsGrid.innerHTML = '';
    
    const totalBackups = data.total_backups || 0;
    const totalSize = formatSize(data.total_size || 0);
    const namespaces = data.namespaces || {};
    
    // 不离组件复用，使用DOM操作
    const totalBackupsCard = Components.statCard('Total Backups', totalBackups);
    const totalSizeCard = Components.statCard('Total Size', totalSize);
    const namespacesCard = Components.statCard('Namespaces', Object.keys(namespaces).length);
    
    if (totalBackupsCard) statsGrid.appendChild(totalBackupsCard);
    if (totalSizeCard) statsGrid.appendChild(totalSizeCard);
    if (namespacesCard) statsGrid.appendChild(namespacesCard);
    
    // Add namespace-specific stats - 不离组件复用
    for (const [namespace, info] of Object.entries(namespaces)) {
        const namespaceCard = Components.statCard(
            `${namespace.charAt(0).toUpperCase() + namespace.slice(1)} Backups`,
            info.count,
            formatSize(info.size)
        );
        if (namespaceCard) statsGrid.appendChild(namespaceCard);
    }
}

function showStats() {
    const panel = document.getElementById('statsPanel');
    if (panel) {
        UIControls.show(panel);
        if (!statsData) {
            loadStatistics();
        } else {
            displayStatistics(statsData);
        }
    }
}

function closeStats() {
    const panel = document.getElementById('statsPanel');
    if (panel) {
        UIControls.hide(panel);
    }
}

// Initialize stats button
document.addEventListener('DOMContentLoaded', function() {
    const statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        statsBtn.addEventListener('click', showStats);
    }
});

