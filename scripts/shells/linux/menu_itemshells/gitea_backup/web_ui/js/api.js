// API Functions

const API = {
    baseURL: '',
    
    // Get all backups
    async getBackups() {
        const response = await fetch(`${this.baseURL}/api/backups`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },
    
    // Get backup info
    async getBackupInfo(encodedPath) {
        const response = await fetch(`${this.baseURL}/api/info/${encodedPath}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },
    
    // Download backup
    downloadBackup(encodedPath, filename) {
        const url = `${this.baseURL}/api/download/${encodedPath}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    
    // Delete backup
    async deleteBackup(encodedPath) {
        const response = await fetch(`${this.baseURL}/api/delete/${encodedPath}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },
    
    // Verify backup
    async verifyBackup(encodedPath) {
        const response = await fetch(`${this.baseURL}/api/verify/${encodedPath}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },
    
    // Restore backup
    async restoreBackup(encodedPath, namespace) {
        const response = await fetch(`${this.baseURL}/api/restore/${encodedPath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ namespace })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },
    
    // Get statistics
    async getStatistics() {
        const response = await fetch(`${this.baseURL}/api/statistics`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    },
    
    // Batch delete
    async batchDelete(encodedPaths) {
        const response = await fetch(`${this.baseURL}/api/batch/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ paths: encodedPaths })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }
};

