// Backup Verification Functions

async function verifyBackup(encodedPath) {
    const modal = document.getElementById('verifyModal');
    const modalBody = document.getElementById('verifyModalBody');
    
    if (!modal || !modalBody) return;
    
    UIControls.showModal(modal);
    modalBody.innerHTML = '';
    const loading = Components.loading('Verifying backup...');
    const progress = Components.progressBar(0, '0%');
    if (loading) modalBody.appendChild(loading);
    if (progress) modalBody.appendChild(progress);
    
    try {
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            const progressFill = modalBody.querySelector('.progress-fill');
            if (progressFill) {
                UIControls.setProgress(progressFill, progress);
                progressFill.textContent = progress + '%';
            }
            if (progress >= 90) {
                clearInterval(progressInterval);
            }
        }, 200);
        
        const result = await API.verifyBackup(encodedPath);
        
        clearInterval(progressInterval);
        
        const progressFill = modalBody.querySelector('.progress-fill');
        if (progressFill) {
            UIControls.setProgress(progressFill, 100);
            progressFill.textContent = '100%';
        }
        
        setTimeout(() => {
            modalBody.innerHTML = '';
            const verifyResult = Components.verifyResult(
                result.valid,
                result.format || 'Unknown',
                result.message || '',
                result.file_count || null
            );
            if (verifyResult) modalBody.appendChild(verifyResult);
            
            if (result.valid) {
                showNotification('Backup verification successful', 'success');
            } else {
                showNotification('Backup verification failed', 'error');
            }
        }, 500);
    } catch (error) {
        console.error('Error verifying backup:', error);
        modalBody.innerHTML = '';
        const errorMsg = Components.errorMessage('Error verifying backup: ' + error.message);
        if (errorMsg) modalBody.appendChild(errorMsg);
        showNotification('Error verifying backup: ' + error.message, 'error');
    }
}

