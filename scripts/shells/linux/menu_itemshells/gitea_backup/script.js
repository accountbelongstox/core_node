// Backup Management Web UI JavaScript

let backupsData = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadBackups();
    
    document.getElementById('refreshBtn').addEventListener('click', loadBackups);
    
    // Modal close handlers
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Load backups from API
async function loadBackups() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const backupListEl = document.getElementById('backupList');
    
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    backupListEl.innerHTML = '';
    
    try {
        const response = await fetch('/api/backups');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        backupsData = await response.json();
        displayBackups(backupsData);
    } catch (error) {
        console.error('Error loading backups:', error);
        errorEl.textContent = `Error loading backups: ${error.message}`;
        errorEl.style.display = 'block';
    } finally {
        loadingEl.style.display = 'none';
    }
}

// Display backups in the UI
function displayBackups(backups) {
    const backupListEl = document.getElementById('backupList');
    
    if (Object.keys(backups).length === 0) {
        backupListEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">No backups found</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    for (const [namespace, backupsList] of Object.entries(backups)) {
        html += `
            <div class="namespace-section">
                <div class="namespace-header">
                    <div>
                        <span class="namespace-title">${namespace}</span>
                        <span class="backup-count">(${backupsList.length} backup${backupsList.length !== 1 ? 's' : ''})</span>
                    </div>
                </div>
        `;
        
        for (const backup of backupsList) {
            const relativePath = backup.path.replace(/^.*\/backups\//, '');
            html += `
                <div class="backup-item">
                    <div class="backup-info">
                        <div class="backup-name">${escapeHtml(backup.name)}</div>
                        <div class="backup-meta">
                            <span>Size: ${backup.size_formatted}</span>
                            <span>Modified: ${backup.modified}</span>
                        </div>
                    </div>
                    <div class="backup-actions">
                        <button class="btn btn-success btn-small" onclick="downloadBackup('${encodeURIComponent(relativePath)}', '${escapeHtml(backup.name)}')">
                            Download
                        </button>
                        <button class="btn btn-primary btn-small" onclick="showBackupInfo('${encodeURIComponent(relativePath)}')">
                            Info
                        </button>
                        <button class="btn btn-danger btn-small" onclick="deleteBackup('${encodeURIComponent(relativePath)}', '${escapeHtml(backup.name)}')">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
    }
    
    backupListEl.innerHTML = html;
}

// Download backup file
function downloadBackup(encodedPath, filename) {
    const url = `/api/download/${encodedPath}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Show backup information
async function showBackupInfo(encodedPath) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = 'Backup Details';
    modalBody.innerHTML = '<div class="loading">Loading...</div>';
    modal.style.display = 'block';
    
    try {
        const response = await fetch(`/api/info/${encodedPath}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const backupInfo = await response.json();
        
        modalBody.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${escapeHtml(backupInfo.name)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Size:</span>
                <span class="detail-value">${backupInfo.size_formatted} (${backupInfo.size.toLocaleString()} bytes)</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Modified:</span>
                <span class="detail-value">${backupInfo.modified}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Path:</span>
                <span class="detail-value" style="word-break: break-all;">${escapeHtml(backupInfo.path)}</span>
            </div>
        `;
    } catch (error) {
        console.error('Error loading backup info:', error);
        modalBody.innerHTML = `<div class="error">Error loading backup information: ${error.message}</div>`;
    }
}

// Delete backup file
async function deleteBackup(encodedPath, filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/delete/${encodedPath}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        if (result.success) {
            alert('Backup deleted successfully');
            loadBackups();
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error deleting backup:', error);
        alert(`Error deleting backup: ${error.message}`);
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

