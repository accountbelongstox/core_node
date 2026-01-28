// Main Application Initialization

document.addEventListener('DOMContentLoaded', function() {
    console.log('Backup Management Web UI initialized');
    
    // All initialization is handled by individual modules
    // This file can be used for global app-level logic
    
    // Auto-refresh every 5 minutes
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadBackups();
        }
    }, 5 * 60 * 1000);
});

