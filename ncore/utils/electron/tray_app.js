// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
