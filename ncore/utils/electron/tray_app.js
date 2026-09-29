const { app, Tray, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let config = {};

function createTray() {
    const iconPath = config.iconPath;
    const tooltip = config.tooltip || 'Application';

    let trayImage;
    if (iconPath && fs.existsSync(iconPath)) {
        trayImage = nativeImage.createFromPath(iconPath);
    } else {
        trayImage = nativeImage.createEmpty();
        console.log('[TrayApp] No icon provided or icon not found, using empty icon');
    }

    tray = new Tray(trayImage);
    tray.setToolTip(tooltip);

    updateTrayMenu();

    tray.on('double-click', () => {
        if (config.frontendUrl) {
            shell.openExternal(config.frontendUrl);
        }
    });

    console.log('[TrayApp] Tray created successfully');
}

function updateTrayMenu() {
    const menuTemplate = [];

    if (config.frontendUrl) {
        menuTemplate.push({
            label: 'Open Frontend',
            click: () => {
                shell.openExternal(config.frontendUrl);
            }
        });
    }

    if (config.backendUrl) {
        menuTemplate.push({
            label: 'Open Backend',
            click: () => {
                shell.openExternal(config.backendUrl);
            }
        });
    }

    if (menuTemplate.length > 0) {
        menuTemplate.push({ type: 'separator' });
    }

    menuTemplate.push({
        label: config.appTitle || 'About',
        click: () => {
            console.log('[TrayApp] About clicked');
        }
    });

    menuTemplate.push({ type: 'separator' });

    menuTemplate.push({
        label: 'Quit',
        click: () => {
            app.quit();
        }
    });

    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
    const configArg = process.argv.find(arg => arg.startsWith('--config='));
    if (configArg) {
        const configJson = configArg.substring('--config='.length);
        try {
            config = JSON.parse(Buffer.from(configJson, 'base64').toString('utf-8'));
            console.log('[TrayApp] Configuration loaded');
        } catch (error) {
            console.error('[TrayApp] Failed to parse config:', error.message);
        }
    }

    createTray();
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});

app.on('before-quit', () => {
    console.log('[TrayApp] Quitting...');
});

console.log('[TrayApp] Started');
