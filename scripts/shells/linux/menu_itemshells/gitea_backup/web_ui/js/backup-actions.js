// Backup Action Functions

// Download backup
function downloadBackup(encodedPath, filename) {
    try {
        API.downloadBackup(encodedPath, filename);
        showNotification('Download started', 'success');
    } catch (error) {
        console.error('Error downloading backup:', error);
        showNotification('Error downloading backup: ' + error.message, 'error');
    }
}

// Show backup information
async function showBackupInfo(encodedPath) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    modalTitle.textContent = 'Backup Details';
    modalBody.innerHTML = '';
    const loading = Components.loading('Loading...');
    if (loading) modalBody.appendChild(loading);
    UIControls.showModal(modal);
    
    try {
        const backupInfo = await API.getBackupInfo(encodedPath);
        
        modalBody.innerHTML = '';
        // 不离组件复用，使用DOM操作
        const nameRow = Components.detailRow('Name', backupInfo.name);
        const sizeRow = Components.detailRow('Size', `${backupInfo.size_formatted} (${backupInfo.size.toLocaleString()} bytes)`);
        const modifiedRow = Components.detailRow('Modified', backupInfo.modified);
        const pathRow = Components.detailRow('Path', backupInfo.path);
        
        if (nameRow) modalBody.appendChild(nameRow);
        if (sizeRow) modalBody.appendChild(sizeRow);
        if (modifiedRow) modalBody.appendChild(modifiedRow);
        if (pathRow) modalBody.appendChild(pathRow);
    } catch (error) {
        console.error('Error loading backup info:', error);
        modalBody.innerHTML = '';
        const errorMsg = Components.errorMessage('Error loading backup information: ' + error.message);
        if (errorMsg) modalBody.appendChild(errorMsg);
    }
}

// Delete backup
async function deleteBackup(encodedPath, filename) {
    if (!confirmAction(`Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        await API.deleteBackup(encodedPath);
        showNotification('Backup deleted successfully', 'success');
        loadBackups();
    } catch (error) {
        console.error('Error deleting backup:', error);
        showNotification('Error deleting backup: ' + error.message, 'error');
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        UIControls.hideModal(modal);
    }
}

// Initialize modal close handlers
document.addEventListener('DOMContentLoaded', function() {
    const modals = ['modal', 'restoreModal', 'verifyModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            const closeBtn = modal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => closeModal(modalId));
            }
            
            window.addEventListener('click', function(event) {
                if (event.target === modal) {
                    closeModal(modalId);
                }
            });
        }
    });
});

