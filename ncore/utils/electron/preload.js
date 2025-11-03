// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Service status methods
    getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
    checkServiceHealth: () => ipcRenderer.invoke('check-service-health'),

    // Window control methods
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),

    // Service control methods
    restartServices: () => ipcRenderer.invoke('restart-services'),
    openBackendStatus: () => ipcRenderer.invoke('open-backend-status'),

    // Application info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Event listeners
    onServiceStatusChange: (callback) => {
        ipcRenderer.on('service-status-changed', callback);
    },

    removeServiceStatusListener: (callback) => {
        ipcRenderer.removeListener('service-status-changed', callback);
    }
});

console.log('Electron preload script loaded');