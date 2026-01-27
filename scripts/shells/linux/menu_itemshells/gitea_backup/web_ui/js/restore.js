// Restore Functions

async function showRestoreDialog(encodedPath, namespace) {
    const modal = document.getElementById('restoreModal');
    const modalBody = document.getElementById('restoreModalBody');
    
    if (!modal || !modalBody) return;
    
    UIControls.showModal(modal);
    const backupPath = decodeURIComponent(encodedPath);
    modalBody.innerHTML = '';
    const dialogContent = Components.restoreDialogContent(namespace, backupPath);
    if (dialogContent) modalBody.appendChild(dialogContent);
    
    // Enable restore button when checkbox is checked
    const confirmCheckbox = document.getElementById('restoreConfirm');
    const restoreBtn = document.getElementById('restoreBtn');
    
    if (confirmCheckbox && restoreBtn) {
        confirmCheckbox.addEventListener('change', function() {
            restoreBtn.disabled = !this.checked;
        });
    }
}

async function executeRestore(encodedPath, namespace) {
    const modalBody = document.getElementById('restoreModalBody');
    const restoreBtn = document.getElementById('restoreBtn');
    
    if (!confirmAction('Are you absolutely sure you want to restore from this backup? This will replace all current data.')) {
        return;
    }
    
    if (restoreBtn) {
        UIControls.disableButton(restoreBtn);
        restoreBtn.textContent = 'Restoring...';
    }
    
    modalBody.innerHTML = '';
    const progress = Components.restoreProgress('Restoring backup...');
    if (progress) modalBody.appendChild(progress);
    
    try {
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
        const progressFill = modalBody.querySelector('.progress-fill');
        if (progressFill) {
            const percent = Math.min(progress, 95);
            UIControls.setProgress(progressFill, percent);
            progressFill.textContent = percent + '%';
        }
        }, 500);
        
        const result = await API.restoreBackup(encodedPath, namespace);
        
        clearInterval(progressInterval);
        
        const progressFill = modalBody.querySelector('.progress-fill');
        if (progressFill) {
            UIControls.setProgress(progressFill, 100);
            progressFill.textContent = '100%';
        }
        
        setTimeout(() => {
            modalBody.innerHTML = '';
            const resultContent = Components.restoreResult(
                result.success,
                result.message || '',
                ''
            );
            if (resultContent) modalBody.appendChild(resultContent);
            
            if (result.success) {
                showNotification('Backup restored successfully', 'success');
            } else {
                showNotification('Backup restore failed: ' + (result.message || 'Unknown error'), 'error');
            }
        }, 500);
    } catch (error) {
        console.error('Error restoring backup:', error);
        modalBody.innerHTML = '';
        const errorMsg = Components.errorMessage('Error restoring backup: ' + error.message);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-secondary';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => closeModal('restoreModal');
        const btnGroup = Components.buttonGroup(closeBtn);
        
        if (errorMsg) modalBody.appendChild(errorMsg);
        if (btnGroup) modalBody.appendChild(btnGroup);
        showNotification('Error restoring backup: ' + error.message, 'error');
    }
}

