const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Service status methods
    getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
    checkServiceHealth: () => ipcRenderer.invoke('check-service-health'),

    // Window control methods (used by custom title bar)
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),

    // Service control methods
    restartServices: () => ipcRenderer.invoke('restart-services'),
    openBackendStatus: () => ipcRenderer.invoke('open-backend-status'),

    // Application info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getAppName: () => ipcRenderer.invoke('get-app-name'),

    // Event listeners
    onServiceStatusChange: (callback) => {
        ipcRenderer.on('service-status-changed', callback);
    },

    removeServiceStatusListener: (callback) => {
        ipcRenderer.removeListener('service-status-changed', callback);
    },

    // Window state change listeners
    onWindowMaximized: (callback) => {
        ipcRenderer.on('window-maximized', callback);
    },

    onWindowUnmaximized: (callback) => {
        ipcRenderer.on('window-unmaximized', callback);
    },

    removeWindowStateListener: (eventName, callback) => {
        ipcRenderer.removeListener(eventName, callback);
    }
});

console.log('Electron preload script loaded (Extended v1.1)');