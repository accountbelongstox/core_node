const { Tray, Menu } = require('electron')
const { src } = require('../practicals.js');
let tray = null

class ElectronTray {

    createTray(trayMenuItems,icon,title) {
        if(!icon)icon = src.getDefaultImageFile()
        tray = new Tray(icon);
        const contextMenu = Menu.buildFromTemplate(trayMenuItems);
        tray.setContextMenu(contextMenu);
        tray.setToolTip(title);
    }
}


module.exports = new ElectronTray()