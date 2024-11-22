let isUpdating = false;

// Create and display custom modal
function showModal(message, isConfirm = false) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.innerHTML = `
        
            <div class="modal-content">
                <p>${message}</p>
                <div class="modal-buttons">
                    <button class="modal-btn" id="modalOkBtn">OK</button>
                    ${isConfirm ? '<button class="modal-btn" id="modalCancelBtn">Cancel</button>' : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const okBtn = document.getElementById('modalOkBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        okBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };

        if (isConfirm) {
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(false);
            };
        }
    });
}

// Function to check for updates
async function checkForUpdates() {
    if (isUpdating) {
        await showModal("An update check is already in progress. Please wait.");
        return;
    }

    isUpdating = true;
    document.getElementById('checkUpdateBtn').disabled = true;

    try {
        const response = await fetch('/check_for_updates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'check_updates' })
        });

        const result = await response.json();
        if (response.ok && result.success) {
            const { newVersionAvailable, lastCommitTime, lastUpdateTime, timeDifference } = result.data;

            let message = result.message;
            if (newVersionAvailable) {
                message += `\nNew version available. Last commit time: ${lastCommitTime}`;
                message += `\nLast update time: ${new Date(parseInt(lastUpdateTime)).toLocaleString()}`;
                message += `\nTime difference: ${timeDifference} milliseconds`;

                const shouldUpdate = await showModal(message + "\n\nDo you want to update and restart the system?", true);
                if (shouldUpdate) {
                    await performUpdateAndRestart();
                }
            } else {
                await showModal(message + "\nYour system is up to date.");
            }
        } else {
            await showModal('Error checking for updates: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error during the update check:', error);
        await showModal('Error checking for updates. Please try again later.');
    } finally {
        isUpdating = false;
        document.getElementById('checkUpdateBtn').disabled = false;
    }
}

async function performUpdateAndRestart() {
    try {
        checkServerStatus();
        const response = await fetch('/update_and_restart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'update_and_restart' })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            await showModal(result.message + "\n\nServer is restarting, please wait...");
        } else {
            await showModal('Error during update and restart: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error during update and restart process:', error);
        await showModal('Error during update and restart. Please try again later.');
    }
}

async function checkServerStatus() {
    let successCount = 0;
    const maxAttempts = 60; // Maximum 60 attempts, equivalent to 60 seconds
    const statusElement = document.createElement('div');
    statusElement.id = 'serverStatusMessage';
    statusElement.textContent = 'Waiting for server to restart...';
    document.body.appendChild(statusElement);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                successCount++;
                if (successCount >= 10) {
                    statusElement.textContent = 'Server has successfully restarted!';
                    setTimeout(() => {
                        statusElement.remove();
                        location.reload();
                    }, 2000);
                    return;
                }
            } else {
                successCount = 0;
            }
        } catch (error) {
            successCount = 0;
        }

        statusElement.textContent = `Waiting for server to restart... (${attempt + 1}/${maxAttempts})`;
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    statusElement.textContent = 'Server restart timed out. Please refresh the page manually to check the status.';
}

