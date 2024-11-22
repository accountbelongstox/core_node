const { tray, ctrl, elec } = require('../../ncore/electron.js');
// const { Menu } = require('electron')
// const { file } = require('../../ncore/util');
const { http, src,serve } = require('../../ncore/practicals');
const path = require('path');
class ElectronTray {

    create(parentClass, electronWindow, Conf, Ps) {
        let iconPath = Ps ? path.join(Ps.getHomeDir(), Conf.addons.tray.icon) : src.getDefaultImageFile();
        const trayMenuItems = [
            {
                label: '重启软件',
                type: 'normal',
                click: () => {
                    ctrl.relaunch();
                },
                icon: path.join(Ps.getHomeDir(), `public/images/menu/restart.png`),
            },
            {
                label: '软件最小化',
                sublabel: "最小化",
                toolTip: "-最小化",
                type: 'normal',
                click: () => {
                    ctrl.minimize();
                },
                icon: path.join(Ps.getHomeDir(), `public/images/menu/minimize.png`),
            },
            {
                label: '网页版(客户端)界面',
                sublabel: "*节省内存",
                type: 'normal',
                click: () => {
                    serve.openFrontendServerUrl();
                },
                icon: path.join(Ps.getHomeDir(), `public/images/menu/open_theWeb_page2.png`),
            },
            {
                label: '普通界面',
                sublabel: "*占用内存",
                type: 'normal',
                click: () => {
                    parentClass.createWinInterface();
                },
                icon: path.join(Ps.getHomeDir(), `public/images/menu/open_interface.png`),
            },
            {
                label: '设置中心',
                sublabel: "系统快捷设置",
                type: 'normal',
                click: () => {
                    parentClass.createWinInterface();
                },
                icon: path.join(Ps.getHomeDir(), `public/images/menu/open_interface1.png`),
            },
            { type: 'separator' },
            {
                type: 'normal',
                label: '退出软件',
                click: () => {
                    ctrl.close();
                },
                icon: path.join(Ps.getHomeDir(), `public/images/menu/quit.png`),
            }
        ];
        tray.createTray(trayMenuItems, iconPath, Conf.MainConf.title);
    }
    
}

module.exports = new ElectronTray();
