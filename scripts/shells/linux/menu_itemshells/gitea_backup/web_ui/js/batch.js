// Batch Operations Functions

let batchMode = false;
let selectedBackups = new Set();

function toggleBatchMode() {
    batchMode = !batchMode;
    selectedBackups.clear();
    
    const checkboxes = document.querySelectorAll('.backup-checkbox');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    const batchSelectBtn = document.getElementById('batchSelectBtn');
    
    checkboxes.forEach(checkbox => {
        if (batchMode) {
            checkbox.classList.add('visible');
        } else {
            checkbox.classList.remove('visible');
        }
        checkbox.checked = false;
    });
    
    if (batchDeleteBtn) {
        if (batchMode) {
            UIControls.show(batchDeleteBtn);
        } else {
            UIControls.hide(batchDeleteBtn);
        }
    }
    
    if (batchSelectBtn) {
        batchSelectBtn.textContent = batchMode ? 'Cancel Selection' : 'Select Multiple';
    }
    
    // Update backup items
    document.querySelectorAll('.backup-item').forEach(item => {
        if (batchMode) {
            item.classList.remove('selected');
        }
    });
}

function updateBatchSelection() {
    const checkboxes = document.querySelectorAll('.backup-checkbox');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const path = this.dataset.path;
            if (this.checked) {
                selectedBackups.add(path);
            } else {
                selectedBackups.delete(path);
            }
            
            // Update UI
            const backupItem = this.closest('.backup-item');
            if (backupItem) {
                if (this.checked) {
                    backupItem.classList.add('selected');
                } else {
                    backupItem.classList.remove('selected');
                }
            }
            
            // Show/hide batch delete button - 使用CSS类，不离组件复用
            if (batchDeleteBtn) {
                if (selectedBackups.size > 0) {
                    UIControls.show(batchDeleteBtn);
                } else {
                    UIControls.hide(batchDeleteBtn);
                }
            }
        });
    });
}

async function batchDelete() {
    if (selectedBackups.size === 0) {
        showNotification('No backups selected', 'warning');
        return;
    }
    
    const count = selectedBackups.size;
    if (!confirmAction(`Are you sure you want to delete ${count} backup(s)?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    const paths = Array.from(selectedBackups);
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    
    if (batchDeleteBtn) {
        UIControls.disableButton(batchDeleteBtn);
        batchDeleteBtn.textContent = 'Deleting...';
    }
    
    try {
        const result = await API.batchDelete(paths);
        
        if (result.success) {
            showNotification(`Successfully deleted ${result.deleted_count || count} backup(s)`, 'success');
            selectedBackups.clear();
            toggleBatchMode();
            loadBackups();
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error deleting backups:', error);
        showNotification('Error deleting backups: ' + error.message, 'error');
    } finally {
        if (batchDeleteBtn) {
            UIControls.enableButton(batchDeleteBtn);
            batchDeleteBtn.textContent = 'Delete Selected';
        }
    }
}

// Make functions available globally
window.updateBatchSelection = updateBatchSelection;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    const batchSelectBtn = document.getElementById('batchSelectBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');
    
    if (batchSelectBtn) {
        batchSelectBtn.addEventListener('click', toggleBatchMode);
    }
    
    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', batchDelete);
    }
});

